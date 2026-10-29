import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { authTokens, users } from "@/lib/db/schema";
import { getInternalBaseUrl } from "@/lib/internal-api";
import { generateToken, hashToken } from "./tokens";

const LINK_TTL_MS = 1000 * 60 * 30;
const MAX_LINKS_PER_HOUR = 5;
// The per-address limit stops one inbox being flooded; this one stops a single
// caller spraying links across many addresses (and our sending reputation).
const MAX_LINKS_PER_IP_PER_HOUR = 10;

export type MagicLinkOutcome = "sent" | "rate_limited" | "no_account";

async function sendEmail(to: string, link: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[magic-link] RESEND_API_KEY not set — link for ${to}: ${link}`);
    return;
  }
  const { resend, EMAIL_FROM } = await import("@/lib/email/client");
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: "Your Nyux sign-in link",
    text: `Use this link to sign in to Nyux. It works once and expires in 30 minutes.\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
  });
  if (error) throw new Error(`Failed to send sign-in email: ${error.message}`);
}

export async function isIpRateLimited(ipHash: string): Promise<boolean> {
  const hourAgo = new Date(Date.now() - 1000 * 60 * 60);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(authTokens)
    .where(and(eq(authTokens.ipHash, ipHash), gt(authTokens.createdAt, hourAgo)));
  return count >= MAX_LINKS_PER_IP_PER_HOUR;
}

// Issues a one-time sign-in link. `requireAccount` is true for the plain
// sign-in form (don't mint links for emails that never signed up) and false
// right after onboarding, which has just created the account.
export async function requestMagicLink(
  email: string,
  opts: { requireAccount: boolean; ipHash: string },
): Promise<MagicLinkOutcome> {
  if (await isIpRateLimited(opts.ipHash)) return "rate_limited";

  if (opts.requireAccount) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (!user) return "no_account";
  }

  const hourAgo = new Date(Date.now() - 1000 * 60 * 60);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(authTokens)
    .where(and(eq(authTokens.email, email), gt(authTokens.createdAt, hourAgo)));
  if (count >= MAX_LINKS_PER_HOUR) return "rate_limited";

  const token = generateToken();
  await db.insert(authTokens).values({
    tokenHash: hashToken(token),
    email,
    ipHash: opts.ipHash,
    expiresAt: new Date(Date.now() + LINK_TTL_MS),
  });

  await sendEmail(email, `${getInternalBaseUrl()}/auth/verify?token=${token}`);
  return "sent";
}

// Consumes the token atomically: only one caller can flip used_at from NULL.
export async function consumeMagicLink(token: string): Promise<string | null> {
  const [row] = await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.tokenHash, hashToken(token)),
        gt(authTokens.expiresAt, new Date()),
        sql`${authTokens.usedAt} is null`,
      ),
    )
    .returning({ email: authTokens.email });
  if (!row) return null;

  const [user] = await db
    .update(users)
    .set({ emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` })
    .where(eq(users.email, row.email))
    .returning({ id: users.id });
  return user?.id ?? null;
}

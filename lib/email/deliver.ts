import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { digestItems, digests, preferences, users } from "@/lib/db/schema";
import { getInternalBaseUrl } from "@/lib/internal-api";
import { POSTAL_ADDRESS } from "@/lib/legal";
import { unsubscribeHeaders, unsubscribePageUrl } from "@/lib/unsubscribe";
import type { DigestEmailItem, DigestEmailSector } from "./digest-email";
import { renderDigestEmail } from "./render";
import { sendEmail } from "./send";

export type DeliverResult =
  | { status: "sent"; to: string; subject: string; emailId?: string; sentAt: Date }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string; to?: string };

// Seeds every sector the user is subscribed to, not just the ones with items —
// a sector that approved nothing still gets an explicit empty entry so the
// template can say so rather than silently omitting the section.
function groupBySector(
  sectors: string[],
  items: { sector: string; headline: string; summary: string; whyItMatters: string; sourceUrl: string }[]
): DigestEmailSector[] {
  const bySector = new Map<string, DigestEmailItem[]>(sectors.map((s) => [s, []]));
  for (const item of items) {
    bySector.get(item.sector)?.push({
      headline: item.headline,
      summary: item.summary,
      whyItMatters: item.whyItMatters,
      sourceUrl: item.sourceUrl,
    });
  }
  return sectors.map((sector) => ({ sector, items: bySector.get(sector) ?? [] }));
}

// Emails a stored digest. Shared by the interactive send-now route and the `send` job,
// so both read the same persisted rows rather than an in-memory result. Idempotent: a
// digest that is already sent is skipped, which makes a retried send job harmless.
export async function deliverDigest(digestId: string): Promise<DeliverResult> {
  const [digest] = await db.select().from(digests).where(eq(digests.id, digestId));
  if (!digest) return { status: "failed", error: `Digest ${digestId} not found` };
  if (digest.status === "sent") return { status: "skipped", reason: "digest already sent" };

  const [user] = await db.select().from(users).where(eq(users.id, digest.userId));
  const [prefs] = await db.select().from(preferences).where(eq(preferences.userId, digest.userId));
  if (!user || !prefs) return { status: "failed", error: "User or preferences no longer exist" };

  // A bounced/complained address must never be mailed again.
  if (user.emailStatus !== "ok") return { status: "skipped", reason: `email address is suppressed (${user.emailStatus})` };

  const items = await db.select().from(digestItems).where(eq(digestItems.digestId, digestId)).orderBy(asc(digestItems.rank));
  if (items.length === 0) return { status: "skipped", reason: "digest has no approved items" };

  const runMeta = digest.runMeta as { editorsNote?: unknown } | null;
  const editorsNote = typeof runMeta?.editorsNote === "string" ? runMeta.editorsNote : "";
  const appUrl = getInternalBaseUrl();

  const { html, subject } = await renderDigestEmail({
    userName: user.name,
    sentAt: new Date(),
    timezone: prefs.timezone,
    sectors: prefs.sectors,
    editorsNote,
    sectorGroups: groupBySector(prefs.sectors, items),
    archiveUrl: `${appUrl}/archive/${digestId}`,
    preferencesUrl: `${appUrl}/dashboard`,
    unsubscribeUrl: unsubscribePageUrl(user.id),
    postalAddress: POSTAL_ADDRESS,
  });

  const sendResult = await sendEmail({ to: user.email, subject, html, headers: unsubscribeHeaders(user.id) });
  if (!sendResult.ok) return { status: "failed", error: sendResult.error, to: user.email };

  const sentAt = new Date();
  await db.update(digests).set({ sentAt, status: "sent", subject, html }).where(eq(digests.id, digestId));
  return { status: "sent", to: user.email, subject, emailId: sendResult.id, sentAt };
}

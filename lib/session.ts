import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences, sessions, users } from "@/lib/db/schema";
import { generateToken, hashToken } from "@/lib/auth/tokens";

export const SESSION_COOKIE = "brieff_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export const getSessionUserId = cache(async (): Promise<string | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())));
  return row?.userId ?? null;
});

export async function startSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  store.delete(SESSION_COOKIE);
}

export async function requireUser() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/signin");

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const [prefs] = await db.select().from(preferences).where(eq(preferences.userId, userId));
  if (!user) redirect("/signin");
  if (!prefs) redirect("/onboarding");

  return { user, preferences: prefs };
}

export async function requireAdmin() {
  const ctx = await requireUser();
  if (ctx.user.role !== "admin") redirect("/dashboard");
  return ctx;
}

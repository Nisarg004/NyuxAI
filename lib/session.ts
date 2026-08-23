import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences, users } from "@/lib/db/schema";

export const SESSION_COOKIE = "brieff_uid";

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function requireUser() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/onboarding");

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const [prefs] = await db.select().from(preferences).where(eq(preferences.userId, userId));
  if (!user || !prefs) redirect("/onboarding");

  return { user, preferences: prefs };
}

"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences, users } from "@/lib/db/schema";
import { computeNextRunAt, safeTimezone } from "@/lib/schedule";
import { setSessionCookie } from "@/lib/session";
import { SECTORS } from "@/lib/sectors";

export async function submitOnboarding(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const roleTitle = String(formData.get("roleTitle") ?? "").trim() || null;
  const sectors = formData.getAll("sectors").map(String).filter((s) => (SECTORS as readonly string[]).includes(s));
  const time = String(formData.get("time") ?? "20:00");
  const timezone = safeTimezone(String(formData.get("timezone") ?? "Asia/Kolkata"));

  if (!email || !name) {
    throw new Error("Email and name are required");
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email));
  const user = existing ?? (await db.insert(users).values({ email, name, roleTitle }).returning())[0];

  if (existing) {
    await db.update(users).set({ name, roleTitle }).where(eq(users.id, user.id));
  }

  const [existingPrefs] = await db.select().from(preferences).where(eq(preferences.userId, user.id));

  // This form does double duty: it's both signup and "log back in with your
  // email". A returning user must NOT have their real preferences silently
  // overwritten by whatever happens to be sitting in these fields — the
  // sector picker starts blank on every page load, so a returning user who
  // forgets to reselect every sector (or just wants to log back in) would
  // otherwise have their standing sectors quietly wiped. Preferences are only
  // ever changed deliberately, via the dashboard's own edit form
  // (updatePreferences in app/dashboard/actions.ts).
  if (!existingPrefs) {
    if (sectors.length === 0) {
      throw new Error("Choose at least one sector");
    }
    const [hour, minute] = time.split(":").map((n) => parseInt(n, 10));
    const deliveryHour = Number.isFinite(hour) ? hour : 20;
    const deliveryMinute = Number.isFinite(minute) ? minute : 0;
    const nextRunAt = computeNextRunAt(deliveryHour, deliveryMinute, timezone);
    await db.insert(preferences).values({ userId: user.id, sectors, deliveryHour, deliveryMinute, timezone, nextRunAt, isActive: true });
  }

  await setSessionCookie(user.id);
  redirect("/dashboard");
}

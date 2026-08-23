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

  if (!email || !name || sectors.length === 0) {
    throw new Error("Email, name, and at least one sector are required");
  }

  const [hour, minute] = time.split(":").map((n) => parseInt(n, 10));
  const deliveryHour = Number.isFinite(hour) ? hour : 20;
  const deliveryMinute = Number.isFinite(minute) ? minute : 0;

  const [existing] = await db.select().from(users).where(eq(users.email, email));
  const user = existing ?? (await db.insert(users).values({ email, name, roleTitle }).returning())[0];

  if (existing) {
    await db.update(users).set({ name, roleTitle }).where(eq(users.id, user.id));
  }

  const nextRunAt = computeNextRunAt(deliveryHour, deliveryMinute, timezone);

  const [existingPrefs] = await db.select().from(preferences).where(eq(preferences.userId, user.id));
  if (existingPrefs) {
    await db
      .update(preferences)
      .set({ sectors, deliveryHour, deliveryMinute, timezone, nextRunAt, isActive: true })
      .where(eq(preferences.userId, user.id));
  } else {
    await db.insert(preferences).values({ userId: user.id, sectors, deliveryHour, deliveryMinute, timezone, nextRunAt, isActive: true });
  }

  await setSessionCookie(user.id);
  redirect("/dashboard");
}

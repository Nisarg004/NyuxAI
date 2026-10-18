"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences, users } from "@/lib/db/schema";
import { computeNextRunAt, safeTimezone } from "@/lib/schedule";
import { requestMagicLink } from "@/lib/auth/magic-link";
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

  // Nothing here proves the submitter owns this email, so a verified account
  // is never touched: its owner gets a sign-in link and nothing else changes.
  // An account that was never verified can still be re-submitted (a retry by
  // the same person after an abandoned signup); it can't receive mail until
  // the link is clicked.
  if (!existing || !existing.emailVerifiedAt) {
    if (sectors.length === 0) {
      throw new Error("Choose at least one sector");
    }
    const user = existing ?? (await db.insert(users).values({ email, name, roleTitle }).returning())[0];
    if (existing) {
      await db.update(users).set({ name, roleTitle }).where(eq(users.id, user.id));
    }

    const [hour, minute] = time.split(":").map((n) => parseInt(n, 10));
    const deliveryHour = Number.isFinite(hour) ? hour : 20;
    const deliveryMinute = Number.isFinite(minute) ? minute : 0;
    const values = {
      userId: user.id,
      sectors,
      deliveryHour,
      deliveryMinute,
      timezone,
      nextRunAt: computeNextRunAt(deliveryHour, deliveryMinute, timezone),
      isActive: true,
    };
    await db.insert(preferences).values(values).onConflictDoUpdate({ target: preferences.userId, set: values });
  }

  const outcome = await requestMagicLink(email, { requireAccount: false });
  redirect(outcome === "rate_limited" ? "/signin?error=rate" : "/signin?sent=1");
}

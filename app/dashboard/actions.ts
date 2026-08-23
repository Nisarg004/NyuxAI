"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";
import { computeNextRunAt, safeTimezone } from "@/lib/schedule";
import { getSessionUserId } from "@/lib/session";
import { SECTORS } from "@/lib/sectors";

export async function updatePreferences(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) throw new Error("No session");

  const sectors = formData.getAll("sectors").map(String).filter((s) => (SECTORS as readonly string[]).includes(s));
  const time = String(formData.get("time") ?? "20:00");
  const timezone = safeTimezone(String(formData.get("timezone") ?? "Asia/Kolkata"));

  if (sectors.length === 0) throw new Error("Choose at least one sector");

  const [hour, minute] = time.split(":").map((n) => parseInt(n, 10));
  const deliveryHour = Number.isFinite(hour) ? hour : 20;
  const deliveryMinute = Number.isFinite(minute) ? minute : 0;
  const nextRunAt = computeNextRunAt(deliveryHour, deliveryMinute, timezone);

  await db
    .update(preferences)
    .set({ sectors, deliveryHour, deliveryMinute, timezone, nextRunAt })
    .where(eq(preferences.userId, userId));

  revalidatePath("/dashboard");
}

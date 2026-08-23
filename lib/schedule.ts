import { DateTime } from "luxon";

export function safeTimezone(tz: string | null | undefined): string {
  const fallback = "Asia/Kolkata";
  if (!tz) return fallback;
  try {
    return DateTime.local().setZone(tz).isValid ? tz : fallback;
  } catch {
    return fallback;
  }
}

// Next occurrence (today if the time hasn't passed yet in that zone, else tomorrow)
// of `hour:minute` local time in `timezone`, expressed as a UTC Date for Postgres.
export function computeNextRunAt(hour: number, minute: number, timezone: string, from: Date = new Date()): Date {
  const zone = safeTimezone(timezone);
  const nowLocal = DateTime.fromJSDate(from, { zone });
  let candidate = nowLocal.set({ hour, minute, second: 0, millisecond: 0 });
  if (candidate <= nowLocal) {
    candidate = candidate.plus({ days: 1 });
  }
  return candidate.toUTC().toJSDate();
}

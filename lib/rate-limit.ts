import { and, eq, gte } from "drizzle-orm";
import { db } from "./db";
import { landingRuns } from "./db/schema";
import { hashIp } from "./client-ip";

export const LANDING_HOURLY_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * Pure decision: given the timestamps of this IP's landing runs inside the
 * trailing hour, may it run again now? Blocked callers are told roughly how
 * long until the oldest run ages out of the window (min 1 minute).
 */
export function decideLandingRun(
  timestampsInWindow: Date[],
  now: Date,
): { ok: true } | { ok: false; retryAfterMinutes: number } {
  if (timestampsInWindow.length < LANDING_HOURLY_LIMIT) return { ok: true };

  const oldest = timestampsInWindow.reduce((a, b) => (a.getTime() < b.getTime() ? a : b));
  const msUntilFree = WINDOW_MS - (now.getTime() - oldest.getTime());
  const retryAfterMinutes = Math.max(1, Math.ceil(msUntilFree / 60_000));
  return { ok: false, retryAfterMinutes };
}

/**
 * Reads this IP's runs in the trailing hour, decides, and — when allowed —
 * records the run before returning. One extra row per allowed landing run;
 * no row is written when blocked.
 */
export async function checkAndRecordLandingRun(
  ip: string,
): Promise<{ ok: true } | { ok: false; retryAfterMinutes: number }> {
  const ipHash = hashIp(ip);
  const now = new Date();
  const cutoff = new Date(now.getTime() - WINDOW_MS);

  const rows = await db
    .select({ createdAt: landingRuns.createdAt })
    .from(landingRuns)
    .where(and(eq(landingRuns.ipHash, ipHash), gte(landingRuns.createdAt, cutoff)));

  const decision = decideLandingRun(
    rows.map((r) => r.createdAt),
    now,
  );
  if (!decision.ok) return decision;

  await db.insert(landingRuns).values({ ipHash });
  return { ok: true };
}

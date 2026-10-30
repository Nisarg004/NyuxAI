import { and, eq, gt, gte, sql } from "drizzle-orm";
import { db } from "./db";
import { landingRuns, runs } from "./db/schema";
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

// Role-tuned sample briefs are the only landing runs that cost real tokens (~20k each);
// sector-only samples read shared editions and cost ~nothing. Past this many costly
// samples in 24h, a visitor who typed a role gets the free sector edition instead of
// being refused, so a traffic spike can't run up the bill. Override with an env var.
export const LANDING_DAILY_ROLE_LIMIT = Number(process.env.LANDING_DAILY_ROLE_LIMIT) || 150;
const COSTLY_RUN_TOKENS = 1000;

export function decideLandingMode(
  wantsRole: boolean,
  costlyRunsToday: number,
  limit: number = LANDING_DAILY_ROLE_LIMIT,
): "role" | "sectors" {
  return wantsRole && costlyRunsToday < limit ? "role" : "sectors";
}

export async function landingModeFor(wantsRole: boolean): Promise<"role" | "sectors"> {
  if (!wantsRole) return "sectors";
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(runs)
    .where(and(eq(runs.kind, "landing"), gt(runs.startedAt, since), sql`${runs.tokenCost} > ${COSTLY_RUN_TOKENS}`));
  return decideLandingMode(true, count);
}

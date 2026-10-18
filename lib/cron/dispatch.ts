import { and, eq, isNotNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences, users } from "@/lib/db/schema";
import { cronSecretHeader, getInternalBaseUrl } from "@/lib/internal-api";
import { enqueueJob, runnableJobCount } from "@/lib/jobs/queue";
import { computeNextRunAt } from "@/lib/schedule";

/**
 * The scheduler's enqueue half. `runDispatch` finds every active user whose delivery
 * slot is at most LEAD_MS away and, for each one:
 *
 *  1. Enqueues a `generate` job for that slot (idempotent per user + slot).
 *  2. Atomically claims the slot — a conditional
 *     `UPDATE preferences SET next_run_at = <the following slot>
 *      WHERE user_id = ? AND next_run_at = <the exact value we just read>`.
 *     If another dispatcher already rolled that row forward, the UPDATE matches zero
 *     rows. Enqueue-then-claim means a crash between the two can only cause a harmless
 *     duplicate enqueue (a no-op on the unique index), never a lost slot.
 *
 * It does no LLM work itself and returns in well under a second per user. The
 * `generate` job builds the digest ahead of time; when it finishes it enqueues a
 * `send` job due at the slot itself (lib/jobs/handlers.ts), so a 07:00 rush is
 * absorbed by generation that already happened between 06:15 and 07:00. Workers
 * (/api/jobs/worker) drain the queue; `fanOutWorkers` starts several in parallel.
 *
 * Generating early also means a slot is claimed before it is delivered. That is safe
 * because a job killed mid-run has an expired lease and is retried (lib/jobs/queue.ts),
 * which fixes the old "claimed, then killed, so no brief" failure mode.
 */

export const LEAD_MS = 45 * 60 * 1000;

export type DispatchUserResult = {
  email: string;
  claimed: boolean;
  enqueued: boolean;
  note?: string;
};

export type DispatchResult = {
  due: number;
  processed: DispatchUserResult[];
  runnableJobs: number;
  durationMs: number;
};

type DueUser = {
  userId: string;
  email: string;
  dueRunAt: Date;
  deliveryHour: number;
  deliveryMinute: number;
  timezone: string;
};

async function fetchDueUsers(horizon: Date): Promise<DueUser[]> {
  const rows = await db
    .select({
      userId: preferences.userId,
      email: users.email,
      dueRunAt: preferences.nextRunAt,
      deliveryHour: preferences.deliveryHour,
      deliveryMinute: preferences.deliveryMinute,
      timezone: preferences.timezone,
    })
    .from(preferences)
    .innerJoin(users, eq(users.id, preferences.userId))
    .where(
      and(
        eq(preferences.isActive, true),
        eq(users.emailStatus, "ok"),
        isNotNull(users.emailVerifiedAt),
        isNotNull(preferences.nextRunAt),
        lte(preferences.nextRunAt, horizon)
      )
    );

  return rows.flatMap((row) =>
    row.dueRunAt ? [{ ...row, dueRunAt: row.dueRunAt }] : []
  );
}

/**
 * The atomic slot claim. Returns true only if THIS call is the one that moved
 * `next_run_at` off `expectedRunAt` — a concurrent caller with the same
 * `expectedRunAt` gets false. Exported for `dispatch.test.ts`.
 */
export async function claimDueRun(
  userId: string,
  expectedRunAt: Date,
  nextRunAt: Date
): Promise<boolean> {
  const claimed = await db
    .update(preferences)
    .set({ nextRunAt })
    .where(
      and(eq(preferences.userId, userId), eq(preferences.nextRunAt, expectedRunAt))
    )
    .returning({ userId: preferences.userId });

  return claimed.length > 0;
}

export async function runDispatch(opts: { now?: Date; leadMs?: number } = {}): Promise<DispatchResult> {
  const startedAt = Date.now();
  const now = opts.now ?? new Date();
  const dueUsers = await fetchDueUsers(new Date(now.getTime() + (opts.leadMs ?? LEAD_MS)));
  const processed: DispatchUserResult[] = [];

  for (const user of dueUsers) {
    // The slot after this one — computed from the slot itself, not from `now`, because
    // with lead time the current slot may still be in the future.
    const nextRunAt = computeNextRunAt(user.deliveryHour, user.deliveryMinute, user.timezone, user.dueRunAt);

    const enqueued = await enqueueJob({ kind: "generate", userId: user.userId, scheduledFor: user.dueRunAt, runAfter: now });
    const claimed = await claimDueRun(user.userId, user.dueRunAt, nextRunAt);
    processed.push({
      email: user.email,
      claimed,
      enqueued,
      ...(claimed ? {} : { note: "slot already claimed by a concurrent dispatch" }),
    });
  }

  return { due: dueUsers.length, processed, runnableJobs: await runnableJobCount(), durationMs: Date.now() - startedAt };
}

/**
 * Starts up to `max` parallel worker invocations, each a separate serverless function
 * that drains the queue (so throughput scales with the fan-out instead of being capped
 * by one 300s request). Sized to the runnable backlog so an idle tick costs nothing.
 * Meant to run inside `after()` of the dispatch route: it outlives the response and
 * resolves when every worker has finished.
 */
export async function fanOutWorkers(opts: { runnableJobs: number; max?: number; baseUrl?: string }): Promise<number> {
  // `||` not `??`: an empty WORKER_FANOUT (as in .env.example) parses to 0 and must mean "default".
  const max = opts.max ?? (Number(process.env.WORKER_FANOUT) || 4);
  const workers = Math.min(max, opts.runnableJobs);
  if (workers <= 0) return 0;

  const baseUrl = opts.baseUrl ?? getInternalBaseUrl();
  await Promise.allSettled(
    Array.from({ length: workers }, async () => {
      try {
        const res = await fetch(`${baseUrl}/api/jobs/worker`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...cronSecretHeader() },
        });
        if (!res.ok) console.error(`[dispatch] worker invocation responded ${res.status}`);
      } catch (err) {
        console.error(`[dispatch] worker invocation failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }),
  );
  return workers;
}

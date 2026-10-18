import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";

export const MAX_ATTEMPTS = 3;
// Longer than the worker route's 300s maxDuration, so a live worker's lease never
// expires under it; only a worker that actually died leaves a reclaimable job.
export const LOCK_MS = 6 * 60 * 1000;

export type JobKind = "generate" | "send";

export type ClaimedJob = {
  id: string;
  kind: JobKind;
  userId: string;
  scheduledFor: Date;
  attempts: number;
};

// Idempotent per (kind, user, slot): re-enqueueing the same slot is a no-op, which is
// what makes a retried dispatch or a retried generate job safe.
export async function enqueueJob(job: {
  kind: JobKind;
  userId: string;
  scheduledFor: Date;
  runAfter?: Date;
}): Promise<boolean> {
  const inserted = await db
    .insert(jobs)
    .values({ kind: job.kind, userId: job.userId, scheduledFor: job.scheduledFor, runAfter: job.runAfter ?? new Date() })
    .onConflictDoNothing()
    .returning({ id: jobs.id });
  return inserted.length > 0;
}

// Claims up to `limit` runnable jobs. FOR UPDATE SKIP LOCKED means concurrent workers
// never block on, or double-claim, the same row. Runnable = pending and due, or running
// with an expired lease (its worker died). Jobs that already burned MAX_ATTEMPTS leases
// are failed instead of being retried forever.
// `userIds` restricts the claim to those users' jobs; the worker route never sets it, tests do so
// they can never pick up (and run) someone else's real job in a shared dev database.
export async function claimJobs(limit: number, opts: { lockMs?: number; userIds?: string[] } = {}): Promise<ClaimedJob[]> {
  await db
    .update(jobs)
    .set({ status: "failed", lastError: "worker lease expired after the final attempt", finishedAt: new Date() })
    .where(and(eq(jobs.status, "running"), sql`${jobs.lockedUntil} < now()`, sql`${jobs.attempts} >= ${MAX_ATTEMPTS}`));

  const lockMs = opts.lockMs ?? LOCK_MS;
  const userFilter = opts.userIds ? sql`AND user_id IN (${sql.join(opts.userIds.map((id) => sql`${id}::uuid`), sql`, `)})` : sql``;
  const rows = await db.execute<{ id: string; kind: JobKind; user_id: string; scheduled_for: Date; attempts: number }>(sql`
    UPDATE jobs
    SET status = 'running',
        attempts = attempts + 1,
        locked_until = now() + (${lockMs} * interval '1 millisecond')
    WHERE id IN (
      SELECT id FROM jobs
      WHERE attempts < ${MAX_ATTEMPTS}
        AND ((status = 'pending' AND run_after <= now())
          OR (status = 'running' AND locked_until < now()))
        ${userFilter}
      ORDER BY run_after ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, kind, user_id, scheduled_for, attempts
  `);

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    userId: r.user_id,
    scheduledFor: new Date(r.scheduled_for),
    attempts: r.attempts,
  }));
}

export async function completeJob(id: string): Promise<void> {
  await db.update(jobs).set({ status: "done", lockedUntil: null, lastError: null, finishedAt: new Date() }).where(eq(jobs.id, id));
}

// Retries with a growing delay until the attempt cap, then fails for good. `attempts`
// was already incremented when the job was claimed.
export async function failJob(job: Pick<ClaimedJob, "id" | "attempts">, error: string): Promise<"retry" | "failed"> {
  if (job.attempts >= MAX_ATTEMPTS) {
    await db.update(jobs).set({ status: "failed", lockedUntil: null, lastError: error, finishedAt: new Date() }).where(eq(jobs.id, job.id));
    return "failed";
  }
  const delayMs = job.attempts * 60_000;
  await db
    .update(jobs)
    .set({ status: "pending", lockedUntil: null, lastError: error, runAfter: new Date(Date.now() + delayMs) })
    .where(eq(jobs.id, job.id));
  return "retry";
}

export async function queueDepth(): Promise<{ pending: number; running: number; failed: number }> {
  const rows = await db.execute<{ status: string; n: number }>(
    sql`SELECT status, count(*)::int AS n FROM jobs WHERE status IN ('pending','running','failed') GROUP BY status`,
  );
  const by = new Map(rows.map((r) => [r.status, r.n]));
  return { pending: by.get("pending") ?? 0, running: by.get("running") ?? 0, failed: by.get("failed") ?? 0 };
}

// Jobs a worker could claim right now (due pending jobs, or running ones whose lease lapsed).
export async function runnableJobCount(): Promise<number> {
  const [row] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM jobs
    WHERE attempts < ${MAX_ATTEMPTS}
      AND ((status = 'pending' AND run_after <= now()) OR (status = 'running' AND locked_until < now()))
  `);
  return row?.n ?? 0;
}

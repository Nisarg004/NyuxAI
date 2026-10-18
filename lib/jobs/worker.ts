import { runJob } from "./handlers";
import { claimJobs, completeJob, failJob, type ClaimedJob } from "./queue";

export type WorkerResult = {
  claimed: number;
  done: number;
  retried: number;
  failed: number;
  durationMs: number;
  jobs: { id: string; kind: string; userId: string; outcome: "done" | "retry" | "failed"; note?: string }[];
};

// One worker invocation: repeatedly claim a small batch and run it until the queue is
// empty or there isn't enough of the time budget left to start another pipeline (a
// generate job takes ~30-60s). Several invocations run in parallel, each in its own
// serverless function, which is what makes throughput scale with the fan-out.
export async function runWorker(
  opts: { budgetMs?: number; concurrency?: number; minRemainingMs?: number; userIds?: string[] } = {},
): Promise<WorkerResult> {
  const { budgetMs = 270_000, concurrency = 2, minRemainingMs = 90_000 } = opts;
  const started = Date.now();
  const result: WorkerResult = { claimed: 0, done: 0, retried: 0, failed: 0, durationMs: 0, jobs: [] };

  const handle = async (job: ClaimedJob) => {
    let outcome: "done" | "retry" | "failed";
    let note: string | undefined;
    try {
      const r = await runJob(job);
      if (r.ok) {
        await completeJob(job.id);
        outcome = "done";
        note = r.note;
      } else {
        outcome = await failJob(job, r.error);
        note = r.error;
      }
    } catch (err) {
      note = err instanceof Error ? err.message : String(err);
      console.error(`[worker] job ${job.id} (${job.kind}) threw: ${note}`);
      outcome = await failJob(job, note);
    }
    result[outcome === "done" ? "done" : outcome === "retry" ? "retried" : "failed"] += 1;
    result.jobs.push({ id: job.id, kind: job.kind, userId: job.userId, outcome, note });
  };

  while (Date.now() - started < budgetMs - minRemainingMs) {
    const batch = await claimJobs(concurrency, { userIds: opts.userIds });
    if (batch.length === 0) break;
    result.claimed += batch.length;
    await Promise.all(batch.map(handle));
  }

  result.durationMs = Date.now() - started;
  return result;
}

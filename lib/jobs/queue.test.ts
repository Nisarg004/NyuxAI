import { test, after } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs, users } from "@/lib/db/schema";
import { claimJobs, completeJob, enqueueJob, failJob, MAX_ATTEMPTS } from "@/lib/jobs/queue";

// DB-integration tests against DATABASE_URL. Each test uses its own throwaway user, and
// its jobs are due in 2019 so they sort ahead of any real queued job in the claim order;
// assertions only look at our own user's jobs.
const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const skip = DB_AVAILABLE ? false : "DATABASE_URL not set";
const userIds: string[] = [];

async function makeUser(label: string): Promise<string> {
  const [u] = await db
    .insert(users)
    .values({ email: `queue-${label}+${Date.now()}-${Math.random()}@brieff.invalid`, name: "Queue Test" })
    .returning({ id: users.id });
  userIds.push(u.id);
  return u.id;
}

const SLOT = new Date("2019-01-01T00:00:00.000Z");

after(async () => {
  if (DB_AVAILABLE && userIds.length > 0) await db.delete(users).where(inArray(users.id, userIds)); // cascades jobs
  await db.$client.end();
});

test("enqueue is idempotent per (kind, user, slot)", { skip }, async () => {
  const userId = await makeUser("idem");
  assert.equal(await enqueueJob({ kind: "generate", userId, scheduledFor: SLOT, runAfter: SLOT }), true);
  assert.equal(await enqueueJob({ kind: "generate", userId, scheduledFor: SLOT, runAfter: SLOT }), false);
  assert.equal(await enqueueJob({ kind: "send", userId, scheduledFor: SLOT, runAfter: SLOT }), true, "a different kind is a different job");
});

test("two workers racing for one job: exactly one claims it", { skip }, async () => {
  const userId = await makeUser("race");
  await enqueueJob({ kind: "generate", userId, scheduledFor: SLOT, runAfter: SLOT });

  const [a, b] = await Promise.all([claimJobs(5, { userIds: [userId] }), claimJobs(5, { userIds: [userId] })]);
  const mine = [...a, ...b].filter((j) => j.userId === userId);
  assert.equal(mine.length, 1, "the job must be claimed exactly once");
  assert.equal(mine[0].attempts, 1);
});

test("a job whose lease expired is reclaimed with attempts incremented", { skip }, async () => {
  const userId = await makeUser("expired");
  await enqueueJob({ kind: "generate", userId, scheduledFor: SLOT, runAfter: SLOT });

  const first = (await claimJobs(5, { lockMs: 1, userIds: [userId] })).filter((j) => j.userId === userId);
  assert.equal(first.length, 1);
  await new Promise((r) => setTimeout(r, 20)); // let the 1ms lease lapse (the worker "died")

  const second = (await claimJobs(5, { userIds: [userId] })).filter((j) => j.userId === userId);
  assert.equal(second.length, 1, "an expired lease must make the job claimable again");
  assert.equal(second[0].attempts, 2);
});

test("a live lease is not reclaimed", { skip }, async () => {
  const userId = await makeUser("live");
  await enqueueJob({ kind: "generate", userId, scheduledFor: SLOT, runAfter: SLOT });
  assert.equal((await claimJobs(5, { userIds: [userId] })).filter((j) => j.userId === userId).length, 1);
  assert.equal((await claimJobs(5, { userIds: [userId] })).filter((j) => j.userId === userId).length, 0);
});

test("a failing job is retried with backoff, then failed permanently at the cap", { skip }, async () => {
  const userId = await makeUser("cap");
  await enqueueJob({ kind: "generate", userId, scheduledFor: SLOT, runAfter: SLOT });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Make the retry due now (failJob schedules it in the future).
    await db.update(jobs).set({ runAfter: new Date(0) }).where(eq(jobs.userId, userId));
    const [job] = (await claimJobs(5, { userIds: [userId] })).filter((j) => j.userId === userId);
    assert.ok(job, `attempt ${attempt} should be claimable`);
    assert.equal(job.attempts, attempt);
    const outcome = await failJob(job, `boom ${attempt}`);
    assert.equal(outcome, attempt < MAX_ATTEMPTS ? "retry" : "failed");
  }

  const [row] = await db.select().from(jobs).where(eq(jobs.userId, userId));
  assert.equal(row.status, "failed");
  assert.equal(row.lastError, `boom ${MAX_ATTEMPTS}`);
  assert.equal((await claimJobs(5, { userIds: [userId] })).filter((j) => j.userId === userId).length, 0, "failed jobs are never claimed");
});

test("a job that dies on its final attempt is failed by the next claim sweep, not retried", { skip }, async () => {
  const userId = await makeUser("dead");
  await enqueueJob({ kind: "generate", userId, scheduledFor: SLOT, runAfter: SLOT });
  await db.update(jobs).set({ status: "running", attempts: MAX_ATTEMPTS, lockedUntil: new Date(Date.now() - 1000) }).where(eq(jobs.userId, userId));

  assert.equal((await claimJobs(5, { userIds: [userId] })).filter((j) => j.userId === userId).length, 0);
  const [row] = await db.select().from(jobs).where(eq(jobs.userId, userId));
  assert.equal(row.status, "failed");
});

test("completeJob marks done", { skip }, async () => {
  const userId = await makeUser("done");
  await enqueueJob({ kind: "send", userId, scheduledFor: SLOT, runAfter: SLOT });
  const [job] = (await claimJobs(5, { userIds: [userId] })).filter((j) => j.userId === userId);
  await completeJob(job.id);
  const [row] = await db.select().from(jobs).where(eq(jobs.id, job.id));
  assert.equal(row.status, "done");
  assert.ok(row.finishedAt);
});

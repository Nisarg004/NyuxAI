import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { digestItems, digests, jobs, preferences, users } from "@/lib/db/schema";
import { runDispatch } from "@/lib/cron/dispatch";
import { claimJobs } from "@/lib/jobs/queue";
import { runWorker } from "@/lib/jobs/worker";

// End-to-end through the real database, with email sending stubbed to a log line
// (RESEND_API_KEY empty) and a fake "now" in 2018 so only these rows count as due.
const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const skip = DB_AVAILABLE ? false : "DATABASE_URL not set";
const NOW = new Date("2018-06-01T05:00:00.000Z");
const MIN = 60_000;
const ids: string[] = [];

async function makeUser(label: string, nextRunAt: Date, opts: { active?: boolean } = {}) {
  const [u] = await db
    .insert(users)
    .values({ email: `worker-${label}+${Date.now()}-${Math.random()}@brieff.invalid`, name: "Worker Test", emailVerifiedAt: new Date() })
    .returning({ id: users.id });
  ids.push(u.id);
  await db.insert(preferences).values({
    userId: u.id,
    sectors: ["technology"],
    deliveryHour: 8,
    deliveryMinute: 0,
    timezone: "UTC",
    nextRunAt,
    isActive: opts.active ?? true,
  });
  return u.id;
}

before(() => {
  process.env.RESEND_API_KEY = "";
  process.env.CRON_SECRET ??= "test-secret";
});

after(async () => {
  if (DB_AVAILABLE && ids.length > 0) await db.delete(users).where(inArray(users.id, ids));
  await db.$client.end();
});

test("dispatch enqueues users inside the lead window only, rolls the slot forward from the slot itself", { skip }, async () => {
  const slot = new Date(NOW.getTime() + 30 * MIN); // 05:30 — inside the 45 min lead
  const soon = await makeUser("soon", slot);
  const later = await makeUser("later", new Date(NOW.getTime() + 120 * MIN)); // outside the lead

  const result = await runDispatch({ now: NOW });
  const mine = result.processed.filter((p) => p.email.startsWith("worker-soon"));
  assert.equal(mine.length, 1);
  assert.deepEqual([mine[0].claimed, mine[0].enqueued], [true, true]);
  assert.ok(!result.processed.some((p) => p.email.startsWith("worker-later")), "outside the lead window");

  const [job] = await db.select().from(jobs).where(eq(jobs.userId, soon));
  assert.equal(job.kind, "generate");
  assert.equal(job.scheduledFor.toISOString(), slot.toISOString());
  assert.equal((await db.select().from(jobs).where(eq(jobs.userId, later))).length, 0);

  // next_run_at moved to the slot AFTER the one just enqueued (08:00 the following day relative to 05:30 is 08:00 same day,
  // so the key property is simply: strictly later than the enqueued slot).
  const [prefs] = await db.select().from(preferences).where(eq(preferences.userId, soon));
  assert.ok(prefs.nextRunAt && prefs.nextRunAt > slot);

  // A second dispatch tick is a no-op for this user: the slot is already rolled forward.
  const again = await runDispatch({ now: NOW });
  assert.ok(!again.processed.some((p) => p.email.startsWith("worker-soon")));
});

test("a due send job is delivered by the worker and marked sent; a retry does not re-send", { skip }, async () => {
  const userId = await makeUser("send", new Date(NOW.getTime() + 24 * 60 * MIN));
  const slot = new Date("2018-06-01T08:00:00.000Z");
  const [digest] = await db.insert(digests).values({ userId, scheduledFor: slot, status: "ready", runMeta: { editorsNote: "A note." } }).returning({ id: digests.id });
  await db.insert(digestItems).values({ digestId: digest.id, sector: "technology", headline: "H", summary: "S", whyItMatters: "W", sourceUrl: "https://example.com/a", rank: 1 });
  await db.insert(jobs).values({ kind: "send", userId, scheduledFor: slot, runAfter: new Date(0) });

  const result = await runWorker({ minRemainingMs: 0, budgetMs: 30_000, userIds: [userId] });
  const mine = result.jobs.filter((j) => j.userId === userId);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].outcome, "done");
  assert.match(mine[0].note ?? "", /sent to/);

  const [row] = await db.select().from(digests).where(eq(digests.id, digest.id));
  assert.equal(row.status, "sent");
  assert.ok(row.html?.includes("/unsubscribe?t="), "stored email must carry the unsubscribe link");

  // Same job re-run (e.g. a crash after sending, before completeJob): idempotent skip.
  await db.update(jobs).set({ status: "pending", runAfter: new Date(0), attempts: 0 }).where(and(eq(jobs.userId, userId), eq(jobs.kind, "send")));
  const retry = await runWorker({ minRemainingMs: 0, budgetMs: 30_000, userIds: [userId] });
  const again = retry.jobs.find((j) => j.userId === userId);
  assert.match(again?.note ?? "", /already sent/);
});

test("a send job for a user who unsubscribed after generation is skipped, not sent", { skip }, async () => {
  const userId = await makeUser("unsub", new Date(NOW.getTime() + 24 * 60 * MIN), { active: false });
  const slot = new Date("2018-06-02T08:00:00.000Z");
  const [digest] = await db.insert(digests).values({ userId, scheduledFor: slot, status: "ready" }).returning({ id: digests.id });
  await db.insert(digestItems).values({ digestId: digest.id, sector: "technology", headline: "H", summary: "S", whyItMatters: "W", sourceUrl: "https://example.com/b", rank: 1 });
  await db.insert(jobs).values({ kind: "send", userId, scheduledFor: slot, runAfter: new Date(0) });

  const result = await runWorker({ minRemainingMs: 0, budgetMs: 30_000, userIds: [userId] });
  const mine = result.jobs.find((j) => j.userId === userId);
  assert.match(mine?.note ?? "", /inactive/);
  const [row] = await db.select().from(digests).where(eq(digests.id, digest.id));
  assert.equal(row.status, "ready", "must not be marked sent");
});

test("a send job is not claimable before its slot", { skip }, async () => {
  const userId = await makeUser("early", new Date(NOW.getTime() + 24 * 60 * MIN));
  await db.insert(jobs).values({ kind: "send", userId, scheduledFor: new Date("2018-06-03T08:00:00Z"), runAfter: new Date(Date.now() + 60 * MIN) });
  assert.equal((await claimJobs(50, { userIds: [userId] })).filter((j) => j.userId === userId).length, 0);
});

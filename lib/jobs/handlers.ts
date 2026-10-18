import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { digests, preferences, users } from "@/lib/db/schema";
import { generateDigest } from "@/lib/agents/pipeline";
import { deliverDigest } from "@/lib/email/deliver";
import { enqueueJob, type ClaimedJob } from "./queue";

export type JobOutcome = { ok: true; note?: string } | { ok: false; error: string };

async function findDigest(userId: string, scheduledFor: Date) {
  const [digest] = await db
    .select({ id: digests.id, status: digests.status })
    .from(digests)
    .where(and(eq(digests.userId, userId), eq(digests.scheduledFor, scheduledFor)));
  return digest ?? null;
}

// Whether this user should still be mailed *now*. Re-checked at run time because a
// job can sit queued for up to 45 minutes after the dispatcher claimed the slot, and
// the user may have unsubscribed (or bounced) in the meantime.
async function recipientState(userId: string): Promise<"ok" | "inactive" | "suppressed" | "gone"> {
  const [row] = await db
    .select({ isActive: preferences.isActive, emailStatus: users.emailStatus })
    .from(users)
    .innerJoin(preferences, eq(preferences.userId, users.id))
    .where(eq(users.id, userId));
  if (!row) return "gone";
  if (!row.isActive) return "inactive";
  if (row.emailStatus !== "ok") return "suppressed";
  return "ok";
}

// Generates the digest for a slot ahead of time, then queues the send for the slot
// itself. Safe to retry: an existing digest for the slot short-circuits generation.
async function runGenerate(job: ClaimedJob): Promise<JobOutcome> {
  const state = await recipientState(job.userId);
  if (state !== "ok") return { ok: true, note: `skipped: recipient is ${state}` };

  let digest = await findDigest(job.userId, job.scheduledFor);
  if (!digest) {
    const result = await generateDigest(job.userId, { dryRun: false, scheduledFor: job.scheduledFor });
    if (!result.success) return { ok: false, error: result.error };
    digest = await findDigest(job.userId, job.scheduledFor);
  }
  if (!digest) return { ok: true, note: "nothing approved; no digest to send" };

  // Due at the slot itself (or immediately if the slot has already passed).
  await enqueueJob({ kind: "send", userId: job.userId, scheduledFor: job.scheduledFor, runAfter: job.scheduledFor });
  return { ok: true };
}

async function runSend(job: ClaimedJob): Promise<JobOutcome> {
  const state = await recipientState(job.userId);
  if (state !== "ok") return { ok: true, note: `skipped: recipient is ${state}` };

  const digest = await findDigest(job.userId, job.scheduledFor);
  if (!digest) return { ok: true, note: "no digest for this slot" };

  const delivery = await deliverDigest(digest.id);
  if (delivery.status === "failed") return { ok: false, error: delivery.error };
  if (delivery.status === "skipped") return { ok: true, note: `skipped: ${delivery.reason}` };
  return { ok: true, note: `sent to ${delivery.to}` };
}

export async function runJob(job: ClaimedJob): Promise<JobOutcome> {
  return job.kind === "generate" ? runGenerate(job) : runSend(job);
}


import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences, users } from "@/lib/db/schema";
import { generateDigest } from "@/lib/agents/pipeline";
import { deliverDigest } from "@/lib/email/deliver";
import { isAuthorizedCronCaller } from "@/lib/internal-api";

// The actual pipeline + email send; a multi-sector user's run has taken over
// 40s even for 2 sectors in live testing. 300s is Vercel's ceiling on Hobby
// (with Fluid Compute) — set explicitly, not left as an implicit default.
export const maxDuration = 300;

// Requires the CRON_SECRET bearer token — see lib/internal-api.ts. This is the
// endpoint that actually runs the pipeline and sends email; it takes userId
// explicitly rather than trusting a session cookie, so it's equally usable by
// this app's own session-gated proxy (app/api/digest/send-now/route.ts) and by
// a future cron dispatcher. Nothing browser-facing calls this directly.
export async function POST(request: Request) {
  if (!isAuthorizedCronCaller(request)) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { userId?: unknown; scheduledFor?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = typeof body.userId === "string" ? body.userId : null;
  if (!userId) {
    return new Response(JSON.stringify({ success: false, error: "userId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Optional — a cron dispatcher passes the slot it's filling so the digests
  // unique index on (user_id, scheduled_for) can reject a double-send. The
  // browser proxy never sends this, so send-now keeps getting a fresh timestamp.
  const scheduledFor = typeof body.scheduledFor === "string" ? new Date(body.scheduledFor) : undefined;
  if (scheduledFor && Number.isNaN(scheduledFor.getTime())) {
    return new Response(JSON.stringify({ success: false, error: "scheduledFor is not a valid date" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        const [prefs] = await db.select().from(preferences).where(eq(preferences.userId, userId));
        if (!user || !prefs) {
          send({ type: "error", error: `No user or preferences found for userId ${userId}` });
          controller.close();
          return;
        }

        // A bounced/complained address must never be mailed again. Checked before the
        // pipeline so a suppressed user also costs no LLM tokens.
        if (user.emailStatus !== "ok") {
          send({ type: "done", runId: null, digestId: null, sent: false, note: `Email address is suppressed (${user.emailStatus}); skipping.` });
          controller.close();
          return;
        }

        const result = await generateDigest(userId, {
          dryRun: false,
          onStage: (entry) => send({ type: "stage", entry }),
          scheduledFor,
        });

        if (!result.success) {
          send({ type: "error", runId: result.runId, error: result.error });
          controller.close();
          return;
        }

        if (result.skipped) {
          send({ type: "done", runId: result.runId, digestId: null, sent: false, note: "A digest for this scheduled slot already exists; skipping." });
          controller.close();
          return;
        }

        if (!result.digestId || result.items.length === 0) {
          send({ type: "done", runId: result.runId, digestId: result.digestId, sent: false, note: "No items were approved; nothing to send." });
          controller.close();
          return;
        }

        send({ type: "stage", entry: { stage: "email", event: "start", at: new Date().toISOString(), to: user.email } });

        const delivery = await deliverDigest(result.digestId);

        if (delivery.status === "failed") {
          send({ type: "stage", entry: { stage: "email", event: "finish", status: "failed", error: delivery.error } });
          send({ type: "error", runId: result.runId, digestId: result.digestId, error: `Email send failed: ${delivery.error}` });
          controller.close();
          return;
        }

        if (delivery.status === "skipped") {
          send({ type: "done", runId: result.runId, digestId: result.digestId, sent: false, note: `Not sent: ${delivery.reason}.` });
          controller.close();
          return;
        }

        send({ type: "stage", entry: { stage: "email", event: "finish", at: delivery.sentAt.toISOString(), status: "ok", to: delivery.to, emailId: delivery.emailId } });
        send({ type: "done", runId: result.runId, digestId: result.digestId, sent: true, sentTo: delivery.to, subject: delivery.subject });
        controller.close();
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        send({ type: "error", error });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

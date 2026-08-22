import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { digests, preferences, users } from "@/lib/db/schema";
import { generateDigest } from "@/lib/agents/pipeline";
import { renderDigestEmail } from "@/lib/email/render";
import { resend, EMAIL_FROM } from "@/lib/email/client";
import type { DigestEmailItem, DigestEmailSector } from "@/lib/email/digest-email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Seeds every sector the user is subscribed to, not just the ones with items —
// a sector that approved nothing still gets an explicit empty entry so the
// template can say so rather than silently omitting the section.
function groupBySector(
  sectors: string[],
  items: { sector: string; headline: string; summary: string; why_it_matters: string; source_url: string }[]
): DigestEmailSector[] {
  const bySector = new Map<string, DigestEmailItem[]>();
  for (const sector of sectors) {
    bySector.set(sector, []);
  }

  for (const item of items) {
    bySector.get(item.sector)?.push({
      headline: item.headline,
      summary: item.summary,
      whyItMatters: item.why_it_matters,
      sourceUrl: item.source_url,
    });
  }

  return sectors.map((sector) => ({ sector, items: bySector.get(sector) ?? [] }));
}

export async function POST(request: Request) {
  const body = await request.json();
  const userId = typeof body.userId === "string" ? body.userId : null;
  if (!userId) {
    return new Response(JSON.stringify({ success: false, error: "userId is required" }), {
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

        const result = await generateDigest(userId, {
          dryRun: false,
          onStage: (entry) => send({ type: "stage", entry }),
        });

        if (!result.success) {
          send({ type: "error", runId: result.runId, error: result.error });
          controller.close();
          return;
        }

        if (!result.digestId || result.items.length === 0) {
          send({ type: "done", runId: result.runId, digestId: result.digestId, sent: false, note: "No items were approved; nothing to send." });
          controller.close();
          return;
        }

        const { html, subject } = await renderDigestEmail({
          userName: user.name,
          sentAt: new Date(),
          timezone: prefs.timezone,
          sectors: prefs.sectors,
          editorsNote: result.editorsNote,
          sectorGroups: groupBySector(prefs.sectors, result.items),
          archiveUrl: `${APP_URL}/archive/${result.digestId}`,
          preferencesUrl: `${APP_URL}/dashboard`,
        });

        send({ type: "stage", entry: { stage: "email", event: "start", at: new Date().toISOString(), to: user.email } });

        const sendResult = await resend.emails.send({ from: EMAIL_FROM, to: user.email, subject, html });

        if (sendResult.error) {
          send({ type: "stage", entry: { stage: "email", event: "finish", status: "failed", error: sendResult.error.message } });
          send({ type: "error", runId: result.runId, digestId: result.digestId, error: `Email send failed: ${sendResult.error.message}` });
          controller.close();
          return;
        }

        const sentAt = new Date();
        await db.update(digests).set({ sentAt, status: "sent", subject, html }).where(eq(digests.id, result.digestId));

        send({ type: "stage", entry: { stage: "email", event: "finish", at: sentAt.toISOString(), status: "ok", to: user.email, emailId: sendResult.data?.id } });
        send({ type: "done", runId: result.runId, digestId: result.digestId, sent: true, sentTo: user.email, subject });
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

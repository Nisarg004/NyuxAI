import { inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { suppressionFromEvent, verifyWebhookSignature } from "@/lib/email/webhook";

// Resend → us. Authenticated by the Svix signature, not CRON_SECRET (Resend can't
// send our bearer token). Fails closed if RESEND_WEBHOOK_SECRET isn't configured.
// Bounces and complaints flip users.email_status so the dispatcher stops mailing them.
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });

  const body = await request.text();
  const valid = verifyWebhookSignature({
    secret,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signatureHeader: request.headers.get("svix-signature"),
    body,
  });
  if (!valid) return new Response("Invalid signature", { status: 401 });

  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const suppression = suppressionFromEvent(event);
  if (suppression) {
    const emails = suppression.emails.map((e) => e.toLowerCase());
    await db
      .update(users)
      .set({ emailStatus: suppression.status, emailStatusUpdatedAt: new Date() })
      .where(inArray(sql`lower(${users.email})`, emails));
    console.warn(`[resend-webhook] marked ${emails.length} address(es) as ${suppression.status}`);
  }

  return new Response("ok");
}

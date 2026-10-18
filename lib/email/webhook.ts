import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;

// Resend signs webhooks with Svix: HMAC-SHA256 over `${id}.${timestamp}.${body}`,
// keyed with the base64 part of the `whsec_…` secret, sent as space-separated
// `v1,<base64>` entries in the svix-signature header (several during key rotation).
export function verifyWebhookSignature(opts: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signatureHeader: string | null;
  body: string;
  now?: number;
}): boolean {
  const { secret, id, timestamp, signatureHeader, body } = opts;
  if (!id || !timestamp || !signatureHeader) return false;

  const ts = Number(timestamp);
  const nowSeconds = Math.floor((opts.now ?? Date.now()) / 1000);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();

  return signatureHeader.split(" ").some((entry) => {
    const [version, signature] = entry.split(",");
    if (version !== "v1" || !signature) return false;
    const given = Buffer.from(signature, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export type Suppression = { status: "bounced" | "complained"; emails: string[] };

// Maps a Resend event to a suppression, or null when the event shouldn't block
// future sends. Only permanent bounces count: a transient bounce (full mailbox,
// greylisting) says nothing about whether the address is dead.
export function suppressionFromEvent(event: unknown): Suppression | null {
  if (typeof event !== "object" || event === null) return null;
  const { type, data } = event as { type?: unknown; data?: unknown };
  if (typeof data !== "object" || data === null) return null;

  const { to, bounce } = data as { to?: unknown; bounce?: { type?: unknown } };
  const emails = Array.isArray(to) ? to.filter((t): t is string => typeof t === "string") : [];
  if (emails.length === 0) return null;

  if (type === "email.complained") return { status: "complained", emails };
  if (type === "email.bounced" && bounce?.type === "Permanent") return { status: "bounced", emails };
  return null;
}

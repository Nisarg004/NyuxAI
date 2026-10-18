import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless HMAC-signed tokens for links that must work without a session (the
// unsubscribe link in an email; later, feedback links). The key is derived from
// CRON_SECRET so there is no extra env var to manage, with a fixed context string
// so the derived key is never the raw secret used for the bearer gate.
//
// Each token is bound to a `purpose`, so a token minted for one action can't be
// replayed against another endpoint.

export type LinkPayload = { purpose: string; userId: string };

function signingKey(): Buffer {
  const secret = process.env.CRON_SECRET;
  // Fail closed, same as isAuthorizedCronCaller: never sign with an empty key.
  if (!secret) throw new Error("CRON_SECRET is not set; cannot sign links");
  return createHmac("sha256", secret).update("brieff:signed-link:v1").digest();
}

function mac(body: string): Buffer {
  return createHmac("sha256", signingKey()).update(body).digest();
}

// `expiresInMs` is optional: unsubscribe links must keep working for as long as
// the email sits in an inbox, so they are minted without an expiry.
export function signLink(payload: LinkPayload, opts: { expiresInMs?: number; now?: number } = {}): string {
  const exp = opts.expiresInMs === undefined ? undefined : (opts.now ?? Date.now()) + opts.expiresInMs;
  const body = Buffer.from(JSON.stringify({ p: payload.purpose, u: payload.userId, ...(exp ? { e: exp } : {}) })).toString("base64url");
  return `${body}.${mac(body).toString("base64url")}`;
}

// Returns the payload only if the signature is valid, the purpose matches and the
// token hasn't expired; null otherwise. Never throws on malformed input.
export function verifyLink(token: string, purpose: string, now: number = Date.now()): LinkPayload | null {
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length > 0) return null;

  const expected = mac(body);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const parsed: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const { p, u, e } = parsed as { p?: unknown; u?: unknown; e?: unknown };
    if (p !== purpose || typeof u !== "string") return null;
    if (e !== undefined && (typeof e !== "number" || e < now)) return null;
    return { purpose: p, userId: u };
  } catch {
    return null;
  }
}

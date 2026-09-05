/**
 * The shared-secret gate for routes that trigger real work (LLM calls, email
 * sends, RSS fetches): /api/ingest, /api/digest/generate, /api/digest/send-now/run,
 * and /api/feedback. Each of those requires `Authorization: Bearer ${CRON_SECRET}`
 * and refuses to do anything without it — this is what makes them safe to expose
 * on a public deployment with no other auth in front of them.
 *
 * The app's own UI never sends this header from the browser. Instead, a thin
 * session-gated layer (Server Actions, or the /api/digest/send-now proxy) resolves
 * the caller's identity from their session cookie, then attaches this secret on a
 * server-to-server call to the real endpoint. See app/archive/actions.ts and
 * app/api/digest/send-now/route.ts for the two patterns.
 */
export function isAuthorizedCronCaller(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed if the secret isn't configured — never treat a missing secret
  // as "no check required".
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Base URL for a server-to-server call back into this same deployment. Prefers
 * Vercel's auto-provided VERCEL_URL (always correct for the current deployment,
 * including previews) over the manually-configured NEXT_PUBLIC_APP_URL, which
 * can lag behind right after a deploy.
 */
export function getInternalBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function cronSecretHeader(): Record<string, string> {
  return { Authorization: `Bearer ${process.env.CRON_SECRET}` };
}

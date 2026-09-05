import { getSessionUserId } from "@/lib/session";
import { cronSecretHeader, getInternalBaseUrl } from "@/lib/internal-api";

/**
 * The browser's entry point for "Send now" — unchanged contract (POST, no
 * body, streams text/event-stream) so lib/hooks/use-send-now.ts needs no
 * changes. This route only resolves the session and re-issues the request to
 * /run with the CRON_SECRET attached, piping the SSE stream straight through.
 * /run is the endpoint that actually does the work and is the one that
 * requires the secret — see lib/internal-api.ts.
 */
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response(JSON.stringify({ success: false, error: "No session" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstream = await fetch(`${getInternalBaseUrl()}/api/digest/send-now/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cronSecretHeader() },
    body: JSON.stringify({ userId }),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}

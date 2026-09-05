"use server";

import { getSessionUserId } from "@/lib/session";
import { cronSecretHeader, getInternalBaseUrl } from "@/lib/internal-api";

/**
 * The client-facing entry point for feedback. /api/feedback itself requires
 * the CRON_SECRET bearer token and never sees a browser directly — this action
 * resolves the caller's session server-side, then attaches the secret on a
 * server-to-server call. The browser only ever calls this action.
 */
export async function submitFeedback(
  digestItemId: string,
  signal: "up" | "down" | "save"
): Promise<{ success: boolean; id?: string; error?: string }> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { success: false, error: "No session" };
  }

  const res = await fetch(`${getInternalBaseUrl()}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cronSecretHeader() },
    body: JSON.stringify({ userId, digestItemId, signal }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    return { success: false, error: data.error ?? "Feedback failed to save" };
  }
  return { success: true, id: data.id };
}

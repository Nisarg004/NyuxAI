import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { digestItems, digests, feedback } from "@/lib/db/schema";
import { isAuthorizedCronCaller } from "@/lib/internal-api";
import { countSignalsSinceProfileUpdate, regenerateFeedbackProfile } from "@/lib/agents/feedback-profile";

const VALID_SIGNALS = new Set(["up", "down", "save"]);

// Requires the CRON_SECRET bearer token — see lib/internal-api.ts. The browser
// never calls this directly; app/archive/actions.ts resolves the session and
// attaches the secret on the app's behalf.
export async function POST(request: Request) {
  if (!isAuthorizedCronCaller(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId : null;
  const digestItemId = typeof body.digestItemId === "string" ? body.digestItemId : null;
  const signal = typeof body.signal === "string" ? body.signal : null;

  if (!userId || !digestItemId || !signal || !VALID_SIGNALS.has(signal)) {
    return Response.json(
      { success: false, error: "userId, digestItemId, and a valid signal are required" },
      { status: 400 }
    );
  }

  const [item] = await db
    .select({ id: digestItems.id })
    .from(digestItems)
    .innerJoin(digests, eq(digestItems.digestId, digests.id))
    .where(and(eq(digestItems.id, digestItemId), eq(digests.userId, userId)));
  if (!item) {
    return Response.json({ success: false, error: "Unknown digest item" }, { status: 404 });
  }

  const [row] = await db
    .insert(feedback)
    .values({ userId, digestItemId, signal: signal as "up" | "down" | "save" })
    .returning({ id: feedback.id });

  try {
    const sinceCount = await countSignalsSinceProfileUpdate(userId);
    if (sinceCount >= 3) {
      await regenerateFeedbackProfile(userId);
    }
  } catch (err) {
    console.error(
      `[feedback] profile regeneration failed for userId=${userId}, feedbackId=${row.id}:`,
      err
    );
  }

  return Response.json({ success: true, id: row.id });
}

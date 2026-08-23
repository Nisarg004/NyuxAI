import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { digestItems, feedback } from "@/lib/db/schema";
import { getSessionUserId } from "@/lib/session";

const VALID_SIGNALS = new Set(["up", "down", "save"]);

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return Response.json({ success: false, error: "No session" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const digestItemId = typeof body.digestItemId === "string" ? body.digestItemId : null;
  const signal = typeof body.signal === "string" ? body.signal : null;

  if (!digestItemId || !signal || !VALID_SIGNALS.has(signal)) {
    return Response.json({ success: false, error: "digestItemId and a valid signal are required" }, { status: 400 });
  }

  const [item] = await db.select({ id: digestItems.id }).from(digestItems).where(eq(digestItems.id, digestItemId));
  if (!item) {
    return Response.json({ success: false, error: "Unknown digest item" }, { status: 404 });
  }

  const [row] = await db
    .insert(feedback)
    .values({ userId, digestItemId, signal: signal as "up" | "down" | "save" })
    .returning({ id: feedback.id });

  return Response.json({ success: true, id: row.id });
}

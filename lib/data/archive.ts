import { and, eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { digestItems, digests, feedback, runs } from "@/lib/db/schema";
import { extractRejectionsBySector } from "@/lib/rejections";
import { SECTORS } from "@/lib/sectors";

export async function getDigestDetail(digestId: string, userId: string) {
  const [digest] = await db.select().from(digests).where(and(eq(digests.id, digestId), eq(digests.userId, userId)));
  if (!digest) return null;

  const items = await db.select().from(digestItems).where(eq(digestItems.digestId, digestId));

  let stageLog: unknown[] = [];
  let sectorsAtSend: string[] = SECTORS.filter((s) => items.some((i) => i.sector === s));
  const runId = (digest.runMeta as { runId?: string } | null)?.runId;
  if (runId) {
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));
    if (run?.stageLog) {
      stageLog = run.stageLog as unknown[];
      const curatorStart = stageLog.find(
        (e) => typeof e === "object" && e !== null && (e as Record<string, unknown>).stage === "curator" && (e as Record<string, unknown>).event === "start"
      ) as Record<string, unknown> | undefined;
      if (Array.isArray(curatorStart?.sectors)) {
        sectorsAtSend = curatorStart.sectors as string[];
      }
    }
  }

  const rejectionsBySector = extractRejectionsBySector(stageLog);

  const itemsBySector = sectorsAtSend.map((sector) => ({
    sector,
    items: items.filter((i) => i.sector === sector).sort((a, b) => a.rank - b.rank),
  }));

  const feedbackRows = items.length
    ? await db.select().from(feedback).where(eq(feedback.userId, userId)).orderBy(asc(feedback.createdAt))
    : [];
  const itemIds = new Set(items.map((i) => i.id));
  const existingFeedback: Record<string, "up" | "down" | "save"> = {};
  for (const row of feedbackRows) {
    if (itemIds.has(row.digestItemId)) existingFeedback[row.digestItemId] = row.signal;
  }

  return { digest, itemsBySector, rejectionsBySector, existingFeedback };
}

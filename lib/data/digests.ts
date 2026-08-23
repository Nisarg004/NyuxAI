import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { digestItems, digests } from "@/lib/db/schema";

export async function getRecentDigests(userId: string, limit = 10) {
  return db
    .select({
      id: digests.id,
      scheduledFor: digests.scheduledFor,
      sentAt: digests.sentAt,
      status: digests.status,
      subject: digests.subject,
      runMeta: digests.runMeta,
    })
    .from(digests)
    .where(eq(digests.userId, userId))
    .orderBy(desc(digests.scheduledFor))
    .limit(limit);
}

export async function getItemCountsByDigest(digestIds: string[]): Promise<Record<string, number>> {
  if (digestIds.length === 0) return {};
  const rows = await db
    .select({ digestId: digestItems.digestId })
    .from(digestItems);
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!digestIds.includes(row.digestId)) continue;
    counts[row.digestId] = (counts[row.digestId] ?? 0) + 1;
  }
  return counts;
}

import { desc, eq, inArray } from "drizzle-orm";
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

export type DigestSummary = {
  id: string;
  scheduledFor: Date;
  sentAt: Date | null;
  status: string;
  /** Top item headlines, ranked, for scanning the index without opening a brief. */
  headlines: string[];
  itemCount: number;
};

/** Recent digests, each with its top headlines and item count — enough to tell
 * from the list alone which past brief is worth opening. */
export async function getDigestSummaries(userId: string, limit = 10): Promise<DigestSummary[]> {
  const rows = await db
    .select({
      id: digests.id,
      scheduledFor: digests.scheduledFor,
      sentAt: digests.sentAt,
      status: digests.status,
    })
    .from(digests)
    .where(eq(digests.userId, userId))
    .orderBy(desc(digests.scheduledFor))
    .limit(limit);

  if (rows.length === 0) return [];

  const items = await db
    .select({
      digestId: digestItems.digestId,
      headline: digestItems.headline,
      rank: digestItems.rank,
    })
    .from(digestItems)
    .where(inArray(digestItems.digestId, rows.map((r) => r.id)));

  const byDigest = new Map<string, { headline: string; rank: number }[]>();
  for (const item of items) {
    const arr = byDigest.get(item.digestId) ?? [];
    arr.push(item);
    byDigest.set(item.digestId, arr);
  }

  return rows.map((row) => {
    const ranked = (byDigest.get(row.id) ?? []).sort((a, b) => a.rank - b.rank);
    return {
      ...row,
      headlines: ranked.slice(0, 3).map((i) => i.headline),
      itemCount: ranked.length,
    };
  });
}

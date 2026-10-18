import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { runs, sectorEditions, type EditionItem } from "../db/schema";
import { addUsage, ZERO_USAGE, type TokenUsage } from "../llm";
import { curateAndBrief } from "./curation";

// The sector edition: what a reader who just picks "Technology" gets. It is curated once per
// sector per 12h UTC bucket for a neutral reader and then served to everyone, so adding users
// adds no model calls at all. The first reader to need a bucket's edition builds it; others
// asking at the same moment wait on a lock and read the result instead of paying again.

export const EDITION_BUCKET_MS = 12 * 60 * 60 * 1000;

// The neutral Editor rejects roughly half of briefs for lack of a concrete consequence; over-select so 5 survive.
const EDITION_EXTRA_CANDIDATES = 5;

export function bucketStart(at: Date): Date {
  return new Date(Math.floor(at.getTime() / EDITION_BUCKET_MS) * EDITION_BUCKET_MS);
}

export type SectorEdition = { sector: string; items: EditionItem[]; cached: boolean; runId: string | null };

type StageLogEntry = Record<string, unknown>;

async function buildEdition(sector: string): Promise<{ items: EditionItem[]; runId: string }> {
  const [{ id: runId }] = await db.insert(runs).values({ kind: "edition", status: "running" }).returning({ id: runs.id });
  const stageLog: StageLogEntry[] = [];
  let usage: TokenUsage = ZERO_USAGE;
  const log = (entry: StageLogEntry) => void stageLog.push(entry);
  const track = (u: TokenUsage) => {
    usage = addUsage(usage, u);
    return u;
  };
  const finish = (status: "completed" | "failed", error?: string) =>
    db.update(runs).set({ finishedAt: new Date(), status, stageLog, tokenCost: String(usage.totalTokens), ...(error ? { error } : {}) }).where(eq(runs.id, runId));

  try {
    // A neutral reader: no role, keywords or feedback, so the pool is ranked by outlet coverage and recency.
    const curated = await curateAndBrief({ sectors: [sector], roleTitle: null, keywords: [], feedbackProfile: null, extraCandidates: EDITION_EXTRA_CANDIDATES }, { log, track });
    if (!curated.ok) {
      await finish("failed", curated.error);
      throw new Error(curated.error);
    }
    if (curated.items.length === 0 && curated.failures.length > 0) {
      const error = curated.failures.map((f) => f.error).join("; ");
      await finish("failed", error);
      throw new Error(error);
    }
    const items: EditionItem[] = curated.items.map((i) => ({
      article_id: i.article_id,
      headline: i.headline,
      summary: i.summary,
      why_it_matters: i.why_it_matters,
      source_url: i.source_url,
      rank: i.rank,
    }));
    log({ stage: "pipeline", event: "finish", at: new Date().toISOString(), itemCount: items.length, kind: "edition", sector, usage });
    await finish("completed");
    return { items, runId };
  } catch (err) {
    // Already marked failed above for expected errors; this covers anything unexpected.
    await db.update(runs).set({ finishedAt: new Date(), status: "failed", stageLog, error: err instanceof Error ? err.message : String(err) }).where(and(eq(runs.id, runId), eq(runs.status, "running")));
    throw err;
  }
}

// Returns the sector's edition for the current bucket, building it if this is the first request.
// Throws if the build fails (nothing is stored, so the next request retries). An edition with
// zero items (an empty sector) is returned but not stored, for the same reason.
export async function getOrBuildSectorEdition(sector: string, at: Date = new Date()): Promise<SectorEdition> {
  const bucket = bucketStart(at);
  const read = async () => {
    const [row] = await db
      .select({ items: sectorEditions.items, runId: sectorEditions.runId })
      .from(sectorEditions)
      .where(and(eq(sectorEditions.sector, sector), eq(sectorEditions.bucketStart, bucket)));
    return row ?? null;
  };

  const hit = await read();
  if (hit) return { sector, items: hit.items, cached: true, runId: hit.runId };

  // Single-flight per (sector, bucket). The lock rides on a transaction that does nothing else;
  // the long-running build uses the normal pool, so the lock connection is held but idle.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`edition:${sector}:${bucket.toISOString()}`}))`);

    const built = await read(); // someone else may have finished while we waited for the lock
    if (built) return { sector, items: built.items, cached: true, runId: built.runId };

    const { items, runId } = await buildEdition(sector);
    if (items.length > 0) {
      await tx.insert(sectorEditions).values({ sector, bucketStart: bucket, items, runId }).onConflictDoNothing();
    }
    return { sector, items, cached: false, runId };
  });
}

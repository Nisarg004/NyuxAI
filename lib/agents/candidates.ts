import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { articles, sources } from "../db/schema";
import { cosine } from "../clustering";
import { embedTexts, ZERO_USAGE, type TokenUsage } from "../llm";

const CANDIDATE_WINDOW_MS = 24 * 60 * 60 * 1000;
// Raw rows read before dedupe/pre-filter; bounds memory now that rows carry embeddings.
const RAW_LIMIT = 500;
// Candidates handed to the Curator per sector after pre-filtering (was an arbitrary 150 total).
export const PER_SECTOR_POOL = 16;

export type CandidateArticle = {
  id: string;
  title: string;
  excerpt: string | null;
  sector: string;
  source: string;
  publishedAt: string | null;
  // How many distinct outlets covered this story (1 when unclustered).
  outlets: number;
};

export type CandidateStats = { rawCount: number; storyCount: number; prefiltered: boolean };

// Builds the pool the Curator chooses from, cheaply:
//  1. one representative per story (cross-outlet dedupe) with a "covered by N outlets" count;
//  2. the best PER_SECTOR_POOL per sector, ranked by similarity to the reader's profile when a
//     `queryText` is given (one tiny embedding call), otherwise by outlet count then recency.
// Articles not yet embedded are kept but ranked last, so a lagging ingest never empties a sector.
export async function selectCandidates(opts: {
  sectors: string[];
  queryText?: string | null;
  limit?: number;
  perSectorPool?: number;
}): Promise<{ candidates: CandidateArticle[]; stats: CandidateStats; usage: TokenUsage }> {
  const cutoff = new Date(Date.now() - CANDIDATE_WINDOW_MS);
  const pool = opts.perSectorPool ?? PER_SECTOR_POOL;

  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      excerpt: articles.excerpt,
      sector: articles.sector,
      publishedAt: articles.publishedAt,
      source: sources.name,
      storyId: articles.storyId,
      embedding: articles.embedding,
    })
    .from(articles)
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .where(and(inArray(articles.sector, opts.sectors), gte(articles.fetchedAt, cutoff)))
    .orderBy(desc(articles.publishedAt))
    .limit(RAW_LIMIT);

  const storyIds = [...new Set(rows.flatMap((r) => (r.storyId ? [r.storyId] : [])))];
  const outletCounts = new Map<string, number>();
  if (storyIds.length > 0) {
    const counts = await db
      .select({ storyId: articles.storyId, n: sql<number>`count(distinct ${articles.sourceId})::int` })
      .from(articles)
      .where(inArray(articles.storyId, storyIds))
      .groupBy(articles.storyId);
    for (const c of counts) if (c.storyId) outletCounts.set(c.storyId, c.n);
  }

  // One representative per story: the member with the fullest excerpt gives the Curator the most to judge by.
  const reps = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = row.storyId ?? row.id;
    const current = reps.get(key);
    if (!current || (row.excerpt?.length ?? 0) > (current.excerpt?.length ?? 0)) reps.set(key, row);
  }

  let queryVector: number[] | null = null;
  let usage = ZERO_USAGE;
  if (opts.queryText?.trim()) {
    const embedded = await embedTexts([opts.queryText]);
    usage = embedded.usage;
    if (embedded.ok) queryVector = embedded.vectors[0];
    else console.error(`[candidates] query embedding failed, falling back to recency ranking: ${embedded.error}`);
  }

  const total = reps.size;
  const scored = [...reps.values()].map((row, rank) => {
    const outlets = row.storyId ? (outletCounts.get(row.storyId) ?? 1) : 1;
    const score = queryVector
      ? row.embedding
        ? cosine(queryVector, row.embedding)
        : -1
      : outlets + (total - rank) / (total + 1); // outlets dominate; recency (input is newest-first) breaks ties
    return { row, outlets, score };
  });

  const picked: typeof scored = [];
  for (const sector of opts.sectors) {
    picked.push(...scored.filter((s) => s.row.sector === sector).sort((a, b) => b.score - a.score).slice(0, pool));
  }
  const capped = opts.limit !== undefined ? picked.sort((a, b) => b.score - a.score).slice(0, opts.limit) : picked;

  return {
    candidates: capped.map(({ row, outlets }) => ({
      id: row.id,
      title: row.title,
      excerpt: row.excerpt,
      sector: row.sector,
      source: row.source,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      outlets,
    })),
    stats: { rawCount: rows.length, storyCount: reps.size, prefiltered: queryVector !== null },
    usage,
  };
}

// Text that stands in for the reader when ranking candidates by embedding similarity.
export function profileQuery(p: { roleTitle: string | null; keywords: string[]; feedbackProfile: string | null }): string | null {
  const parts = [p.roleTitle, p.keywords.length > 0 ? `Interests: ${p.keywords.join(", ")}` : null, p.feedbackProfile].filter((x): x is string => Boolean(x?.trim()));
  return parts.length > 0 ? parts.join(". ") : null;
}

import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { articles, sources } from "../db/schema";
import type { TokenUsage } from "../llm";
import { ensureBriefs, type ArticleBrief } from "./article-brief";
import { profileQuery, selectCandidates } from "./candidates";
import { runCurator } from "./curator";
import type { ResearchInput } from "./researcher";

// The shared front half of every brief: pick candidates, run the Curator, make sure each
// pick has a verified shared brief, and rank the results. A per-user digest and a sector
// edition differ only in the profile they curate for and what they do with the items after.

// How many items per sector a brief carries. The Curator over-selects by EXTRA_CANDIDATES so
// that briefs the Editor rejects can be backfilled from the next-best picks.
export const ITEMS_PER_SECTOR = 5;
const EXTRA_CANDIDATES = 2;

export type CuratedItem = {
  article_id: string;
  sector: string;
  headline: string;
  // Standard-density summary and the general-reader "why it matters"; callers apply the
  // reader's depth and, for role-tuned readers, replace the line with a personalised one.
  summary: string;
  why_it_matters: string;
  source_url: string;
  rank: number;
  keyFacts: string[];
};

export type CurationHooks = {
  log: (entry: Record<string, unknown>) => void;
  track: (usage: TokenUsage) => TokenUsage;
};

export type CurationResult =
  | {
      ok: true;
      items: CuratedItem[];
      rejected: { article_id: string; reason: string }[];
      selectedCount: number;
      failures: { sector: string; error: string }[];
    }
  | { ok: false; error: string };

const now = () => new Date().toISOString();

export async function curateAndBrief(
  input: {
    sectors: string[];
    roleTitle: string | null;
    keywords: string[];
    feedbackProfile: string | null;
    maxCandidates?: number;
    itemsPerSector?: number;
    // Picks beyond itemsPerSector, to backfill briefs the Editor rejects. Shared editions can afford
    // more than a per-user run: their briefs are written once and cached for everyone.
    extraCandidates?: number;
  },
  { log, track }: CurationHooks,
): Promise<CurationResult> {
  const cap = input.itemsPerSector ?? ITEMS_PER_SECTOR;

  // --- Curator ---
  const curatorStart = Date.now();
  log({ stage: "curator", event: "start", at: now(), sectors: input.sectors, candidateLimit: input.maxCandidates ?? null });

  const pool = await selectCandidates({
    sectors: input.sectors,
    queryText: profileQuery({ roleTitle: input.roleTitle, keywords: input.keywords, feedbackProfile: input.feedbackProfile }),
    limit: input.maxCandidates,
  });
  const prefilterUsage = track(pool.usage);
  const curatorResult = await runCurator({
    roleTitle: input.roleTitle,
    keywords: input.keywords,
    feedbackProfile: input.feedbackProfile,
    sectors: input.sectors,
    candidates: pool.candidates,
    perSector: Math.min(10, cap + (input.extraCandidates ?? EXTRA_CANDIDATES)),
  });
  const curatorUsage = track(curatorResult.usage);

  if (curatorResult.degraded) {
    log({ stage: "curator", event: "finish", at: now(), durationMs: Date.now() - curatorStart, status: "degraded", error: curatorResult.error, usage: curatorUsage });
    return { ok: false, error: `Curator failed: ${curatorResult.error}` };
  }

  const selections = curatorResult.data.selected;
  log({
    stage: "curator",
    event: "finish",
    at: now(),
    durationMs: Date.now() - curatorStart,
    status: "ok",
    usage: curatorUsage,
    candidateCount: pool.candidates.length,
    rawCount: pool.stats.rawCount,
    storyCount: pool.stats.storyCount,
    prefiltered: pool.stats.prefiltered,
    prefilterUsage,
    selectedCount: selections.length,
    selections: selections.map((s) => ({ article_id: s.article_id, sector: s.sector, score: s.score, reason: s.reason })),
  });

  if (selections.length === 0) return { ok: true, items: [], rejected: [], selectedCount: 0, failures: [] };

  // --- Researcher + shared briefs: cached per article; only missing ones are researched, written, verified ---
  const articleRows = await db
    .select({ id: articles.id, title: articles.title, url: articles.url, excerpt: articles.excerpt, sector: articles.sector, source: sources.name })
    .from(articles)
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .where(inArray(articles.id, selections.map((s) => s.article_id)));

  const researchInputs: ResearchInput[] = articleRows.map((row) => ({
    articleId: row.id,
    sector: row.sector,
    title: row.title,
    url: row.url,
    source: row.source,
    excerpt: row.excerpt,
  }));

  const { briefs, failures } = await ensureBriefs(researchInputs, { log, track });
  if (failures.length > 0) {
    log({
      stage: "pipeline",
      event: "note",
      at: now(),
      message: "One or more sectors failed independently; their items are excluded but the run continues.",
      failedSectors: failures,
    });
  }

  const rejected: { article_id: string; reason: string }[] = [];
  const items = rankVerified(selections, researchInputs, briefs, cap, rejected, log);
  return { ok: true, items, rejected, selectedCount: selections.length, failures };
}

// Rank by the Curator's score and keep each sector's best verified briefs, dropping the rest.
function rankVerified(
  selections: { article_id: string; score: number }[],
  inputs: ResearchInput[],
  briefs: Map<string, ArticleBrief>,
  cap: number,
  rejected: { article_id: string; reason: string }[],
  log: CurationHooks["log"],
): CuratedItem[] {
  const sectorById = new Map(inputs.map((r) => [r.articleId.toLowerCase(), r.sector]));
  const urlById = new Map(inputs.map((r) => [r.articleId.toLowerCase(), r.url]));
  const perSector = new Map<string, number>();
  const items: CuratedItem[] = [];

  for (const sel of [...selections].sort((a, b) => b.score - a.score)) {
    const id = sel.article_id.toLowerCase();
    const brief = briefs.get(id);
    const sector = sectorById.get(id);
    if (!brief || !sector) continue; // its sector's Writer/Editor degraded; noted by the caller
    if (!brief.verified || !brief.whyItMatters) {
      rejected.push({ article_id: id, reason: brief.editorNotes ?? "Rejected by the Editor." });
      continue;
    }
    // Rule 2: nothing ships without a source_url.
    const sourceUrl = urlById.get(id);
    if (!sourceUrl) {
      rejected.push({ article_id: id, reason: "No matching source URL was found for this article_id." });
      log({ stage: "pipeline", event: "warning", at: now(), sector, article_id: id, message: "Dropped item with unresolvable source_url" });
      continue;
    }
    const rank = (perSector.get(sector) ?? 0) + 1;
    if (rank > cap) continue;
    perSector.set(sector, rank);
    items.push({
      article_id: id,
      sector,
      headline: brief.headline,
      summary: brief.summary,
      why_it_matters: brief.whyItMatters,
      source_url: sourceUrl,
      rank,
      keyFacts: brief.keyFacts,
    });
  }
  return items;
}

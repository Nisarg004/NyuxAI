import { createHash } from "node:crypto";
import Parser from "rss-parser";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { articles, runs, sources } from "./db/schema";
import { runWithConcurrency } from "./concurrency";
import { runRetention, type RetentionResult } from "./retention";
import { indexRecentArticles, type StoryIndexResult } from "./story-index";

const CONCURRENCY = 8;
const MAX_ARTICLE_AGE_MS = 48 * 60 * 60 * 1000;
const CONSECUTIVE_FAILURE_LIMIT = 3;

const parser = new Parser();

type FeedEntry = {
  stage: "feed";
  event: "finish";
  at: string;
  source: string;
  sector: string;
  status: "ok" | "failed";
  durationMs: number;
  fetched?: number;
  inserted?: number;
  skipped?: number;
  error?: string;
  consecutiveFailures?: number;
  disabled?: boolean;
};

type IngestEntry =
  | { stage: "ingest"; event: "start"; at: string; sourceCount: number }
  | {
      stage: "ingest";
      event: "finish";
      at: string;
      fetched: number;
      inserted: number;
      skipped: number;
      failedFeeds: { name: string; error: string }[];
      disabledSources: string[];
    }
  | ({ stage: "story_index"; event: "finish"; at: string } & Partial<StoryIndexResult> & { status?: "failed"; error?: string })
  | ({ stage: "retention"; event: "finish"; at: string } & RetentionResult);

type StageLogEntry = FeedEntry | IngestEntry;

export type IngestResult = {
  fetched: number;
  inserted: number;
  skipped: number;
  failedFeeds: { name: string; error: string }[];
  disabledSources: string[];
};

function normalizeContentHash(title: string, sourceUrl: string): string {
  const domain = new URL(sourceUrl).hostname;
  const normalizedTitle = title.trim().toLowerCase();
  return createHash("sha256").update(`${normalizedTitle}${domain}`).digest("hex");
}

async function fetchAndPersistFeed(source: typeof sources.$inferSelect): Promise<FeedEntry> {
  const startedAt = Date.now();

  try {
    const feed = await parser.parseURL(source.rssUrl);
    const cutoff = Date.now() - MAX_ARTICLE_AGE_MS;

    const fresh = (feed.items ?? []).filter((item) => {
      if (!item.pubDate) return true;
      const publishedAt = new Date(item.pubDate).getTime();
      return Number.isNaN(publishedAt) || publishedAt >= cutoff;
    });

    let inserted = 0;
    for (const item of fresh) {
      if (!item.title || !item.link) continue;

      const contentHash = normalizeContentHash(item.title, source.rssUrl);
      const publishedAt = item.pubDate ? new Date(item.pubDate) : null;

      const rows = await db
        .insert(articles)
        .values({
          sourceId: source.id,
          sector: source.sector,
          title: item.title,
          url: item.link,
          author: item.creator ?? item.author ?? null,
          publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
          excerpt: item.contentSnippet ?? item.content ?? null,
          contentHash,
        })
        .onConflictDoNothing({ target: articles.contentHash })
        .returning({ id: articles.id });

      if (rows.length > 0) inserted += 1;
    }

    if (source.consecutiveFailures > 0) {
      await db.update(sources).set({ consecutiveFailures: 0 }).where(eq(sources.id, source.id));
    }

    return {
      stage: "feed",
      event: "finish",
      at: new Date().toISOString(),
      source: source.name,
      sector: source.sector,
      status: "ok",
      durationMs: Date.now() - startedAt,
      fetched: fresh.length,
      inserted,
      skipped: fresh.length - inserted,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const consecutiveFailures = source.consecutiveFailures + 1;
    const disabled = consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT;

    await db
      .update(sources)
      .set({
        consecutiveFailures,
        ...(disabled ? { isActive: false } : {}),
      })
      .where(eq(sources.id, source.id));

    return {
      stage: "feed",
      event: "finish",
      at: new Date().toISOString(),
      source: source.name,
      sector: source.sector,
      status: "failed",
      durationMs: Date.now() - startedAt,
      error,
      consecutiveFailures,
      disabled,
    };
  }
}

export async function runIngest(): Promise<IngestResult> {
  const [{ id: runId }] = await db
    .insert(runs)
    .values({ kind: "ingest", status: "running" })
    .returning({ id: runs.id });

  const stageLog: StageLogEntry[] = [];
  try {
    const activeSources = await db.select().from(sources).where(eq(sources.isActive, true));
    stageLog.push({ stage: "ingest", event: "start", at: new Date().toISOString(), sourceCount: activeSources.length });

    const feedEntries: FeedEntry[] = [];
    await runWithConcurrency(activeSources, CONCURRENCY, async (source) => {
      const entry = await fetchAndPersistFeed(source);
      feedEntries.push(entry);
    });
    stageLog.push(...feedEntries);

    const fetched = feedEntries.reduce((sum, e) => sum + (e.fetched ?? 0), 0);
    const inserted = feedEntries.reduce((sum, e) => sum + (e.inserted ?? 0), 0);
    const skipped = feedEntries.reduce((sum, e) => sum + (e.skipped ?? 0), 0);
    const failedFeeds = feedEntries
      .filter((e) => e.status === "failed")
      .map((e) => ({ name: e.source, error: e.error ?? "unknown error" }));
    const disabledSources = feedEntries.filter((e) => e.disabled).map((e) => e.source);

    stageLog.push({
      stage: "ingest",
      event: "finish",
      at: new Date().toISOString(),
      fetched,
      inserted,
      skipped,
      failedFeeds,
      disabledSources,
    });

    // Embedding/clustering enriches articles but must never fail ingestion: the next run finishes
    // whatever this one could not (it works from "recent articles still missing an embedding").
    try {
      const index = await indexRecentArticles();
      stageLog.push({ stage: "story_index", event: "finish", at: new Date().toISOString(), ...index, usage: index.usage });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[ingest] story indexing failed (run ${runId}):`, err);
      stageLog.push({ stage: "story_index", event: "finish", at: new Date().toISOString(), status: "failed", error });
    }

    stageLog.push({ stage: "retention", event: "finish", at: new Date().toISOString(), ...(await runRetention()) });

    await db.update(runs).set({ finishedAt: new Date(), status: "completed", stageLog }).where(eq(runs.id, runId));

    return { fetched, inserted, skipped, failedFeeds, disabledSources };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[ingest] run ${runId} failed:`, err);
    await db.update(runs).set({ finishedAt: new Date(), status: "failed", stageLog, error }).where(eq(runs.id, runId));
    throw err;
  }
}

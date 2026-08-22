import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { articles, digestItems, digests, preferences, runs, sources, users } from "../db/schema";
import { fetchCandidateArticles, runCurator } from "./curator";
import { runEditor, type EditorInput } from "./editor";
import { runResearcher, type ResearchedItem, type ResearchInput } from "./researcher";
import { runCrossSectorNote, runWriter } from "./writer";
import type { WriterItem } from "./schemas";

type StageLogEntry = Record<string, unknown>;
type RankedItem = WriterItem & { source_url: string; rank: number };

export type GenerateDigestResult =
  | {
      success: true;
      runId: string;
      digestId: string | null;
      items: RankedItem[];
      editorsNote: string;
      rejected: { article_id: string; reason: string }[];
      stageLog: StageLogEntry[];
    }
  | { success: false; runId: string; error: string; stageLog: StageLogEntry[] };

function now() {
  return new Date().toISOString();
}

type SectorResult = {
  sector: string;
  approved: WriterItem[];
  rejected: { article_id: string; reason: string }[];
  writerError?: string;
  editorError?: string;
};

// Runs Writer -> Editor for one sector's items. Never throws — a failure in this
// sector must not take down the other sectors running alongside it.
async function runSectorPipeline(
  sector: string,
  items: ResearchedItem[],
  log: (entry: StageLogEntry) => void,
  writerInput: { userName: string; roleTitle: string | null; depth: "brief" | "standard" | "deep" }
): Promise<SectorResult> {
  try {
    const writerStart = Date.now();
    log({ stage: "writer", event: "start", at: now(), sector, itemCount: items.length });

    const writerResult = await runWriter({ ...writerInput, items });

    if (writerResult.degraded) {
      log({ stage: "writer", event: "finish", at: now(), sector, durationMs: Date.now() - writerStart, status: "degraded", error: writerResult.error });
      return { sector, approved: [], rejected: [], writerError: writerResult.error };
    }

    log({
      stage: "writer",
      event: "finish",
      at: now(),
      sector,
      durationMs: Date.now() - writerStart,
      status: "ok",
      itemCount: writerResult.data.items.length,
    });

    const sourceTextByArticleId = new Map(items.map((i) => [i.articleId, i.text]));
    const editorInputs: EditorInput[] = writerResult.data.items.map((item) => ({
      ...item,
      sourceText: sourceTextByArticleId.get(item.article_id) ?? "",
    }));

    const editorStart = Date.now();
    log({ stage: "editor", event: "start", at: now(), sector, itemCount: editorInputs.length });

    const editorResult = await runEditor(editorInputs);

    if (editorResult.degraded) {
      log({ stage: "editor", event: "finish", at: now(), sector, durationMs: Date.now() - editorStart, status: "degraded", error: editorResult.error });
      return { sector, approved: [], rejected: [], editorError: editorResult.error };
    }

    // Rejections are preserved even though they don't ship — they're a demo asset.
    log({
      stage: "editor",
      event: "finish",
      at: now(),
      sector,
      durationMs: Date.now() - editorStart,
      status: "ok",
      approvedCount: editorResult.data.approved.length,
      rejectedCount: editorResult.data.rejected.length,
      rejected: editorResult.data.rejected,
    });

    return { sector, approved: editorResult.data.approved, rejected: editorResult.data.rejected };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log({ stage: "sector_pipeline", event: "finish", at: now(), sector, status: "error", error });
    return { sector, approved: [], rejected: [], writerError: error };
  }
}

export async function generateDigest(
  userId: string,
  opts: { dryRun: boolean; onStage?: (entry: StageLogEntry) => void }
): Promise<GenerateDigestResult> {
  const [{ id: runId }] = await db
    .insert(runs)
    .values({ kind: "digest", userId, status: "running" })
    .returning({ id: runs.id });

  const stageLog: StageLogEntry[] = [];
  const log = (entry: StageLogEntry) => {
    stageLog.push(entry);
    opts.onStage?.(entry);
  };
  const fail = async (error: string) => {
    await db.update(runs).set({ finishedAt: new Date(), status: "failed", stageLog, error }).where(eq(runs.id, runId));
    return { success: false as const, runId, error, stageLog };
  };

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    const [prefs] = await db.select().from(preferences).where(eq(preferences.userId, userId));
    if (!user || !prefs) {
      return fail(`No user or preferences found for userId ${userId}`);
    }

    // --- Curator ---
    const curatorStart = Date.now();
    log({ stage: "curator", event: "start", at: now(), sectors: prefs.sectors });

    const candidates = await fetchCandidateArticles(prefs.sectors);
    const curatorResult = await runCurator({
      roleTitle: user.roleTitle,
      keywords: prefs.keywords,
      feedbackProfile: prefs.feedbackProfile,
      sectors: prefs.sectors,
      candidates,
    });

    if (curatorResult.degraded) {
      log({ stage: "curator", event: "finish", at: now(), durationMs: Date.now() - curatorStart, status: "degraded", error: curatorResult.error });
      return fail(`Curator failed: ${curatorResult.error}`);
    }

    log({
      stage: "curator",
      event: "finish",
      at: now(),
      durationMs: Date.now() - curatorStart,
      status: "ok",
      candidateCount: candidates.length,
      selectedCount: curatorResult.data.selected.length,
      selections: curatorResult.data.selected.map((s) => ({ article_id: s.article_id, sector: s.sector, score: s.score, reason: s.reason })),
    });

    if (curatorResult.data.selected.length === 0) {
      log({ stage: "pipeline", event: "finish", at: now(), note: "Curator selected zero articles; nothing to research or write." });
      await db.update(runs).set({ finishedAt: new Date(), status: "completed", stageLog }).where(eq(runs.id, runId));
      return { success: true, runId, digestId: null, items: [], editorsNote: "", rejected: [], stageLog };
    }

    // --- Researcher ---
    const selectedIds = curatorResult.data.selected.map((s) => s.article_id);
    const articleRows = await db
      .select({
        id: articles.id,
        title: articles.title,
        url: articles.url,
        excerpt: articles.excerpt,
        sector: articles.sector,
        source: sources.name,
      })
      .from(articles)
      .innerJoin(sources, eq(articles.sourceId, sources.id))
      .where(inArray(articles.id, selectedIds));

    const researchInputs: ResearchInput[] = articleRows.map((row) => ({
      articleId: row.id,
      sector: row.sector,
      title: row.title,
      url: row.url,
      source: row.source,
      excerpt: row.excerpt,
    }));

    const researcherStart = Date.now();
    log({ stage: "researcher", event: "start", at: now(), itemCount: researchInputs.length });

    const researched = await runResearcher(researchInputs);
    const deepCount = researched.filter((r) => r.depth === "deep").length;

    log({
      stage: "researcher",
      event: "finish",
      at: now(),
      durationMs: Date.now() - researcherStart,
      itemCount: researched.length,
      deep: deepCount,
      shallow: researched.length - deepCount,
    });

    // --- Writer + Editor, one pipeline per sector, run in parallel ---
    const bySector = new Map<string, ResearchedItem[]>();
    for (const item of researched) {
      const bucket = bySector.get(item.sector) ?? [];
      bucket.push(item);
      bySector.set(item.sector, bucket);
    }

    const sectorResults = await Promise.all(
      [...bySector.entries()].map(([sector, items]) =>
        runSectorPipeline(sector, items, log, {
          userName: user.name,
          roleTitle: user.roleTitle,
          depth: prefs.depth,
        })
      )
    );

    const failedSectors = sectorResults.filter((r) => r.writerError || r.editorError);
    if (failedSectors.length > 0) {
      log({
        stage: "pipeline",
        event: "note",
        at: now(),
        message: "One or more sectors failed independently; their items are excluded but the run continues.",
        failedSectors: failedSectors.map((r) => ({ sector: r.sector, error: r.writerError ?? r.editorError })),
      });
    }

    const allRejected = sectorResults.flatMap((r) => r.rejected);

    // Rank within each sector by the Curator's original score, highest first.
    // Keyed lowercase: the Writer/Editor round-trip article_id through two LLM calls,
    // and a schema-valid UUID can come back in a different case than Postgres stored it.
    const scoreByArticleId = new Map(curatorResult.data.selected.map((s) => [s.article_id, s.score]));
    const urlByArticleId = new Map(researched.map((r) => [r.articleId.toLowerCase(), r.url]));

    const rankedItems: RankedItem[] = sectorResults.flatMap((sectorResult) => {
      const sorted = [...sectorResult.approved].sort(
        (a, b) => (scoreByArticleId.get(b.article_id) ?? 0) - (scoreByArticleId.get(a.article_id) ?? 0)
      );

      const resolved: RankedItem[] = [];
      for (const item of sorted) {
        const sourceUrl = urlByArticleId.get(item.article_id.toLowerCase());
        if (!sourceUrl) {
          // An LLM-echoed article_id that doesn't match any researched article — never ship a
          // digest item without a resolvable source, so drop it exactly like an Editor rejection.
          allRejected.push({ article_id: item.article_id, reason: "No matching source URL was found for this article_id after the Writer/Editor pass." });
          log({ stage: "pipeline", event: "warning", at: now(), sector: sectorResult.sector, article_id: item.article_id, message: "Dropped item with unresolvable source_url" });
          continue;
        }
        resolved.push({ ...item, source_url: sourceUrl, rank: 0 });
      }
      return resolved.map((item, idx) => ({ ...item, rank: idx + 1 }));
    });

    // --- Cross-sector editors note ---
    let editorsNote = "";
    if (rankedItems.length > 0) {
      const noteStart = Date.now();
      log({ stage: "editors_note", event: "start", at: now(), itemCount: rankedItems.length });

      const noteResult = await runCrossSectorNote(rankedItems.map((i) => ({ sector: i.sector, headline: i.headline })));

      if (noteResult.degraded) {
        log({ stage: "editors_note", event: "finish", at: now(), durationMs: Date.now() - noteStart, status: "degraded", error: noteResult.error });
      } else {
        editorsNote = noteResult.data.editors_note;
        log({ stage: "editors_note", event: "finish", at: now(), durationMs: Date.now() - noteStart, status: "ok" });
      }
    }

    const runStatus = rankedItems.length > 0 || failedSectors.length === 0 ? "completed" : "failed";

    let digestId: string | null = null;
    if (!opts.dryRun) {
      const [digest] = await db
        .insert(digests)
        .values({
          userId,
          scheduledFor: new Date(),
          status: "ready",
          runMeta: { runId },
        })
        .returning({ id: digests.id });
      digestId = digest.id;

      if (rankedItems.length > 0) {
        await db.insert(digestItems).values(
          rankedItems.map((item) => ({
            digestId: digest.id,
            articleId: item.article_id,
            sector: item.sector,
            headline: item.headline,
            summary: item.summary,
            whyItMatters: item.why_it_matters,
            sourceUrl: item.source_url,
            rank: item.rank,
          }))
        );
      }
    }

    log({ stage: "pipeline", event: "finish", at: now(), digestId, itemCount: rankedItems.length, dryRun: opts.dryRun });

    await db.update(runs).set({ finishedAt: new Date(), status: runStatus, stageLog }).where(eq(runs.id, runId));

    if (runStatus === "failed") {
      return { success: false, runId, error: "All sectors failed to produce a digest", stageLog };
    }

    return { success: true, runId, digestId, items: rankedItems, editorsNote, rejected: allRejected, stageLog };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return fail(error);
  }
}

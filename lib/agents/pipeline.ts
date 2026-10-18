import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { addUsage, ZERO_USAGE, type TokenUsage } from "../llm";
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
      skipped?: boolean;
    }
  | { success: false; runId: string; error: string; stageLog: StageLogEntry[] };

export type BriefContext = {
  userName: string;
  roleTitle: string | null;
  sectors: string[];
  keywords: string[];
  feedbackProfile: string | null;
  depth: "brief" | "standard" | "deep";
};

export type GenerateBriefResult =
  | {
      success: true;
      runId: string;
      items: RankedItem[];
      editorsNote: string;
      rejected: { article_id: string; reason: string }[];
      stageLog: StageLogEntry[];
      curatorSelectedCount: number;
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

type AttemptResult =
  | { ok: true; approved: WriterItem[]; rejected: { article_id: string; reason: string }[] }
  | { ok: false; writerError?: string; editorError?: string };

// Runs Writer -> Editor for one sector's items. Never throws — a failure in this
// sector must not take down the other sectors running alongside it. If the first
// pass approves nothing, relaxes once by retrying the Writer with the specific
// rejection reasons before shipping the sector empty — an empty sector should be
// a genuine dead end, not a first-try fluke.
async function runSectorPipeline(
  sector: string,
  items: ResearchedItem[],
  log: (entry: StageLogEntry) => void,
  writerInput: { userName: string; roleTitle: string | null; depth: "brief" | "standard" | "deep" },
  track: (usage: TokenUsage) => TokenUsage
): Promise<SectorResult> {
  const runAttempt = async (
    attempt: 1 | 2,
    previousRejections?: { article_id: string; reason: string }[]
  ): Promise<AttemptResult> => {
    const writerStart = Date.now();
    log({ stage: "writer", event: "start", at: now(), sector, attempt, itemCount: items.length });

    const writerResult = await runWriter({ ...writerInput, items, previousRejections });
    const writerUsage = track(writerResult.usage);

    if (writerResult.degraded) {
      log({ stage: "writer", event: "finish", at: now(), sector, attempt, durationMs: Date.now() - writerStart, status: "degraded", error: writerResult.error, usage: writerUsage });
      return { ok: false, writerError: writerResult.error };
    }

    log({
      stage: "writer",
      event: "finish",
      at: now(),
      sector,
      attempt,
      durationMs: Date.now() - writerStart,
      status: "ok",
      itemCount: writerResult.data.items.length,
      usage: writerUsage,
    });

    const sourceTextByArticleId = new Map(items.map((i) => [i.articleId, i.text]));
    const editorInputs: EditorInput[] = writerResult.data.items.map((item) => ({
      ...item,
      sourceText: sourceTextByArticleId.get(item.article_id) ?? "",
    }));

    const editorStart = Date.now();
    log({ stage: "editor", event: "start", at: now(), sector, attempt, itemCount: editorInputs.length });

    const editorResult = await runEditor(editorInputs);
    const editorUsage = track(editorResult.usage);

    if (editorResult.degraded) {
      log({ stage: "editor", event: "finish", at: now(), sector, attempt, durationMs: Date.now() - editorStart, status: "degraded", error: editorResult.error, usage: editorUsage });
      return { ok: false, editorError: editorResult.error };
    }

    // Rejections are preserved even though they don't ship — they're a demo asset.
    log({
      stage: "editor",
      event: "finish",
      at: now(),
      sector,
      attempt,
      durationMs: Date.now() - editorStart,
      status: "ok",
      approvedCount: editorResult.data.approved.length,
      rejectedCount: editorResult.data.rejected.length,
      rejected: editorResult.data.rejected,
      usage: editorUsage,
    });

    return { ok: true, approved: editorResult.data.approved, rejected: editorResult.data.rejected };
  };

  try {
    const first = await runAttempt(1);
    if (!first.ok) {
      return { sector, approved: [], rejected: [], writerError: first.writerError, editorError: first.editorError };
    }
    if (first.approved.length > 0) {
      return { sector, approved: first.approved, rejected: first.rejected };
    }

    log({
      stage: "pipeline",
      event: "note",
      at: now(),
      sector,
      message: "Zero items approved on the first pass; retrying the Writer once before shipping this sector empty.",
    });

    const second = await runAttempt(2, first.rejected);
    if (!second.ok) {
      return { sector, approved: [], rejected: first.rejected, writerError: second.writerError, editorError: second.editorError };
    }

    return { sector, approved: second.approved, rejected: [...first.rejected, ...second.rejected] };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log({ stage: "sector_pipeline", event: "finish", at: now(), sector, status: "error", error });
    return { sector, approved: [], rejected: [], writerError: error };
  }
}

export async function generateBrief(
  ctx: BriefContext,
  opts: {
    kind: "digest" | "landing";
    userId: string | null;
    maxCandidates?: number;
    maxItemsPerSector?: number;
    onStage?: (entry: StageLogEntry) => void;
  },
): Promise<GenerateBriefResult> {
  const [{ id: runId }] = await db
    .insert(runs)
    .values({ kind: opts.kind, userId: opts.userId, status: "running" })
    .returning({ id: runs.id });

  const stageLog: StageLogEntry[] = [];
  const log = (entry: StageLogEntry) => {
    stageLog.push(entry);
    opts.onStage?.(entry);
  };
  // Running total across every LLM call in this run; written to runs.token_cost (total tokens).
  let usage = ZERO_USAGE;
  const track = (u: TokenUsage) => {
    usage = addUsage(usage, u);
    return u;
  };
  const tokenCost = () => String(usage.totalTokens);
  const fail = async (error: string) => {
    await db
      .update(runs)
      .set({ finishedAt: new Date(), status: "failed", stageLog, error, tokenCost: tokenCost() })
      .where(eq(runs.id, runId));
    return { success: false as const, runId, error, stageLog };
  };

  try {
    // --- Curator ---
    const curatorStart = Date.now();
    log({ stage: "curator", event: "start", at: now(), sectors: ctx.sectors, candidateLimit: opts.maxCandidates ?? null });

    const candidates = await fetchCandidateArticles(ctx.sectors, opts.maxCandidates);
    const curatorResult = await runCurator({
      roleTitle: ctx.roleTitle,
      keywords: ctx.keywords,
      feedbackProfile: ctx.feedbackProfile,
      sectors: ctx.sectors,
      candidates,
    });

    const curatorUsage = track(curatorResult.usage);

    if (curatorResult.degraded) {
      log({ stage: "curator", event: "finish", at: now(), durationMs: Date.now() - curatorStart, status: "degraded", error: curatorResult.error, usage: curatorUsage });
      return fail(`Curator failed: ${curatorResult.error}`);
    }

    log({
      stage: "curator",
      event: "finish",
      at: now(),
      durationMs: Date.now() - curatorStart,
      status: "ok",
      usage: curatorUsage,
      candidateCount: candidates.length,
      selectedCount: curatorResult.data.selected.length,
      selections: curatorResult.data.selected.map((s) => ({ article_id: s.article_id, sector: s.sector, score: s.score, reason: s.reason })),
    });

    if (curatorResult.data.selected.length === 0) {
      log({ stage: "pipeline", event: "finish", at: now(), note: "Curator selected zero articles; nothing to research or write." });
      await db.update(runs).set({ finishedAt: new Date(), status: "completed", stageLog, tokenCost: tokenCost() }).where(eq(runs.id, runId));
      return { success: true, runId, items: [], editorsNote: "", rejected: [], stageLog, curatorSelectedCount: 0 };
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
          userName: ctx.userName,
          roleTitle: ctx.roleTitle,
          depth: ctx.depth,
        }, track)
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
          allRejected.push({ article_id: item.article_id, reason: "No matching source URL was found for this article_id after the Writer/Editor pass." });
          log({ stage: "pipeline", event: "warning", at: now(), sector: sectorResult.sector, article_id: item.article_id, message: "Dropped item with unresolvable source_url" });
          continue;
        }
        resolved.push({ ...item, source_url: sourceUrl, rank: 0 });
      }
      return resolved.map((item, idx) => ({ ...item, rank: idx + 1 }));
    });

    // Landing caps the visible items per sector; ranks are already 1-based per sector.
    const items =
      opts.maxItemsPerSector !== undefined
        ? rankedItems.filter((i) => i.rank <= opts.maxItemsPerSector!)
        : rankedItems;

    // --- Cross-sector editors note ---
    let editorsNote = "";
    if (items.length > 0) {
      const noteStart = Date.now();
      log({ stage: "editors_note", event: "start", at: now(), itemCount: items.length });

      const noteResult = await runCrossSectorNote(items.map((i) => ({ sector: i.sector, headline: i.headline })));
      const noteUsage = track(noteResult.usage);

      if (noteResult.degraded) {
        log({ stage: "editors_note", event: "finish", at: now(), durationMs: Date.now() - noteStart, status: "degraded", error: noteResult.error, usage: noteUsage });
      } else {
        editorsNote = noteResult.data.editors_note;
        log({ stage: "editors_note", event: "finish", at: now(), durationMs: Date.now() - noteStart, status: "ok", usage: noteUsage });
      }
    }

    const runStatus = items.length > 0 || failedSectors.length === 0 ? "completed" : "failed";

    log({ stage: "pipeline", event: "finish", at: now(), itemCount: items.length, kind: opts.kind, usage });

    await db.update(runs).set({ finishedAt: new Date(), status: runStatus, stageLog, tokenCost: tokenCost() }).where(eq(runs.id, runId));

    if (runStatus === "failed") {
      return { success: false, runId, error: "All sectors failed to produce a digest", stageLog };
    }

    return { success: true, runId, items, editorsNote, rejected: allRejected, stageLog, curatorSelectedCount: curatorResult.data.selected.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return fail(error);
  }
}

export async function generateDigest(
  userId: string,
  opts: { dryRun: boolean; onStage?: (entry: StageLogEntry) => void; scheduledFor?: Date }
): Promise<GenerateDigestResult> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const [prefs] = await db.select().from(preferences).where(eq(preferences.userId, userId));

  if (!user || !prefs) {
    const [{ id: runId }] = await db
      .insert(runs)
      .values({ kind: "digest", userId: user ? userId : null, status: "failed" })
      .returning({ id: runs.id });
    const error = `No user or preferences found for userId ${userId}`;
    const stageLog: StageLogEntry[] = [];
    await db.update(runs).set({ finishedAt: new Date(), status: "failed", stageLog, error }).where(eq(runs.id, runId));
    return { success: false, runId, error, stageLog };
  }

  const result = await generateBrief(
    {
      userName: user.name,
      roleTitle: user.roleTitle,
      sectors: prefs.sectors,
      keywords: prefs.keywords,
      feedbackProfile: prefs.feedbackProfile,
      depth: prefs.depth,
    },
    { kind: "digest", userId, onStage: opts.onStage }
  );

  if (!result.success) return result;

  const { curatorSelectedCount, ...rest } = result;

  let digestId: string | null = null;
  if (!opts.dryRun && curatorSelectedCount > 0) {
    const [digest] = await db
      .insert(digests)
      .values({
        userId,
        scheduledFor: opts.scheduledFor ?? new Date(),
        status: "ready",
        runMeta: { runId: result.runId, editorsNote: rest.editorsNote },
      })
      .onConflictDoNothing()
      .returning({ id: digests.id });

    if (!digest) {
      // A digest already exists for this exact (user_id, scheduled_for) slot —
      // the unique index blocked a second insert. Ship nothing: no digest_items,
      // no email. This is what lets a cron dispatcher retry a slot safely.
      const entry = { stage: "pipeline", event: "skipped", at: new Date().toISOString(), reason: "digest already exists for this scheduled_for slot" };
      const stageLog = [...rest.stageLog, entry];
      opts.onStage?.(entry);
      await db.update(runs).set({ stageLog }).where(eq(runs.id, result.runId));
      return { success: true, runId: result.runId, digestId: null, items: [], editorsNote: "", rejected: [], stageLog, skipped: true };
    }

    digestId = digest.id;

    if (rest.items.length > 0) {
      await db.insert(digestItems).values(
        rest.items.map((item) => ({
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

  return { ...rest, digestId };
}

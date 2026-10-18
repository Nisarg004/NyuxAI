import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { addUsage, ZERO_USAGE, type TokenUsage } from "../llm";
import { articles, digestItems, digests, preferences, runs, sources, users } from "../db/schema";
import { fetchCandidateArticles, runCurator } from "./curator";
import { ensureBriefs } from "./article-brief";
import { applyDepth } from "./depth";
import { personalizeWhyItMatters } from "./personalizer";
import type { ResearchInput } from "./researcher";
import { runCrossSectorNote } from "./writer";

type StageLogEntry = Record<string, unknown>;
// How many items per sector a digest carries. The Curator over-selects by EXTRA_CANDIDATES so
// that briefs the Editor rejects can be backfilled from the next-best picks.
const ITEMS_PER_SECTOR = 5;
const EXTRA_CANDIDATES = 2;

type RankedItem = {
  article_id: string;
  sector: string;
  headline: string;
  summary: string;
  why_it_matters: string;
  source_url: string;
  rank: number;
};

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
      perSector: Math.min(7, (opts.maxItemsPerSector ?? ITEMS_PER_SECTOR) + EXTRA_CANDIDATES),
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

    // --- Shared briefs: cached per article; only missing ones are researched, written, verified ---
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

    // Rank by the Curator's score, keep each sector's best verified briefs, drop the rest.
    const sectorByArticleId = new Map(researchInputs.map((r) => [r.articleId.toLowerCase(), r.sector]));
    const urlByArticleId = new Map(researchInputs.map((r) => [r.articleId.toLowerCase(), r.url]));
    const cap = opts.maxItemsPerSector ?? ITEMS_PER_SECTOR;
    const allRejected: { article_id: string; reason: string }[] = [];
    const perSectorCount = new Map<string, number>();
    let items: RankedItem[] = [];

    for (const sel of [...curatorResult.data.selected].sort((a, b) => b.score - a.score)) {
      const id = sel.article_id.toLowerCase();
      const brief = briefs.get(id);
      const sector = sectorByArticleId.get(id);
      if (!brief || !sector) continue; // its sector's Writer/Editor degraded; noted above
      if (!brief.verified || !brief.whyItMatters) {
        allRejected.push({ article_id: id, reason: brief.editorNotes ?? "Rejected by the Editor." });
        continue;
      }
      const sourceUrl = urlByArticleId.get(id);
      if (!sourceUrl) {
        allRejected.push({ article_id: id, reason: "No matching source URL was found for this article_id." });
        log({ stage: "pipeline", event: "warning", at: now(), sector, article_id: id, message: "Dropped item with unresolvable source_url" });
        continue;
      }
      const rank = (perSectorCount.get(sector) ?? 0) + 1;
      if (rank > cap) continue;
      perSectorCount.set(sector, rank);
      items.push({
        article_id: id,
        sector,
        headline: brief.headline,
        summary: applyDepth(brief.summary, ctx.depth),
        why_it_matters: brief.whyItMatters,
        source_url: sourceUrl,
        rank,
      });
    }

    // --- Personalizer: role-tuned readers get a verified "why it matters for you" line ---
    if (ctx.roleTitle && items.length > 0) {
      const start = Date.now();
      log({ stage: "personalizer", event: "start", at: now(), itemCount: items.length });
      const personalized = await personalizeWhyItMatters({
        roleTitle: ctx.roleTitle,
        items: items.map((i) => ({ articleId: i.article_id, headline: i.headline, summary: i.summary, keyFacts: briefs.get(i.article_id)?.keyFacts ?? [] })),
      });
      const usage = track(personalized.usage);
      items = items.map((i) => ({ ...i, why_it_matters: personalized.lines.get(i.article_id) ?? i.why_it_matters }));
      log({
        stage: "personalizer",
        event: "finish",
        at: now(),
        durationMs: Date.now() - start,
        status: personalized.error ? "degraded" : "ok",
        personalizedCount: personalized.lines.size,
        rejected: personalized.rejected,
        usage,
        ...(personalized.error ? { error: personalized.error } : {}),
      });
    }

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

    const runStatus = items.length > 0 || failures.length === 0 ? "completed" : "failed";

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
    // Digest and items land together or not at all: a crash between the two inserts must not
    // leave an empty digest that a retry would then see as "already generated".
    const inserted = await db.transaction(async (tx) => {
      const [digest] = await tx
        .insert(digests)
        .values({
          userId,
          scheduledFor: opts.scheduledFor ?? new Date(),
          status: "ready",
          runMeta: { runId: result.runId, editorsNote: rest.editorsNote },
        })
        .onConflictDoNothing()
        .returning({ id: digests.id });
      if (!digest) return null;

      if (rest.items.length > 0) {
        await tx.insert(digestItems).values(
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
      return digest;
    });

    if (!inserted) {
      // A digest already exists for this exact (user_id, scheduled_for) slot —
      // the unique index blocked a second insert. Ship nothing: no digest_items,
      // no email. This is what lets a cron dispatcher retry a slot safely.
      const entry = { stage: "pipeline", event: "skipped", at: new Date().toISOString(), reason: "digest already exists for this scheduled_for slot" };
      const stageLog = [...rest.stageLog, entry];
      opts.onStage?.(entry);
      await db.update(runs).set({ stageLog }).where(eq(runs.id, result.runId));
      return { success: true, runId: result.runId, digestId: null, items: [], editorsNote: "", rejected: [], stageLog, skipped: true };
    }

    digestId = inserted.id;
  }

  return { ...rest, digestId };
}

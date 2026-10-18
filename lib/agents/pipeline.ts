import { eq } from "drizzle-orm";
import { db } from "../db";
import { addUsage, ZERO_USAGE, type TokenUsage } from "../llm";
import { digestItems, digests, preferences, runs, users } from "../db/schema";
import { curateAndBrief, ITEMS_PER_SECTOR } from "./curation";
import { getOrBuildSectorEdition } from "./edition";
import { applyDepth } from "./depth";
import { personalizeWhyItMatters } from "./personalizer";
import { runCrossSectorNote } from "./writer";

type StageLogEntry = Record<string, unknown>;
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
  mode: "sectors" | "role";
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
    // Two ways to fill a brief. "sectors" readers get each sector's shared edition (no per-user
    // model calls). "role" readers get a Curator run for their own profile over the shared briefs.
    let items: RankedItem[];
    let failures: { sector: string; error: string }[];
    let allRejected: { article_id: string; reason: string }[];
    let selectedCount: number;
    const keyFactsById = new Map<string, string[]>();

    if (ctx.mode === "sectors") {
      const cap = opts.maxItemsPerSector ?? ITEMS_PER_SECTOR;
      const editions = await Promise.all(
        ctx.sectors.map(async (sector) => {
          const start = Date.now();
          try {
            const edition = await getOrBuildSectorEdition(sector);
            log({ stage: "edition", event: "finish", at: now(), sector, durationMs: Date.now() - start, status: "ok", cached: edition.cached, itemCount: edition.items.length, editionRunId: edition.runId });
            return { ok: true as const, sector, edition };
          } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            log({ stage: "edition", event: "finish", at: now(), sector, durationMs: Date.now() - start, status: "degraded", error });
            return { ok: false as const, sector, error };
          }
        }),
      );
      failures = editions.flatMap((e) => (e.ok ? [] : [{ sector: e.sector, error: e.error }]));
      allRejected = [];
      items = editions.flatMap((e) =>
        e.ok
          ? e.edition.items
              .filter((i) => i.rank <= cap)
              .map((i) => ({ ...i, sector: e.sector, summary: applyDepth(i.summary, ctx.depth) }))
          : [],
      );
      selectedCount = items.length;
      if (failures.length > 0) {
        log({ stage: "pipeline", event: "note", at: now(), message: "One or more sector editions failed; those sectors are excluded.", failedSectors: failures });
      }
    } else {
      const curated = await curateAndBrief(
        { sectors: ctx.sectors, roleTitle: ctx.roleTitle, keywords: ctx.keywords, feedbackProfile: ctx.feedbackProfile, maxCandidates: opts.maxCandidates, itemsPerSector: opts.maxItemsPerSector },
        { log, track },
      );
      if (!curated.ok) return fail(curated.error);
      failures = curated.failures;
      allRejected = curated.rejected;
      selectedCount = curated.selectedCount;
      for (const i of curated.items) keyFactsById.set(i.article_id, i.keyFacts);
      items = curated.items.map((i) => ({
        article_id: i.article_id,
        sector: i.sector,
        headline: i.headline,
        summary: applyDepth(i.summary, ctx.depth),
        why_it_matters: i.why_it_matters,
        source_url: i.source_url,
        rank: i.rank,
      }));
    }

    if (selectedCount === 0 && failures.length === 0) {
      log({ stage: "pipeline", event: "finish", at: now(), note: ctx.mode === "sectors" ? "No sector had any stories to show." : "Curator selected zero articles; nothing to research or write." });
      await db.update(runs).set({ finishedAt: new Date(), status: "completed", stageLog, tokenCost: tokenCost() }).where(eq(runs.id, runId));
      return { success: true, runId, items: [], editorsNote: "", rejected: [], stageLog, curatorSelectedCount: 0 };
    }

    // --- Personalizer: role-tuned readers get a verified "why it matters for you" line ---
    if (ctx.mode === "role" && ctx.roleTitle && items.length > 0) {
      const start = Date.now();
      log({ stage: "personalizer", event: "start", at: now(), itemCount: items.length });
      const personalized = await personalizeWhyItMatters({
        roleTitle: ctx.roleTitle,
        items: items.map((i) => ({ articleId: i.article_id, headline: i.headline, summary: i.summary, keyFacts: keyFactsById.get(i.article_id) ?? [] })),
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
    // Sector-mode briefs skip it: it would be a per-reader model call, which is what that mode avoids.
    let editorsNote = "";
    if (ctx.mode === "role" && items.length > 0) {
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

    return { success: true, runId, items, editorsNote, rejected: allRejected, stageLog, curatorSelectedCount: selectedCount };
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
      mode: prefs.mode,
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

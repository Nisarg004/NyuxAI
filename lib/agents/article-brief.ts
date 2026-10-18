import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { articleBriefs } from "../db/schema";
import { runWithConcurrency } from "../concurrency";
import { addUsage, callLLM, ZERO_USAGE, type LLMResult, type TokenUsage } from "../llm";
import { MODEL_FAST, MODEL_WRITER } from "./models";
import { runResearcher, type ResearchedItem, type ResearchInput } from "./researcher";

// The shared article layer. Each article gets one neutral, Editor-verified brief that every
// user whose Curator selects it reuses, instead of each user paying for their own Writer and
// Editor pass over the same source text.

const CHUNK_SIZE = 6;
const SECTOR_CONCURRENCY = 6;

export type ArticleBrief = {
  articleId: string;
  headline: string;
  summary: string;
  whyItMatters: string | null;
  keyFacts: string[];
  verified: boolean;
  editorNotes: string | null;
  researchDepth: "deep" | "shallow";
};

const headlineSchema = z.string().refine((h) => h.trim().split(/\s+/).length <= 12, "headline must be 12 words or fewer");

const briefDraftSchema = z.object({
  article_id: z.string().uuid(),
  headline: headlineSchema,
  summary: z.string(),
  why_it_matters: z.string().nullable(),
  key_facts: z.array(z.string()),
});
const briefWriterOutputSchema = z.object({ items: z.array(briefDraftSchema) });

const briefApprovedSchema = briefDraftSchema.extend({ why_it_matters: z.string() });
const briefEditorOutputSchema = z.object({
  approved: z.array(briefApprovedSchema),
  rejected: z.array(z.object({ article_id: z.string().uuid(), reason: z.string() })),
});

type BriefDraft = z.infer<typeof briefDraftSchema>;

async function runBriefWriter(items: ResearchedItem[]): Promise<LLMResult<z.infer<typeof briefWriterOutputSchema>>> {
  const system = [
    "You are the Writer agent in a news briefing pipeline, producing a neutral brief for each article that many different readers will share.",
    "For each article produce: `headline` (max 12 words, factual, no clickbait), `summary` (2-3 sentences, using only facts present in the source text), and `key_facts` (3-5 short, literal, self-contained facts from the source text: numbers, dates, decisions, named parties).",
    "If the source text does not support a claim, omit it — never invent or infer facts not present in the text.",
    "`why_it_matters` is exactly one sentence for an informed general reader following this sector: it must name a concrete consequence, decision, number, or named party that someone would weigh differently because of this article.",
    "Never write a sentence that could be pasted onto any other story in this sector — that is generic filler. Banned: the pattern \"X can affect/impact Y\", and hedges like \"worth watching\", \"worth monitoring\", or \"remains a factor\".",
    "If the source text is too thin to support a specific consequence (only a date, a headline-level fact, or a number with no stated implication), set `why_it_matters` to null. Do not invent a sentence to fill the field.",
  ].join(" ");

  const user = JSON.stringify({
    articles: items.map((item) => ({
      article_id: item.articleId,
      sector: item.sector,
      title: item.title,
      source: item.source,
      research_depth: item.depth,
      source_text: item.text,
    })),
  });

  return callLLM({ model: MODEL_WRITER, schema: briefWriterOutputSchema, schemaName: "brief_writer_output", system, user });
}

async function runBriefEditor(
  drafts: BriefDraft[],
  textById: Map<string, string>,
): Promise<LLMResult<z.infer<typeof briefEditorOutputSchema>>> {
  const system = [
    "You are the Editor agent in a news briefing pipeline — the last check before a brief is published to many readers.",
    "For each item, verify every factual claim in `summary`, `why_it_matters` and every entry of `key_facts` is supported by its `source_text`.",
    "Reject any item with an unsupported claim, giving a specific one-sentence `reason` — be concrete about what failed.",
    "If `why_it_matters` is null, reject with reason \"No concrete consequence could be established from the source.\" Never write your own why_it_matters to fill the gap.",
    "For items that pass, strip hype adjectives and hedging, and enforce limits: headline max 12 words, summary max 3 sentences, why_it_matters exactly one sentence. Remove (do not rewrite) any key_fact that is unsupported, keeping at least one.",
    "Return approved items in the same shape you received them, edited in place, plus the rejected list.",
  ].join(" ");

  const user = JSON.stringify({
    items: drafts.map((d) => ({ ...d, source_text: textById.get(d.article_id) ?? "" })),
  });

  return callLLM({ model: MODEL_FAST, schema: briefEditorOutputSchema, schemaName: "brief_editor_output", system, user });
}

type SectorOutcome = {
  briefs: ArticleBrief[];
  // Briefs not persisted because the source was only an RSS excerpt: a thin excerpt may
  // simply mean the full-text fetch failed, so the article is worth another try later.
  transient: ArticleBrief[];
  writerError?: string;
  editorError?: string;
  usage: { writer: TokenUsage; editor: TokenUsage };
};

async function writeSector(items: ResearchedItem[]): Promise<SectorOutcome> {
  const outcome: SectorOutcome = { briefs: [], transient: [], usage: { writer: ZERO_USAGE, editor: ZERO_USAGE } };
  const textById = new Map(items.map((i) => [i.articleId, i.text]));
  const depthById = new Map(items.map((i) => [i.articleId, i.depth]));

  const chunks: ResearchedItem[][] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) chunks.push(items.slice(i, i + CHUNK_SIZE));

  await Promise.all(
    chunks.map(async (chunk) => {
      const written = await runBriefWriter(chunk);
      outcome.usage.writer = addUsage(outcome.usage.writer, written.usage);
      if (written.degraded) {
        outcome.writerError = written.error;
        return;
      }

      // The model may only return ids it was given; anything else is dropped here.
      const known = new Set(chunk.map((c) => c.articleId.toLowerCase()));
      const drafts = written.data.items.filter((d) => known.has(d.article_id.toLowerCase()));

      const edited = await runBriefEditor(drafts, textById);
      outcome.usage.editor = addUsage(outcome.usage.editor, edited.usage);
      if (edited.degraded) {
        outcome.editorError = edited.error;
        return;
      }

      const draftById = new Map(drafts.map((d) => [d.article_id, d]));
      const make = (id: string, over: Partial<ArticleBrief> & Pick<ArticleBrief, "headline" | "summary" | "verified">): ArticleBrief => ({
        articleId: id,
        whyItMatters: null,
        keyFacts: [],
        editorNotes: null,
        researchDepth: depthById.get(id) ?? "shallow",
        ...over,
      });
      const push = (b: ArticleBrief) => (b.researchDepth === "deep" || b.verified ? outcome.briefs : outcome.transient).push(b);

      for (const a of edited.data.approved) {
        push(make(a.article_id, { headline: a.headline, summary: a.summary, whyItMatters: a.why_it_matters, keyFacts: a.key_facts, verified: true }));
      }
      for (const r of edited.data.rejected) {
        const d = draftById.get(r.article_id);
        if (!d) continue;
        push(make(r.article_id, { headline: d.headline, summary: d.summary, keyFacts: d.key_facts, verified: false, editorNotes: r.reason }));
      }
    }),
  );
  return outcome;
}

function rowToBrief(row: typeof articleBriefs.$inferSelect): ArticleBrief {
  return {
    articleId: row.articleId,
    headline: row.headline,
    summary: row.summary,
    whyItMatters: row.whyItMatters,
    keyFacts: row.keyFacts,
    verified: row.verified,
    editorNotes: row.editorNotes,
    researchDepth: row.researchDepth === "deep" ? "deep" : "shallow",
  };
}

export type EnsureBriefsHooks = {
  log: (entry: Record<string, unknown>) => void;
  track: (usage: TokenUsage) => TokenUsage;
};

const now = () => new Date().toISOString();

// Returns a brief for every input that could get one: cached briefs are reused as-is (no
// network, no LLM), and only the missing ones are researched, written and verified, then
// persisted for the next user. Never throws; an article whose Writer/Editor call degraded
// is simply absent from the result. Stage-log entries keep the per-sector `writer` /
// `editor` shape the progress UI and /runs already understand.
export async function ensureBriefs(
  inputs: ResearchInput[],
  hooks: EnsureBriefsHooks,
): Promise<{ briefs: Map<string, ArticleBrief>; failures: { sector: string; error: string }[] }> {
  const { log, track } = hooks;
  const result = new Map<string, ArticleBrief>();
  const failures: { sector: string; error: string }[] = [];
  if (inputs.length === 0) return { briefs: result, failures };

  const cached = await db.select().from(articleBriefs).where(inArray(articleBriefs.articleId, inputs.map((i) => i.articleId)));
  for (const row of cached) result.set(row.articleId, rowToBrief(row));

  const missing = inputs.filter((i) => !result.has(i.articleId));

  const researcherStart = Date.now();
  log({ stage: "researcher", event: "start", at: now(), itemCount: missing.length });
  const researched = await runResearcher(missing);
  const deep = researched.filter((r) => r.depth === "deep").length;
  log({ stage: "researcher", event: "finish", at: now(), durationMs: Date.now() - researcherStart, itemCount: researched.length, deep, shallow: researched.length - deep });

  const bySector = new Map<string, ResearchedItem[]>();
  for (const item of researched) bySector.set(item.sector, [...(bySector.get(item.sector) ?? []), item]);

  // Sectors with nothing to write still get an entry, so the UI shows them as served from cache.
  const cachedBySector = new Map<string, ArticleBrief[]>();
  for (const input of inputs) {
    const brief = result.get(input.articleId);
    if (brief) cachedBySector.set(input.sector, [...(cachedBySector.get(input.sector) ?? []), brief]);
  }
  for (const [sector, briefs] of cachedBySector) {
    if (bySector.has(sector)) continue;
    log({ stage: "writer", event: "finish", at: now(), sector, attempt: 1, durationMs: 0, status: "ok", itemCount: briefs.length, cached: true });
    const rejected = briefs.filter((b) => !b.verified).map((b) => ({ article_id: b.articleId, reason: b.editorNotes ?? "Rejected by the Editor." }));
    log({ stage: "editor", event: "finish", at: now(), sector, attempt: 1, durationMs: 0, status: "ok", approvedCount: briefs.length - rejected.length, rejectedCount: rejected.length, rejected, cached: true });
  }

  const sectors = [...bySector.entries()];
  await runWithConcurrency(sectors, SECTOR_CONCURRENCY, async ([sector, items]) => {
    const start = Date.now();
    log({ stage: "writer", event: "start", at: now(), sector, attempt: 1, itemCount: items.length });
    const outcome = await writeSector(items);
    const writerUsage = track(outcome.usage.writer);
    const editorUsage = track(outcome.usage.editor);
    const all = [...outcome.briefs, ...outcome.transient];
    const error = outcome.writerError ?? outcome.editorError;
    if (error) failures.push({ sector, error });

    if (outcome.writerError) {
      log({ stage: "writer", event: "finish", at: now(), sector, attempt: 1, durationMs: Date.now() - start, status: "degraded", error: outcome.writerError, usage: writerUsage });
    } else {
      log({ stage: "writer", event: "finish", at: now(), sector, attempt: 1, durationMs: Date.now() - start, status: "ok", itemCount: all.length, usage: writerUsage });
    }
    if (outcome.editorError) {
      log({ stage: "editor", event: "finish", at: now(), sector, attempt: 1, durationMs: Date.now() - start, status: "degraded", error: outcome.editorError, usage: editorUsage });
    } else if (!outcome.writerError) {
      const rejected = all.filter((b) => !b.verified).map((b) => ({ article_id: b.articleId, reason: b.editorNotes ?? "Rejected by the Editor." }));
      log({ stage: "editor", event: "finish", at: now(), sector, attempt: 1, durationMs: Date.now() - start, status: "ok", approvedCount: all.length - rejected.length, rejectedCount: rejected.length, rejected, usage: editorUsage });
    }

    if (outcome.briefs.length > 0) {
      await db
        .insert(articleBriefs)
        .values(
          outcome.briefs.map((b) => ({
            articleId: b.articleId,
            headline: b.headline,
            summary: b.summary,
            whyItMatters: b.whyItMatters,
            keyFacts: b.keyFacts,
            verified: b.verified,
            editorNotes: b.editorNotes,
            researchDepth: b.researchDepth,
            model: MODEL_WRITER,
          })),
        )
        .onConflictDoNothing();
    }
    for (const b of all) result.set(b.articleId, b);
  });

  return { briefs: result, failures };
}

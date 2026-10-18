import { z } from "zod";
import { callLLM, addUsage, ZERO_USAGE, type TokenUsage } from "../llm";
import { MODEL_FAST } from "./models";

// Role-tuned readers get one extra, cheap step on top of the shared briefs: a
// "why it matters for you" line per item. It runs once per digest (not per sector or
// per article) over the shared `key_facts`, so its input is a few hundred tokens rather
// than thousands of source text, and every line is then verified against those same facts.

export type PersonalizerItem = { articleId: string; headline: string; summary: string; keyFacts: string[] };

const writtenSchema = z.object({
  items: z.array(z.object({ article_id: z.string().uuid(), why_it_matters: z.string().nullable() })),
});
const verifiedSchema = z.object({
  approved: z.array(z.object({ article_id: z.string().uuid(), why_it_matters: z.string() })),
  rejected: z.array(z.object({ article_id: z.string().uuid(), reason: z.string() })),
});

export type PersonalizeResult = {
  // article_id -> verified, role-specific line. Items missing here keep the shared line.
  lines: Map<string, string>;
  rejected: { article_id: string; reason: string }[];
  usage: TokenUsage;
  error?: string;
};

export async function personalizeWhyItMatters(input: { roleTitle: string; items: PersonalizerItem[] }): Promise<PersonalizeResult> {
  const lines = new Map<string, string>();
  if (input.items.length === 0) return { lines, rejected: [], usage: ZERO_USAGE };

  const payload = input.items.map((i) => ({ article_id: i.articleId, headline: i.headline, summary: i.summary, key_facts: i.keyFacts }));

  const written = await callLLM({
    model: MODEL_FAST,
    schema: writtenSchema,
    schemaName: "personalizer_output",
    system: [
      "You write the personalised line of a news briefing for one reader.",
      "For each item write `why_it_matters`: exactly one sentence addressed to the reader's role that names a concrete consequence, decision, number, or named party they would act on or weigh differently because of this story.",
      "Use ONLY the provided summary and key_facts; never add facts. Never write a sentence that could be pasted onto another story, and avoid hedges like \"worth watching\" or the pattern \"X can affect Y\".",
      "If the facts don't support a specific consequence for this role, set it to null.",
    ].join(" "),
    user: JSON.stringify({ reader_role: input.roleTitle, items: payload }),
  });
  if (written.degraded) return { lines, rejected: [], usage: written.usage, error: written.error };

  const known = new Set(input.items.map((i) => i.articleId.toLowerCase()));
  const drafts = written.data.items.filter((d) => known.has(d.article_id.toLowerCase()) && d.why_it_matters);
  if (drafts.length === 0) return { lines, rejected: [], usage: written.usage };

  const factsById = new Map(input.items.map((i) => [i.articleId.toLowerCase(), { summary: i.summary, key_facts: i.keyFacts }]));
  const verified = await callLLM({
    model: MODEL_FAST,
    schema: verifiedSchema,
    schemaName: "personalizer_verified",
    system: [
      "You are the Editor checking personalised lines in a news briefing.",
      "For each item, verify the `why_it_matters` sentence makes no claim beyond its `summary` and `key_facts`, is exactly one sentence, and is specific rather than generic filler.",
      "Approve it (lightly edited if needed to strip hype or hedging) or reject it with a one-sentence reason.",
    ].join(" "),
    user: JSON.stringify({
      reader_role: input.roleTitle,
      items: drafts.map((d) => ({ article_id: d.article_id, why_it_matters: d.why_it_matters, ...factsById.get(d.article_id.toLowerCase()) })),
    }),
  });

  const usage = addUsage(written.usage, verified.usage);
  if (verified.degraded) return { lines, rejected: [], usage, error: verified.error };

  for (const a of verified.data.approved) {
    if (known.has(a.article_id.toLowerCase())) lines.set(a.article_id.toLowerCase(), a.why_it_matters);
  }
  return { lines, rejected: verified.data.rejected, usage };
}

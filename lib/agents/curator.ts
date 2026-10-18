import { callLLM, type LLMResult } from "../llm";
import { MODEL_FAST } from "./models";
import type { CandidateArticle } from "./candidates";
import { curatorOutputSchema, type CuratorOutput } from "./schemas";

// Longer excerpts cost tokens on every candidate without changing what the Curator picks.
const EXCERPT_CHARS = 240;

export async function runCurator(input: {
  roleTitle: string | null;
  keywords: string[];
  feedbackProfile: string | null;
  sectors: string[];
  candidates: CandidateArticle[];
  // Per-sector pick count; callers over-select so rejected items can be backfilled.
  perSector?: number;
}): Promise<LLMResult<CuratorOutput>> {
  const system = [
    "You are the Curator agent in a news briefing pipeline.",
    "Given a reader profile and a pool of candidate articles, each already de-duplicated to one article per story (`covered_by` is how many outlets reported it — wider coverage is a mild signal of importance, never a reason to pick an article that is irrelevant to this reader).",
    "Then score each remaining article 0-100 for relevance to this specific reader.",
    `Return the top ${input.perSector ?? 5} articles per sector, ranked by score.`,
    "The `reason` field must be one short clause explaining the score — it is shown to the reader in a run log, so make it specific to this article and this reader, not generic.",
  ].join(" ");

  const user = JSON.stringify({
    reader: {
      role_title: input.roleTitle,
      keywords: input.keywords,
      feedback_profile: input.feedbackProfile,
      sectors: input.sectors,
    },
    candidates: input.candidates.map((c) => ({
      id: c.id,
      title: c.title,
      excerpt: c.excerpt?.slice(0, EXCERPT_CHARS) ?? null,
      covered_by: c.outlets,
      sector: c.sector,
      source: c.source,
      published_at: c.publishedAt,
    })),
  });

  return callLLM({
    model: MODEL_FAST,
    schema: curatorOutputSchema,
    schemaName: "curator_output",
    system,
    user,
  });
}

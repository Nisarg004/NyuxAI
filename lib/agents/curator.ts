import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db";
import { articles, sources } from "../db/schema";
import { callLLM, type LLMResult } from "../llm";
import { MODEL_FAST } from "./models";
import { curatorOutputSchema, type CuratorOutput } from "./schemas";

const CANDIDATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const CANDIDATE_LIMIT = 150;

export type CandidateArticle = {
  id: string;
  title: string;
  excerpt: string | null;
  sector: string;
  source: string;
  publishedAt: string | null;
};

export async function fetchCandidateArticles(sectors: string[]): Promise<CandidateArticle[]> {
  const cutoff = new Date(Date.now() - CANDIDATE_WINDOW_MS);

  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      excerpt: articles.excerpt,
      sector: articles.sector,
      publishedAt: articles.publishedAt,
      source: sources.name,
    })
    .from(articles)
    .innerJoin(sources, eq(articles.sourceId, sources.id))
    .where(and(inArray(articles.sector, sectors), gte(articles.fetchedAt, cutoff)))
    .limit(CANDIDATE_LIMIT);

  return rows.map((row) => ({
    ...row,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  }));
}

export async function runCurator(input: {
  roleTitle: string | null;
  keywords: string[];
  feedbackProfile: string | null;
  sectors: string[];
  candidates: CandidateArticle[];
}): Promise<LLMResult<CuratorOutput>> {
  const system = [
    "You are the Curator agent in a news briefing pipeline.",
    "Given a reader profile and a pool of candidate articles, first mentally dedupe near-identical stories covered by multiple outlets (keep the best single version).",
    "Then score each remaining article 0-100 for relevance to this specific reader.",
    "Return the top 5 articles per sector, ranked by score.",
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
      excerpt: c.excerpt,
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

import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { articles } from "../db/schema";
import { runWithConcurrency } from "../concurrency";

// Spec default was 5; bumped to 10 after a real dry run showed 5-wide concurrency
// forcing two sequential 8s-timeout waves on a typical 10-article selection.
const RESEARCH_CONCURRENCY = 10;
const FETCH_TIMEOUT_MS = 8000;
const MAX_CHARS = 4000;

const JINA_API_KEY = process.env.JINA_API_KEY;

export type ResearchInput = {
  articleId: string;
  sector: string;
  title: string;
  url: string;
  source: string;
  excerpt: string | null;
};

export type ResearchedItem = ResearchInput & {
  text: string;
  depth: "deep" | "shallow";
};

async function fetchFullText(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: JINA_API_KEY ? { Authorization: `Bearer ${JINA_API_KEY}` } : undefined,
    });
    if (!res.ok) return null;

    return (await res.text()).slice(0, MAX_CHARS);
  } catch {
    return null;
  }
}

// Checks the DB for previously fetched full text before ever calling r.jina.ai —
// repeat runs over the same articles never re-fetch, so a demo can't hit rate limits.
export async function runResearcher(items: ResearchInput[]): Promise<ResearchedItem[]> {
  const cachedRows =
    items.length > 0
      ? await db
          .select({ id: articles.id, fullText: articles.fullText })
          .from(articles)
          .where(inArray(articles.id, items.map((i) => i.articleId)))
      : [];
  const cachedByArticleId = new Map(cachedRows.filter((r) => r.fullText).map((r) => [r.id, r.fullText as string]));

  const results: ResearchedItem[] = [];

  await runWithConcurrency(items, RESEARCH_CONCURRENCY, async (item) => {
    const cached = cachedByArticleId.get(item.articleId);
    if (cached !== undefined) {
      results.push({ ...item, text: cached, depth: "deep" });
      return;
    }

    const fullText = await fetchFullText(item.url);
    if (fullText) {
      await db
        .update(articles)
        .set({ fullText, fullTextFetchedAt: new Date() })
        .where(eq(articles.id, item.articleId));
    }

    results.push({
      ...item,
      text: fullText ?? item.excerpt ?? "",
      depth: fullText ? "deep" : "shallow",
    });
  });

  return results;
}

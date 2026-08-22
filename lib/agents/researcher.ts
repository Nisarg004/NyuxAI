import { runWithConcurrency } from "../concurrency";

// Spec default was 5; bumped to 10 after a real dry run showed 5-wide concurrency
// forcing two sequential 8s-timeout waves on a typical 10-article selection.
const RESEARCH_CONCURRENCY = 10;
const FETCH_TIMEOUT_MS = 8000;
const MAX_CHARS = 4000;

// Cache by URL for the process lifetime — avoids re-fetching the same article
// if it's selected again within the same pipeline run.
const textCache = new Map<string, string>();

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
  const cached = textCache.get(url);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const text = (await res.text()).slice(0, MAX_CHARS);
    textCache.set(url, text);
    return text;
  } catch {
    return null;
  }
}

export async function runResearcher(items: ResearchInput[]): Promise<ResearchedItem[]> {
  const results: ResearchedItem[] = [];

  await runWithConcurrency(items, RESEARCH_CONCURRENCY, async (item) => {
    const fullText = await fetchFullText(item.url);
    results.push({
      ...item,
      text: fullText ?? item.excerpt ?? "",
      depth: fullText ? "deep" : "shallow",
    });
  });

  return results;
}

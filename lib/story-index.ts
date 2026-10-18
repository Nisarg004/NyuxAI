import { and, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles, stories } from "@/lib/db/schema";
import { embedTexts, type TokenUsage, ZERO_USAGE } from "@/lib/llm";
import { matchStory, type StoryAnchor } from "@/lib/clustering";

const WINDOW_MS = 48 * 60 * 60 * 1000;
// Bounds one run's embedding spend if a long outage left a large backlog; the rest is picked up next run.
const MAX_EMBED_PER_RUN = 1500;

export type StoryIndexResult = {
  embedded: number;
  newStories: number;
  joined: number;
  usage: TokenUsage;
  error?: string;
};

// What gets embedded: the headline plus the start of the excerpt. Enough to identify an event,
// short enough that a day of ingest costs a fraction of a cent.
export function embeddingText(title: string, excerpt: string | null): string {
  return `${title}\n${(excerpt ?? "").slice(0, 400)}`.trim();
}

// Idempotent and self-healing: always works from "articles in the window that still lack an
// embedding / a story", so a run that failed halfway (or an outage) is finished by the next one.
export async function indexRecentArticles(now = new Date()): Promise<StoryIndexResult> {
  const since = new Date(now.getTime() - WINDOW_MS);
  const result: StoryIndexResult = { embedded: 0, newStories: 0, joined: 0, usage: ZERO_USAGE };

  const unembedded = await db
    .select({ id: articles.id, title: articles.title, excerpt: articles.excerpt })
    .from(articles)
    .where(and(isNull(articles.embedding), gte(articles.fetchedAt, since)))
    .limit(MAX_EMBED_PER_RUN);

  if (unembedded.length > 0) {
    const embedded = await embedTexts(unembedded.map((a) => embeddingText(a.title, a.excerpt)));
    result.usage = embedded.usage;
    if (!embedded.ok) return { ...result, error: embedded.error };
    for (let i = 0; i < unembedded.length; i++) {
      await db.update(articles).set({ embedding: embedded.vectors[i] }).where(eq(articles.id, unembedded[i].id));
    }
    result.embedded = unembedded.length;
  }

  const anchorRows = await db
    .select({ storyId: stories.id, sector: stories.sector, vector: articles.embedding, title: articles.title })
    .from(stories)
    .innerJoin(articles, eq(articles.id, stories.canonicalArticleId))
    .where(and(gte(stories.lastUpdated, since), isNotNull(articles.embedding)));
  const anchors: StoryAnchor[] = anchorRows.flatMap((r) => (r.vector ? [{ storyId: r.storyId, sector: r.sector, vector: r.vector, title: r.title }] : []));

  // Oldest first, so the earliest report of an event becomes its canonical article.
  const pending = await db
    .select({ id: articles.id, sector: articles.sector, vector: articles.embedding, title: articles.title })
    .from(articles)
    .where(and(isNull(articles.storyId), isNotNull(articles.embedding), gte(articles.fetchedAt, since)))
    .orderBy(sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt}) asc`);

  for (const article of pending) {
    if (!article.vector) continue;
    const match = matchStory({ vector: article.vector, sector: article.sector, title: article.title }, anchors);
    if (match) {
      await db.update(articles).set({ storyId: match.storyId }).where(eq(articles.id, article.id));
      await db.update(stories).set({ articleCount: sql`${stories.articleCount} + 1`, lastUpdated: now }).where(eq(stories.id, match.storyId));
      result.joined += 1;
    } else {
      const [story] = await db
        .insert(stories)
        .values({ sector: article.sector, canonicalArticleId: article.id, firstSeen: now, lastUpdated: now })
        .returning({ id: stories.id });
      await db.update(articles).set({ storyId: story.id }).where(eq(articles.id, article.id));
      anchors.push({ storyId: story.id, sector: article.sector, vector: article.vector, title: article.title });
      result.newStories += 1;
    }
  }

  return result;
}

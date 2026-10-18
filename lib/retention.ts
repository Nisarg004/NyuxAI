import { and, isNotNull, lt, notExists, eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles, authTokens, digestItems, landingRuns, sessions, stories } from "@/lib/db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const ARTICLE_RETENTION_DAYS = 14;

export type RetentionResult = {
  articlesDeleted: number;
  fullTextCleared: number;
  storiesDeleted: number;
  sessionsDeleted: number;
  authTokensDeleted: number;
  landingRunsDeleted: number;
};

// digest_items copy headline/summary/source_url, so an archived brief never
// needs its article row; articles a digest still points at are kept (the
// link is useful) but lose their bulky cached full_text.
export async function runRetention(now = new Date()): Promise<RetentionResult> {
  const articleCutoff = new Date(now.getTime() - ARTICLE_RETENTION_DAYS * DAY_MS);

  const deleted = await db
    .delete(articles)
    .where(
      and(
        lt(articles.fetchedAt, articleCutoff),
        notExists(db.select({ one: sql`1` }).from(digestItems).where(eq(digestItems.articleId, articles.id))),
      ),
    )
    .returning({ id: articles.id });

  const cleared = await db
    .update(articles)
    .set({ fullText: null, fullTextFetchedAt: null, embedding: null })
    .where(and(lt(articles.fetchedAt, articleCutoff), or(isNotNull(articles.fullText), isNotNull(articles.embedding))))
    .returning({ id: articles.id });

  // Stories only matter inside the 48h clustering window; articles pointing at a deleted one keep a null story_id.
  const storiesGone = await db.delete(stories).where(lt(stories.lastUpdated, articleCutoff)).returning({ id: stories.id });

  const sessionsGone = await db.delete(sessions).where(lt(sessions.expiresAt, now)).returning({ id: sessions.tokenHash });
  const tokensGone = await db
    .delete(authTokens)
    .where(lt(authTokens.expiresAt, new Date(now.getTime() - DAY_MS)))
    .returning({ id: authTokens.tokenHash });
  const landingGone = await db
    .delete(landingRuns)
    .where(lt(landingRuns.createdAt, new Date(now.getTime() - DAY_MS)))
    .returning({ id: landingRuns.id });

  return {
    articlesDeleted: deleted.length,
    fullTextCleared: cleared.length,
    storiesDeleted: storiesGone.length,
    sessionsDeleted: sessionsGone.length,
    authTokensDeleted: tokensGone.length,
    landingRunsDeleted: landingGone.length,
  };
}

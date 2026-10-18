import { and, isNotNull, lt, notExists, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles, authTokens, digestItems, landingRuns, sessions } from "@/lib/db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const ARTICLE_RETENTION_DAYS = 14;

export type RetentionResult = {
  articlesDeleted: number;
  fullTextCleared: number;
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
    .set({ fullText: null, fullTextFetchedAt: null })
    .where(and(lt(articles.fetchedAt, articleCutoff), isNotNull(articles.fullText)))
    .returning({ id: articles.id });

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
    sessionsDeleted: sessionsGone.length,
    authTokensDeleted: tokensGone.length,
    landingRunsDeleted: landingGone.length,
  };
}

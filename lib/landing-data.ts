import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles, sectorEditions, sources, type EditionItem } from "@/lib/db/schema";

// The numbers and the sample edition the landing page shows. Both are real, read
// from the database; any failure returns null so the page still renders.

export type LandingStats = { storiesToday: number; sources: number };

export async function getLandingStats(): Promise<LandingStats | null> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [[stories], [feeds]] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(articles).where(gt(articles.publishedAt, since)),
      db.select({ n: sql<number>`count(*)::int` }).from(sources).where(eq(sources.isActive, true)),
    ]);
    return { storiesToday: stories.n, sources: feeds.n };
  } catch (error) {
    console.error("[landing] stats unavailable", error);
    return null;
  }
}

export type ShowcaseEdition = { sector: string; bucketStart: Date; items: EditionItem[] };

// The most recent shared sector edition from the last two days, preferring Technology.
export async function getShowcaseEdition(): Promise<ShowcaseEdition | null> {
  try {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const rows = await db
      .select({ sector: sectorEditions.sector, bucketStart: sectorEditions.bucketStart, items: sectorEditions.items })
      .from(sectorEditions)
      .where(and(gt(sectorEditions.bucketStart, since), sql`jsonb_array_length(${sectorEditions.items}) >= 2`))
      .orderBy(desc(sectorEditions.bucketStart))
      .limit(10);
    const pick = rows.find((r) => r.sector === "Technology") ?? rows[0];
    return pick ? { ...pick, items: [...pick.items].sort((a, b) => a.rank - b.rank).slice(0, 3) } : null;
  } catch (error) {
    console.error("[landing] showcase edition unavailable", error);
    return null;
  }
}

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles, digestItems, digests, sources, users } from "@/lib/db/schema";
import { runRetention } from "@/lib/retention";

after(async () => {
  await db.$client.end();
});

test("retention deletes old unreferenced articles, keeps referenced ones but clears their full text", async () => {
  const tag = `retention-test-${Date.now()}`;
  const old = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
  const [source] = await db.insert(sources).values({ sector: "Test", name: tag, rssUrl: `https://${tag}.invalid/rss` }).returning();
  const [user] = await db.insert(users).values({ email: `${tag}@brieff.invalid`, name: "R" }).returning();
  try {
    const mk = (n: string, fetchedAt: Date) => ({
      sourceId: source.id, sector: "Test", title: n, url: `https://${tag}.invalid/${n}`,
      contentHash: `${tag}-${n}`, fetchedAt, fullText: "bulky text", fullTextFetchedAt: fetchedAt,
    });
    const [orphan, referenced, fresh] = await db
      .insert(articles)
      .values([mk("orphan", old), mk("referenced", old), mk("fresh", new Date())])
      .returning();

    const [digest] = await db.insert(digests).values({ userId: user.id, scheduledFor: new Date() }).returning();
    await db.insert(digestItems).values({
      digestId: digest.id, articleId: referenced.id, sector: "Test", headline: "h", summary: "s",
      whyItMatters: "w", sourceUrl: referenced.url, rank: 1,
    });

    await runRetention();

    const left = await db.select().from(articles).where(inArray(articles.id, [orphan.id, referenced.id, fresh.id]));
    const byTitle = Object.fromEntries(left.map((a) => [a.title, a]));
    assert.equal(byTitle.orphan, undefined, "old unreferenced article is deleted");
    assert.equal(byTitle.referenced.fullText, null, "old referenced article loses full_text");
    assert.equal(byTitle.fresh.fullText, "bulky text", "recent article is untouched");
  } finally {
    await db.delete(users).where(eq(users.id, user.id));
    await db.delete(sources).where(eq(sources.id, source.id));
  }
});

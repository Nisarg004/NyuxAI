import { test, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { articleBriefs, articles, sources } from "@/lib/db/schema";
import { ensureBriefs } from "@/lib/agents/article-brief";
import { personalizeWhyItMatters } from "@/lib/agents/personalizer";
import type { TokenUsage } from "@/lib/llm";

// Cache behaviour against the real database. Both articles already have a brief, so
// ensureBriefs must serve them with no research fetch and no LLM call at all — if it
// reached for either, this test would hang or spend tokens, so it asserts zero usage.
const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const skip = DB_AVAILABLE ? false : "DATABASE_URL not set";
const STAMP = `${Date.now()}-${Math.random()}`;
let sourceId: string | undefined;

after(async () => {
  if (DB_AVAILABLE && sourceId) await db.delete(sources).where(eq(sources.id, sourceId)); // cascades articles, briefs
  await db.$client.end();
});

test("cached briefs are served with no LLM calls; unverified ones are reported as rejections", { skip }, async () => {
  const [source] = await db.insert(sources).values({ sector: "Technology", name: "Cache Test", rssUrl: `https://example.invalid/${STAMP}` }).returning({ id: sources.id });
  sourceId = source.id;
  const [good, thin] = await db
    .insert(articles)
    .values(
      ["good", "thin"].map((k) => ({
        sourceId: source.id,
        sector: "Technology",
        title: `Cache ${k}`,
        url: `https://example.invalid/${STAMP}/${k}`,
        contentHash: `hash-${STAMP}-${k}`,
      })),
    )
    .returning({ id: articles.id });

  await db.insert(articleBriefs).values([
    { articleId: good.id, headline: "Good", summary: "S1. S2.", whyItMatters: "Because.", keyFacts: ["a"], verified: true, researchDepth: "deep", model: "test" },
    { articleId: thin.id, headline: "Thin", summary: "S.", keyFacts: [], verified: false, editorNotes: "Unsupported claim.", researchDepth: "deep", model: "test" },
  ]);

  const log: Record<string, unknown>[] = [];
  const spent: TokenUsage[] = [];
  const { briefs, failures } = await ensureBriefs(
    [good, thin].map((a, i) => ({ articleId: a.id, sector: "Technology", title: `t${i}`, url: `https://example.invalid/${i}`, source: "Cache Test", excerpt: null })),
    { log: (e) => log.push(e), track: (u) => (spent.push(u), u) },
  );

  assert.equal(failures.length, 0);
  assert.equal(briefs.get(good.id)?.verified, true);
  assert.equal(briefs.get(thin.id)?.verified, false);
  assert.equal(spent.length, 0, "no LLM usage may be recorded for a fully cached batch");

  const editor = log.find((e) => e.stage === "editor" && e.event === "finish");
  assert.equal(editor?.cached, true);
  assert.equal(editor?.approvedCount, 1);
  assert.deepEqual(editor?.rejected, [{ article_id: thin.id, reason: "Unsupported claim." }]);
});

test("personalizing zero items makes no LLM call", { skip }, async () => {
  const r = await personalizeWhyItMatters({ roleTitle: "CTO", items: [] });
  assert.equal(r.lines.size, 0);
  assert.equal(r.usage.totalTokens, 0);
});

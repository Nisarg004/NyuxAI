import { test, after } from "node:test";
import assert from "node:assert/strict";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles, sources, stories } from "@/lib/db/schema";
import { profileQuery, selectCandidates } from "@/lib/agents/candidates";

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const skip = DB_AVAILABLE ? false : "DATABASE_URL not set";
const STAMP = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
// A sector name no real article uses, so the test only ever sees its own rows.
const SECTOR = `CandidatesTest-${STAMP}`;
const sourceIds: string[] = [];
const storyIds: string[] = [];

after(async () => {
  if (DB_AVAILABLE) {
    if (sourceIds.length > 0) await db.delete(sources).where(inArray(sources.id, sourceIds)); // cascades articles
    if (storyIds.length > 0) await db.delete(stories).where(inArray(stories.id, storyIds));
  }
  await db.$client.end();
});

async function makeSource(n: number) {
  const [s] = await db.insert(sources).values({ sector: SECTOR, name: `Outlet ${n}`, rssUrl: `https://example.invalid/${STAMP}/${n}` }).returning({ id: sources.id });
  sourceIds.push(s.id);
  return s.id;
}

test("one candidate per story with an outlet count; the per-sector pool caps the rest", { skip }, async () => {
  const [a, b, c] = [await makeSource(1), await makeSource(2), await makeSource(3)];
  const [story] = await db.insert(stories).values({ sector: SECTOR }).returning({ id: stories.id });
  storyIds.push(story.id);

  const base = { sector: SECTOR, publishedAt: new Date() };
  // One story reported by three outlets...
  await db.insert(articles).values([
    { ...base, sourceId: a, title: "Big event", url: `https://example.invalid/${STAMP}/a`, contentHash: `h-${STAMP}-a`, excerpt: "short", storyId: story.id },
    { ...base, sourceId: b, title: "Big event, more detail", url: `https://example.invalid/${STAMP}/b`, contentHash: `h-${STAMP}-b`, excerpt: "the fullest excerpt of the three", storyId: story.id },
    { ...base, sourceId: c, title: "Big event again", url: `https://example.invalid/${STAMP}/c`, contentHash: `h-${STAMP}-c`, excerpt: "mid length", storyId: story.id },
  ]);
  // ...plus 6 unrelated single-outlet articles.
  await db.insert(articles).values(
    Array.from({ length: 6 }, (_, i) => ({ ...base, sourceId: a, title: `Solo ${i}`, url: `https://example.invalid/${STAMP}/s${i}`, contentHash: `h-${STAMP}-s${i}` })),
  );

  const all = await selectCandidates({ sectors: [SECTOR] });
  assert.equal(all.candidates.length, 7, "3 story articles collapse to 1, plus 6 solos");
  const big = all.candidates.find((x) => x.title.startsWith("Big event"));
  assert.equal(big?.outlets, 3);
  assert.equal(big?.excerpt, "the fullest excerpt of the three", "the fullest excerpt represents the story");
  assert.equal(all.candidates[0].title.startsWith("Big event") || all.stats.storyCount === 7, true);
  assert.equal(all.stats.prefiltered, false);

  const capped = await selectCandidates({ sectors: [SECTOR], perSectorPool: 3 });
  assert.equal(capped.candidates.length, 3);
  assert.ok(capped.candidates.some((x) => x.title.startsWith("Big event")), "multi-outlet stories rank first without a profile query");

  const limited = await selectCandidates({ sectors: [SECTOR], limit: 2 });
  assert.equal(limited.candidates.length, 2);
});

test("an empty sector list or unknown sector yields no candidates", { skip }, async () => {
  assert.equal((await selectCandidates({ sectors: [`none-${STAMP}`] })).candidates.length, 0);
});

test("profileQuery joins the profile parts and is null when there is nothing to say", () => {
  assert.equal(profileQuery({ roleTitle: null, keywords: [], feedbackProfile: null }), null);
  assert.equal(profileQuery({ roleTitle: "  ", keywords: [], feedbackProfile: "" }), null);
  assert.equal(
    profileQuery({ roleTitle: "CTO", keywords: ["ai", "chips"], feedbackProfile: "Prefers: deep dives." }),
    "CTO. Interests: ai, chips. Prefers: deep dives.",
  );
});

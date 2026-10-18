import { test, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences, runs, sectorEditions, users } from "@/lib/db/schema";
import { bucketStart, EDITION_BUCKET_MS, getOrBuildSectorEdition } from "@/lib/agents/edition";
import { generateDigest } from "@/lib/agents/pipeline";

test("bucketStart floors to the 12h UTC boundary", () => {
  assert.equal(bucketStart(new Date("2026-10-18T00:00:00.000Z")).toISOString(), "2026-10-18T00:00:00.000Z");
  assert.equal(bucketStart(new Date("2026-10-18T11:59:59.999Z")).toISOString(), "2026-10-18T00:00:00.000Z");
  assert.equal(bucketStart(new Date("2026-10-18T12:00:00.000Z")).toISOString(), "2026-10-18T12:00:00.000Z");
  assert.equal(bucketStart(new Date("2026-10-18T23:30:00.000Z")).toISOString(), "2026-10-18T12:00:00.000Z");
  assert.equal(EDITION_BUCKET_MS, 12 * 60 * 60 * 1000);
});

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const skip = DB_AVAILABLE ? false : "DATABASE_URL not set";
const STAMP = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
// A sector no real source uses: if the edition were NOT served from the table, the build path would
// find no articles, so a pass here can only come from the stored edition (and spends no tokens).
const SECTOR = `EditionTest-${STAMP}`;
let userId: string | undefined;

after(async () => {
  if (DB_AVAILABLE) {
    await db.delete(sectorEditions).where(eq(sectorEditions.sector, SECTOR));
    if (userId) await db.delete(users).where(eq(users.id, userId));
  }
  await db.$client.end();
});

const items = [1, 2, 3].map((rank) => ({
  article_id: `00000000-0000-4000-8000-00000000000${rank}`,
  headline: `Headline ${rank}`,
  summary: "First sentence. Second sentence.",
  why_it_matters: `Matters ${rank}.`,
  source_url: `https://example.invalid/${STAMP}/${rank}`,
  rank,
}));

test("a stored edition is returned without building", { skip }, async () => {
  await db.insert(sectorEditions).values({ sector: SECTOR, bucketStart: bucketStart(new Date()), items });
  const edition = await getOrBuildSectorEdition(SECTOR);
  assert.equal(edition.cached, true);
  assert.equal(edition.items.length, 3);
});

test("a sector-mode digest is assembled from editions with zero model tokens", { skip }, async () => {
  const [u] = await db.insert(users).values({ email: `edition-${STAMP}@brieff.invalid`, name: "Edition Test" }).returning({ id: users.id });
  userId = u.id;
  await db.insert(preferences).values({ userId, sectors: [SECTOR], mode: "sectors", depth: "brief", deliveryHour: 8, deliveryMinute: 0, timezone: "UTC" });

  const result = await generateDigest(userId, { dryRun: true });
  assert.ok(result.success, "digest should succeed");
  assert.equal(result.items.length, 3);
  assert.deepEqual(result.items.map((i) => i.rank), [1, 2, 3]);
  assert.ok(result.items.every((i) => i.sector === SECTOR && i.source_url.startsWith("https://")), "rule 2: every item has a source_url");
  assert.equal(result.items[0].summary, "First sentence.", "reader depth is applied to the shared summary");
  assert.equal(result.editorsNote, "", "no per-reader editor's note in sector mode");

  const [run] = await db.select({ tokenCost: runs.tokenCost }).from(runs).where(eq(runs.id, result.runId));
  assert.equal(Number(run.tokenCost), 0, "a sector-mode digest must spend no model tokens");
});

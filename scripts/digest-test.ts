import { generateDigest } from "../lib/agents/pipeline";

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("Usage: npm run digest:test <userId>");
    process.exit(1);
  }

  console.log(`Generating digest for user ${userId} (dry run)...\n`);

  const result = await generateDigest(userId, { dryRun: true });

  if (!result.success) {
    console.error(`Digest generation failed: ${result.error}`);
    process.exit(1);
  }

  if (result.editorsNote) {
    console.log(`Editor's note: ${result.editorsNote}\n`);
  }

  const bySector = new Map<string, typeof result.items>();
  for (const item of result.items) {
    const bucket = bySector.get(item.sector) ?? [];
    bucket.push(item);
    bySector.set(item.sector, bucket);
  }

  for (const [sector, items] of [...bySector.entries()].sort()) {
    console.log(`\n=== ${sector} ===`);
    for (const item of items) {
      console.log(`\n${item.rank}. ${item.headline}`);
      console.log(`   ${item.summary}`);
      console.log(`   Why it matters: ${item.why_it_matters}`);
      console.log(`   Source: ${item.source_url}`);
    }
  }

  if (result.rejected.length > 0) {
    console.log(`\n\n=== Rejected (${result.rejected.length}) ===`);
    for (const r of result.rejected) {
      console.log(`- ${r.article_id}: ${r.reason}`);
    }
  }

  console.log(`\n\nRun ${result.runId} — ${result.items.length} items, ${result.rejected.length} rejected.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Digest test failed:", err);
  process.exit(1);
});

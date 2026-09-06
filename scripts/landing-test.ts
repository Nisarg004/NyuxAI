import { generateBrief } from "../lib/agents/pipeline";

async function main() {
  const roleTitle = process.argv[2] ?? "Product manager";
  const sectors = (process.argv[3] ?? "Technology,Business").split(",").map((s) => s.trim());

  console.log(`Anonymous brief — role "${roleTitle}", sectors ${sectors.join(", ")}\n`);

  const result = await generateBrief(
    {
      userName: "there",
      roleTitle,
      sectors,
      keywords: [],
      feedbackProfile: null,
      depth: "standard",
    },
    { kind: "landing", userId: null, maxCandidates: 45, maxItemsPerSector: 3 }
  );

  if (!result.success) {
    console.error(`Failed: ${result.error}`);
    process.exit(1);
  }

  const curatorStart = result.stageLog.find(
    (e) => (e as Record<string, unknown>).stage === "curator" && (e as Record<string, unknown>).event === "start"
  );
  console.log("Curator start entry:", JSON.stringify(curatorStart), "\n");

  if (result.editorsNote) console.log(`Editor's note: ${result.editorsNote}\n`);

  const bySector = new Map<string, typeof result.items>();
  for (const item of result.items) {
    const bucket = bySector.get(item.sector) ?? [];
    bucket.push(item);
    bySector.set(item.sector, bucket);
  }
  for (const [sector, items] of [...bySector.entries()].sort()) {
    console.log(`\n=== ${sector} (${items.length}) ===`);
    for (const item of items) {
      console.log(`\n${item.rank}. ${item.headline}`);
      console.log(`   ${item.summary}`);
      console.log(`   Why it matters: ${item.why_it_matters}`);
      console.log(`   Source: ${item.source_url}`);
    }
  }

  console.log(`\n\nRun ${result.runId} — ${result.items.length} items, ${result.rejected.length} rejected.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Landing test failed:", err);
  process.exit(1);
});

import { db } from "./index";
import { sources } from "./schema";
import { seedSources } from "./candidate-sources";

async function main() {
  await db.delete(sources);

  const inserted = await db
    .insert(sources)
    .values(
      seedSources.map((s) => ({
        sector: s.sector,
        name: s.name,
        rssUrl: s.rssUrl,
        weight: s.weight,
        isActive: true,
      }))
    )
    .returning({ sector: sources.sector });

  const counts = inserted.reduce<Record<string, number>>((acc, row) => {
    acc[row.sector] = (acc[row.sector] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Seeded ${inserted.length} sources:`);
  for (const [sector, count] of Object.entries(counts).sort()) {
    console.log(`  ${sector}: ${count}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

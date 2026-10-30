// Applies lib/db/candidate-sources.ts to the `sources` table without deleting
// anything (see planSourceSync). Prints the plan; pass --apply to write it.
//   npm run db:sync-sources            # show what would change
//   npm run db:sync-sources -- --apply # change it
import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { sources } from "../lib/db/schema";
import { seedSources } from "../lib/db/candidate-sources";
import { planSourceSync } from "../lib/db/source-sync";

async function main() {
  const apply = process.argv.includes("--apply");
  const existing = await db
    .select({
      id: sources.id,
      rssUrl: sources.rssUrl,
      name: sources.name,
      sector: sources.sector,
      weight: sources.weight,
      isActive: sources.isActive,
    })
    .from(sources);
  const plan = planSourceSync(existing, seedSources);

  for (const s of plan.insert) console.log(`+ add       ${s.sector}: ${s.name}`);
  for (const s of plan.update) console.log(`~ update    ${s.sector}: ${s.name} (weight ${s.weight})`);
  for (const s of plan.deactivate) console.log(`- switch off ${s.name}`);
  if (!plan.insert.length && !plan.update.length && !plan.deactivate.length) console.log("Already in sync.");

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to make these changes.");
    return;
  }

  await db.transaction(async (tx) => {
    if (plan.insert.length) {
      await tx.insert(sources).values(plan.insert.map((s) => ({ ...s, isActive: true })));
    }
    for (const u of plan.update) {
      await tx.update(sources).set({ name: u.name, sector: u.sector, weight: u.weight }).where(eq(sources.id, u.id));
    }
    if (plan.deactivate.length) {
      await tx
        .update(sources)
        .set({ isActive: false })
        .where(inArray(sources.id, plan.deactivate.map((d) => d.id)));
    }
  });
  console.log("\nApplied.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Source sync failed:", err);
    process.exit(1);
  });

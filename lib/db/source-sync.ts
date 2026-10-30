import type { SeedSource } from "./candidate-sources";

export type ExistingSource = { id: string; rssUrl: string; name: string; sector: string; weight: number; isActive: boolean };

export type SourceSyncPlan = {
  insert: SeedSource[];
  update: { id: string; name: string; sector: string; weight: number }[];
  deactivate: { id: string; name: string }[];
};

/**
 * Brings the `sources` table in line with the curated list, matched by feed URL.
 * Never deletes: articles cascade on source delete, so a removed feed is switched
 * off instead. A listed feed keeps its current on/off state, so a feed ingestion
 * auto-disabled after repeated failures stays off until someone re-enables it.
 */
export function planSourceSync(existing: ExistingSource[], desired: SeedSource[]): SourceSyncPlan {
  const byUrl = new Map(existing.map((s) => [s.rssUrl, s]));
  const wanted = new Set(desired.map((s) => s.rssUrl));

  const insert = desired.filter((s) => !byUrl.has(s.rssUrl));
  const update = desired.flatMap((s) => {
    const row = byUrl.get(s.rssUrl);
    if (!row || (row.name === s.name && row.sector === s.sector && row.weight === s.weight)) return [];
    return [{ id: row.id, name: s.name, sector: s.sector, weight: s.weight }];
  });
  const deactivate = existing
    .filter((s) => s.isActive && !wanted.has(s.rssUrl))
    .map((s) => ({ id: s.id, name: s.name }));

  return { insert, update, deactivate };
}

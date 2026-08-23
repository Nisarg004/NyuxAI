type RejectedItem = { article_id: string; reason: string };

export function extractRejectionsBySector(stageLog: unknown[]): Record<string, RejectedItem[]> {
  const bySector: Record<string, RejectedItem[]> = {};

  for (const raw of stageLog) {
    if (typeof raw !== "object" || raw === null) continue;
    const e = raw as Record<string, unknown>;
    if (e.stage !== "editor" || e.event !== "finish") continue;

    const sector = typeof e.sector === "string" ? e.sector : null;
    const rejected = Array.isArray(e.rejected) ? (e.rejected as RejectedItem[]) : [];
    if (!sector || rejected.length === 0) continue;

    bySector[sector] = [...(bySector[sector] ?? []), ...rejected];
  }

  return bySector;
}

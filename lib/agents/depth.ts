export type Depth = "brief" | "standard" | "deep";

// Shared briefs are written once, at standard density, for every reader. A reader's
// `depth` is applied when assembling their digest: "brief" keeps only the lead sentence.
// "deep" currently reads as standard — a fuller summary would need its own shared pass.
export function applyDepth(summary: string, depth: Depth): string {
  if (depth !== "brief") return summary;
  const [lead] = summary.trim().split(/(?<=[.!?])\s+/);
  return lead ?? summary;
}

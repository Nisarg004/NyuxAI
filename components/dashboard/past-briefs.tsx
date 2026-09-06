import { DigestList } from "@/components/archive/digest-list";
import type { DigestSummary } from "@/lib/data/digests";

/** Everything the desk has sent before the one shown inline, kept collapsed
 * below the fold — the reader came for today's brief, not an index. */
export function PastBriefs({
  summaries,
  excludeId,
  timezone,
}: {
  summaries: DigestSummary[];
  excludeId?: string;
  timezone: string;
}) {
  const earlier = summaries.filter((s) => s.id !== excludeId);
  if (earlier.length === 0) return null;

  return (
    <details className="group">
      <summary className="cursor-pointer list-none font-display text-sm italic text-ink-soft marker:content-none hover:text-ink">
        Past briefs{" "}
        <span className="text-editor group-open:hidden">show</span>
        <span className="hidden text-editor group-open:inline">hide</span>
      </summary>
      <DigestList summaries={earlier} timezone={timezone} />
    </details>
  );
}

import { ChevronDown } from "lucide-react";
import { DigestList } from "@/components/archive/digest-list";
import type { DigestSummary } from "@/lib/data/digests";

/** Everything Nyux has sent before the one shown inline, kept collapsed in the
 * side column: the reader came for today's brief, not an index. */
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
    <details className="group panel">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[20px] px-5 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-display text-lg font-semibold text-star">Past briefs</span>
          <span className="text-sm text-haze">
            {earlier.length} earlier {earlier.length === 1 ? "brief" : "briefs"}
          </span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-haze transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-line p-2">
        <DigestList summaries={earlier} timezone={timezone} />
      </div>
    </details>
  );
}

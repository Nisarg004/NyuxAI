import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { groupBriefsByDay } from "@/lib/brief-index";
import type { DigestSummary } from "@/lib/data/digests";

function runStatusLabel(status: string): string | null {
  if (status === "failed") return "Didn’t finish";
  if (status === "generating") return "Being written";
  return null;
}

/** Past briefs as rows on night: the day, how many stories, the lead headlines. */
export function DigestList({
  summaries,
  timezone,
}: {
  summaries: DigestSummary[];
  timezone: string;
}) {
  if (summaries.length === 0) {
    return (
      <p className="text-[1.0625rem] leading-[1.65] text-haze">
        No briefs yet. Send one from Today to see it here.
      </p>
    );
  }

  const rows = groupBriefsByDay(summaries, timezone);

  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => {
        const statusLabel = runStatusLabel(row.status);
        return (
          <li key={row.key}>
            <Link
              href={`/archive/${row.latestId}`}
              className="group flex items-start gap-3 rounded-2xl px-3 py-4 transition-colors hover:bg-night/60 sm:px-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-[1.0625rem] font-semibold text-star">
                    {row.dayLabel}
                  </span>
                  <span className="text-sm text-haze">
                    {row.itemCount} {row.itemCount === 1 ? "story" : "stories"}
                  </span>
                  {row.runs > 1 ? (
                    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-haze">
                      {row.runs} runs
                    </span>
                  ) : null}
                  {statusLabel ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        row.status === "failed" ? "bg-alarm/15 text-alarm" : "bg-aurora/15 text-aurora"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  ) : null}
                </div>
                {row.headlines.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {row.headlines.slice(0, 3).map((h, i) => (
                      <li key={i} className="truncate text-sm leading-[1.5] text-haze">
                        {h}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <ChevronRight
                className="mt-1 size-4 shrink-0 text-haze transition-transform group-hover:translate-x-0.5 group-hover:text-star"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

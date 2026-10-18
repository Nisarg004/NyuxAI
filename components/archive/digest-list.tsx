import Link from "next/link";
import { groupBriefsByDay } from "@/lib/brief-index";
import type { DigestSummary } from "@/lib/data/digests";

function runStatusSuffix(status: string): string {
  if (status === "failed") return " · didn’t finish";
  if (status === "generating") return " · being written";
  return "";
}

export function DigestList({
  summaries,
  timezone,
}: {
  summaries: DigestSummary[];
  timezone: string;
}) {
  if (summaries.length === 0) {
    return (
      <p className="mt-6 text-[1.0625rem] leading-[1.7] text-ink-soft">
        No editions yet. Send one from your desk to see it here.
      </p>
    );
  }

  const rows = groupBriefsByDay(summaries, timezone);

  return (
    <ul className="mt-2">
      {rows.map((row) => (
        <li key={row.key} className="border-b border-rule last:border-0">
          <Link href={`/archive/${row.latestId}`} className="group block py-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-display text-[1.0625rem] text-ink group-hover:text-editor">
                {row.dayLabel}
              </span>
              <span className="shrink-0 text-sm text-ink-soft">
                {row.itemCount} item{row.itemCount === 1 ? "" : "s"}
                {row.runs > 1 ? ` · ${row.runs} runs` : ""}
                {runStatusSuffix(row.status)}
              </span>
            </div>
            {row.headlines.length > 0 ? (
              <p className="mt-1 line-clamp-2 text-sm leading-[1.5] text-ink-soft">
                {row.headlines.join(" · ")}
              </p>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

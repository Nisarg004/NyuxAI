import { DateTime } from "luxon";
import type { DigestSummary } from "@/lib/data/digests";

export type BriefIndexRow = {
  key: string;
  dayLabel: string;
  /** The brief a click on this row opens — the latest run of that day. */
  latestId: string;
  runs: number;
  headlines: string[];
  itemCount: number;
  status: string;
};

/**
 * Collapse a list of digest summaries into one row per calendar day (in the
 * reader's timezone), so four briefs generated on one day read as one entry
 * with a "4 runs" marker rather than looking like the product is broken. The
 * row carries the latest run's headlines and count.
 */
export function groupBriefsByDay(
  summaries: DigestSummary[],
  timezone: string
): BriefIndexRow[] {
  const now = DateTime.now().setZone(timezone);
  const byDay = new Map<string, DigestSummary[]>();

  for (const summary of summaries) {
    const when = DateTime.fromJSDate(summary.sentAt ?? summary.scheduledFor, { zone: timezone });
    const key = when.toFormat("yyyy-LL-dd");
    const arr = byDay.get(key) ?? [];
    arr.push(summary);
    byDay.set(key, arr);
  }

  const rows: BriefIndexRow[] = [];
  for (const [key, group] of byDay) {
    // `summaries` arrives newest-first, so group[0] is the day's latest run.
    const latest = group[0];
    const when = DateTime.fromJSDate(latest.sentAt ?? latest.scheduledFor, { zone: timezone });
    rows.push({
      key,
      dayLabel: when.hasSame(now, "year") ? when.toFormat("d LLL") : when.toFormat("d LLL yyyy"),
      latestId: latest.id,
      runs: group.length,
      headlines: latest.headlines,
      itemCount: latest.itemCount,
      status: latest.status,
    });
  }

  return rows.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}

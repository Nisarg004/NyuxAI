import { DateTime } from "luxon";
import { getRecentDigests } from "@/lib/data/digests";
import { getDigestDetail } from "@/lib/data/archive";

type Detail = NonNullable<Awaited<ReturnType<typeof getDigestDetail>>>;

export type DashboardBrief =
  | { kind: "none" }
  | {
      kind: "today" | "recent";
      dateLabel: string;
      weekday: string;
      status: string;
      sentAt: Date | null;
      detail: Detail;
    };

/**
 * The brief the dashboard should render inline: today's if one has run in the
 * reader's timezone, otherwise the most recent one (the caller labels it as
 * such). Returns `none` for a reader who has never had a brief.
 */
export async function getDashboardBrief(
  userId: string,
  timezone: string
): Promise<DashboardBrief> {
  const [latest] = await getRecentDigests(userId, 1);
  if (!latest) return { kind: "none" };

  const detail = await getDigestDetail(latest.id, userId);
  if (!detail) return { kind: "none" };

  const when = DateTime.fromJSDate(latest.sentAt ?? latest.scheduledFor, { zone: timezone });
  const isToday = when.hasSame(DateTime.now().setZone(timezone), "day");

  return {
    kind: isToday ? "today" : "recent",
    dateLabel: when.toFormat("d LLLL yyyy"),
    weekday: when.toFormat("cccc"),
    status: latest.status,
    sentAt: latest.sentAt,
    detail,
  };
}

import Link from "next/link";
import { DateTime } from "luxon";

export function DigestList({
  digests,
  timezone,
}: {
  digests: { id: string; scheduledFor: Date; sentAt: Date | null; status: string; subject: string | null }[];
  timezone: string;
}) {
  if (digests.length === 0) {
    return (
      <p className="mt-6 text-[1.0625rem] leading-[1.7] text-ink-soft">
        No editions yet. Send one from your desk to see it here.
      </p>
    );
  }

  return (
    <ul className="mt-2">
      {digests.map((d) => {
        const date = DateTime.fromJSDate(d.scheduledFor, { zone: timezone });
        return (
          <li key={d.id} className="border-b border-rule last:border-0">
            <Link href={`/archive/${d.id}`} className="group flex items-baseline justify-between gap-4 py-3">
              <span className="font-display text-[1.0625rem] text-ink group-hover:text-editor">
                {date.toFormat("cccc d LLLL yyyy")}
              </span>
              <span className="shrink-0 text-sm text-ink-soft">
                {d.sentAt
                  ? `Sent ${DateTime.fromJSDate(d.sentAt, { zone: timezone }).toFormat("HH:mm")}`
                  : d.status === "ready"
                    ? "Ready"
                    : d.status}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

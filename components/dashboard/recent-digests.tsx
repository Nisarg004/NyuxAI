import Link from "next/link";
import { DateTime } from "luxon";

export function RecentDigests({
  digests,
  timezone,
}: {
  digests: { id: string; scheduledFor: Date; sentAt: Date | null; status: string; subject: string | null }[];
  timezone: string;
}) {
  return (
    <section>
      <h2 className="font-display text-sm italic text-ink-soft">Recent editions</h2>
      {digests.length === 0 ? (
        <p className="mt-2 text-[0.95rem] text-ink-soft">
          Nothing sent yet. Send one now to see your first edition.
        </p>
      ) : (
        <ul className="mt-2">
          {digests.map((d) => {
            const date = DateTime.fromJSDate(d.scheduledFor, { zone: timezone });
            return (
              <li key={d.id} className="border-b border-rule last:border-0">
                <Link
                  href={`/archive/${d.id}`}
                  className="group flex items-baseline justify-between gap-4 py-2.5"
                >
                  <span className="font-display text-[1.0625rem] text-ink group-hover:text-editor">
                    {date.toFormat("cccc d LLLL")}
                  </span>
                  <span className="shrink-0 text-sm text-ink-soft">
                    {d.sentAt
                      ? DateTime.fromJSDate(d.sentAt, { zone: timezone }).toFormat("HH:mm")
                      : d.status === "ready"
                        ? "Ready"
                        : d.status}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

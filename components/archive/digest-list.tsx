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
    return <p className="text-sm text-slate">No briefs yet — send one from the dashboard to see it here.</p>;
  }

  return (
    <ul className="divide-y divide-border/60 rounded-md border border-border bg-white">
      {digests.map((d) => (
        <li key={d.id}>
          <Link href={`/archive/${d.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-paper">
            <span className="text-sm font-medium text-ink">
              {d.subject ?? DateTime.fromJSDate(d.scheduledFor, { zone: timezone }).toFormat("ccc d LLL yyyy")}
            </span>
            <span className="font-mono text-xs uppercase text-slate">
              {d.sentAt ? DateTime.fromJSDate(d.sentAt, { zone: timezone }).toFormat("d LLL, HH:mm") : d.status}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

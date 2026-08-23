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
    <div className="rounded-md border border-border bg-white p-5">
      <h2 className="font-display text-lg text-ink">Recent digests</h2>
      {digests.length === 0 ? (
        <p className="mt-3 text-sm text-slate">Nothing sent yet — hit Send now to generate your first brief.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border/60">
          {digests.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2 text-sm">
              <Link href={`/archive/${d.id}`} className="text-ink hover:text-amber">
                {d.subject ?? DateTime.fromJSDate(d.scheduledFor, { zone: timezone }).toFormat("ccc d LLL, HH:mm")}
              </Link>
              <span className="font-mono text-xs uppercase text-slate">{d.sentAt ? "sent" : d.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

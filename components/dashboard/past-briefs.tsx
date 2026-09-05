import { DigestList } from "@/components/archive/digest-list";

/** Everything the desk has sent before the one shown inline, kept collapsed
 * below the fold — the reader came for today's brief, not an index. */
export function PastBriefs({
  digests,
  timezone,
}: {
  digests: { id: string; scheduledFor: Date; sentAt: Date | null; status: string; subject: string | null }[];
  timezone: string;
}) {
  const earlier = digests.slice(1);
  if (earlier.length === 0) return null;

  return (
    <details className="group">
      <summary className="cursor-pointer list-none font-display text-sm italic text-ink-soft marker:content-none hover:text-ink">
        Past briefs ({earlier.length}){" "}
        <span className="text-editor group-open:hidden">show</span>
        <span className="hidden text-editor group-open:inline">hide</span>
      </summary>
      <DigestList digests={earlier} timezone={timezone} />
    </details>
  );
}

import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { requireUser } from "@/lib/session";
import { getDigestDetail } from "@/lib/data/archive";
import { Nav } from "@/components/nav";
import { SectorSection } from "@/components/archive/sector-section";

export default async function ArchiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, preferences } = await requireUser();
  const detail = await getDigestDetail(id, user.id);
  if (!detail) notFound();

  const { digest, itemsBySector, rejectionsBySector, existingFeedback } = detail;
  const dateLabel = DateTime.fromJSDate(digest.sentAt ?? digest.scheduledFor, { zone: preferences.timezone }).toFormat("ccc d LLL yyyy · HH:mm");

  return (
    <>
      <Nav current="archive" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <p className="font-mono text-xs uppercase tracking-wide text-slate">{dateLabel}</p>
        <h1 className="mt-1 font-display text-2xl text-ink">{digest.subject ?? `${user.name}’s brief`}</h1>

        <div className="mt-6">
          {itemsBySector.map(({ sector, items }) => (
            <SectorSection
              key={sector}
              sector={sector}
              items={items.map((i) => ({ id: i.id, headline: i.headline, summary: i.summary, whyItMatters: i.whyItMatters, sourceUrl: i.sourceUrl }))}
              rejected={rejectionsBySector[sector] ?? []}
              existingFeedback={existingFeedback}
            />
          ))}
        </div>
      </main>
    </>
  );
}

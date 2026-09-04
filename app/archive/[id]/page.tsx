import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { requireUser } from "@/lib/session";
import { getDigestDetail } from "@/lib/data/archive";
import { formatSectorList } from "@/lib/countdown";
import { Nav } from "@/components/nav";
import { SectorSection } from "@/components/archive/sector-section";

export default async function ArchiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, preferences } = await requireUser();
  const detail = await getDigestDetail(id, user.id);
  if (!detail) notFound();

  const { digest, itemsBySector, rejectionsBySector, existingFeedback } = detail;
  const date = DateTime.fromJSDate(digest.sentAt ?? digest.scheduledFor, { zone: preferences.timezone });
  const sectorLabel = formatSectorList(itemsBySector.map((s) => s.sector));

  return (
    <>
      <Nav current="archive" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <header className="border-b border-ink pb-5">
          <h1 className="font-display text-[2rem] font-semibold leading-[1.15] tracking-[-0.01em] text-ink">
            The {date.toFormat("cccc")} edition
          </h1>
          <p className="mt-2 font-display italic text-ink-soft">
            {date.toFormat("d LLLL yyyy")}, sent {date.toFormat("HH:mm")} — for {user.name}
          </p>
          {sectorLabel ? <p className="mt-1 text-sm text-ink-soft">{sectorLabel}</p> : null}
        </header>

        <div>
          {itemsBySector.map(({ sector, items }) => (
            <SectorSection
              key={sector}
              sector={sector}
              items={items.map((i) => ({
                id: i.id,
                headline: i.headline,
                summary: i.summary,
                whyItMatters: i.whyItMatters,
                sourceUrl: i.sourceUrl,
              }))}
              rejected={rejectionsBySector[sector] ?? []}
              existingFeedback={existingFeedback}
            />
          ))}
        </div>
      </main>
    </>
  );
}

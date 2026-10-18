import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { requireUser } from "@/lib/session";
import { getDigestDetail } from "@/lib/data/archive";
import { formatSectorList } from "@/lib/countdown";
import { Nav } from "@/components/nav";
import { BriefBody } from "@/components/brief/brief-body";

export default async function ArchiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, preferences } = await requireUser();
  const detail = await getDigestDetail(id, user.id);
  if (!detail) notFound();

  const { digest, editorsNote, itemsBySector, rejectionsBySector, existingFeedback } = detail;
  const date = DateTime.fromJSDate(digest.sentAt ?? digest.scheduledFor, { zone: preferences.timezone });
  const sectorLabel = formatSectorList(itemsBySector.map((s) => s.sector));

  return (
    <>
      <Nav current="archive" isAdmin={user.role === "admin"} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="max-w-2xl">
          <header className="border-b border-ink pb-5">
            <h1 className="font-display text-[2rem] font-semibold leading-[1.15] tracking-[-0.01em] text-ink">
              The {date.toFormat("cccc")} edition
            </h1>
            <p className="mt-2 font-display italic text-ink-soft">
              {date.toFormat("d LLLL yyyy")}, sent {date.toFormat("HH:mm")} — for {user.name}
            </p>
            {sectorLabel ? <p className="mt-1 text-sm text-ink-soft">{sectorLabel}</p> : null}
          </header>

          <BriefBody
            editorsNote={editorsNote}
            itemsBySector={itemsBySector}
            rejectionsBySector={rejectionsBySector}
            existingFeedback={existingFeedback}
          />
        </div>
      </main>
    </>
  );
}

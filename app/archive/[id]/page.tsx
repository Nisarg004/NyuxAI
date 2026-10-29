import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { ChevronLeft } from "lucide-react";
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
    <div className="horizon flex min-h-screen flex-1 flex-col">
      <Nav current="archive" isAdmin={user.role === "admin"} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link
          href="/archive"
          className="inline-flex items-center gap-1 rounded-full text-sm text-haze transition-colors hover:text-star"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Past briefs
        </Link>

        <article className="sheet mt-5 px-5 py-7 sm:px-10 sm:py-10">
          <header className="border-b border-rule pb-6">
            <p className="text-sm text-ink-soft">
              {date.toFormat("d LLLL yyyy")}, sent at {date.toFormat("HH:mm")} for {user.name}
            </p>
            <h1 className="mt-2 font-display text-[clamp(1.875rem,4vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.03em] text-ink">
              The {date.toFormat("cccc")} brief
            </h1>
            {sectorLabel ? <p className="mt-2 text-sm text-ink-soft">{sectorLabel}</p> : null}
          </header>

          <div className="mt-6">
            <BriefBody
              editorsNote={editorsNote}
              itemsBySector={itemsBySector}
              rejectionsBySector={rejectionsBySector}
              existingFeedback={existingFeedback}
            />
          </div>
        </article>
      </main>
    </div>
  );
}

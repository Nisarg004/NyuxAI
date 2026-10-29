import { SectorSection } from "@/components/archive/sector-section";

type ItemsBySector = {
  sector: string;
  items: {
    id: string;
    headline: string;
    summary: string;
    whyItMatters: string;
    sourceUrl: string;
  }[];
}[];

/**
 * The brief itself, rendered the same way wherever it appears — inline on the
 * dashboard and on the archive detail page, always inside a morning `.sheet`.
 * Same content as the email: the editor's note, then each sector with its
 * items, why-it-matters, source links and feedback.
 */
export function BriefBody({
  editorsNote,
  itemsBySector,
  rejectionsBySector,
  existingFeedback,
}: {
  editorsNote: string;
  itemsBySector: ItemsBySector;
  rejectionsBySector: Record<string, { article_id: string; reason: string }[]>;
  existingFeedback: Record<string, "up" | "down" | "save">;
}) {
  return (
    <div>
      {editorsNote ? (
        <aside className="mb-6 rounded-[20px] bg-morning-2 px-5 py-4 sm:px-6 sm:py-5">
          <p className="text-sm font-semibold text-ink">Editor&rsquo;s note</p>
          <p className="mt-1.5 text-[1.0625rem] leading-[1.6] text-ink">{editorsNote}</p>
        </aside>
      ) : null}
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
  );
}

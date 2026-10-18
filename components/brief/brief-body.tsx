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
 * dashboard and on the archive detail page. Same content as the email: the
 * editor's note, then each sector with its items, why-it-matters, source links
 * and thumbs up/down.
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
        <p className="border-b border-rule py-6 font-display text-[1.0625rem] italic leading-[1.6] text-ink-soft">
          {editorsNote}
        </p>
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

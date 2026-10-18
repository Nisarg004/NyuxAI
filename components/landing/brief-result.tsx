import { SectorSection } from "@/components/archive/sector-section";
import type { LandingBrief } from "@/lib/hooks/use-landing-brief";

export function BriefResult({ brief }: { brief: LandingBrief }) {
  const hasItems = brief.sectors.some((s) => s.items.length > 0);

  if (!hasItems) {
    return (
      <p className="mt-8 text-[1.0625rem] leading-[1.7] text-ink-soft">
        Nothing in those desks cleared the bar in the last day. A standing brief pulls from more
        sources and more time — set one up and tomorrow&rsquo;s edition will have more to work with.
      </p>
    );
  }

  return (
    <div className="mt-8 max-w-2xl">
      {brief.editorsNote ? (
        <p className="border-b border-ink pb-5 font-display text-[1.05rem] italic leading-[1.6] text-ink">
          {brief.editorsNote}
        </p>
      ) : null}
      {brief.sectors
        .filter((s) => s.items.length > 0)
        .map((s) => (
          <SectorSection
            key={s.sector}
            sector={s.sector}
            readOnly
            items={s.items.map((i) => ({
              id: i.sourceUrl,
              headline: i.headline,
              summary: i.summary,
              whyItMatters: i.whyItMatters,
              sourceUrl: i.sourceUrl,
            }))}
          />
        ))}
    </div>
  );
}

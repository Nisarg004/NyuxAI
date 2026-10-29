import { SectorSection } from "@/components/archive/sector-section";
import type { LandingBrief } from "@/lib/hooks/use-landing-brief";

export function BriefResult({ brief }: { brief: LandingBrief }) {
  const hasItems = brief.sectors.some((s) => s.items.length > 0);

  if (!hasItems) {
    return (
      <p className="mt-6 rounded-[14px] border border-line bg-night-2 p-5 text-[0.975rem] leading-[1.6] text-haze">
        Nothing on those desks cleared the editor in the last day. A daily brief draws on more sources and
        more time, so tomorrow&rsquo;s will have more to work with.
      </p>
    );
  }

  return (
    <div className="sheet mt-6 p-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-700 sm:p-10">
      {brief.editorsNote ? (
        <p className="mb-8 border-l-2 border-aurora pl-4 text-[1.05rem] leading-[1.6] text-ink">
          {brief.editorsNote}
        </p>
      ) : null}
      <div className="space-y-10">
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
    </div>
  );
}

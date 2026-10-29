import { SectorSection } from "@/components/archive/sector-section";
import type { ShowcaseEdition } from "@/lib/landing-data";

function builtAgo(at: Date) {
  const hours = Math.max(1, Math.round((Date.now() - at.getTime()) / 3_600_000));
  return hours < 24 ? `${hours} ${hours === 1 ? "hour" : "hours"} ago` : "yesterday";
}

// A real, current edition, exactly as the shared sector brief stored it.
export function Showcase({ edition }: { edition: ShowcaseEdition }) {
  return (
    <section className="border-t border-line/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-24 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
        <div>
          <h2 className="font-display text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[1] tracking-[-0.035em] text-star">
            This is what lands in your inbox.
          </h2>
          <p className="mt-5 text-[1.0625rem] leading-[1.65] text-haze">
            The top of today&rsquo;s {edition.sector} edition, written {builtAgo(edition.bucketStart)}. Nothing
            here was edited by hand.
          </p>
        </div>
        <div className="sheet p-6 sm:p-10">
          <SectorSection
            sector={edition.sector}
            readOnly
            items={edition.items.map((i) => ({
              id: i.article_id,
              headline: i.headline,
              summary: i.summary,
              whyItMatters: i.why_it_matters,
              sourceUrl: i.source_url,
            }))}
          />
        </div>
      </div>
    </section>
  );
}

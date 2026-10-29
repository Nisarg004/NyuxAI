"use client";

import { useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { FeedbackButtons } from "./feedback-buttons";

type Item = {
  id: string;
  headline: string;
  summary: string;
  whyItMatters: string;
  sourceUrl: string;
};

/** "https://www.reuters.com/x/y" -> "reuters.com"; falls back to the raw URL. */
function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * One sector of a brief, designed for a morning sheet (ink on light). Used on
 * the dashboard, the archive and, read-only, on the public landing page.
 */
export function SectorSection({
  sector,
  items,
  rejected = [],
  existingFeedback = {},
  readOnly = false,
}: {
  sector: string;
  items: Item[];
  rejected?: { article_id: string; reason: string }[];
  existingFeedback?: Record<string, "up" | "down" | "save">;
  readOnly?: boolean;
}) {
  const [showRejected, setShowRejected] = useState(false);

  return (
    <section className="border-b border-rule py-8 first:pt-2 last:border-0 last:pb-2">
      <h2 className="flex items-center gap-3 text-sm font-medium text-ink-soft">
        <span className="size-1.5 rounded-full bg-aurora" aria-hidden />
        {sector}
      </h2>

      {items.length === 0 ? (
        <p className="mt-4 text-[1.0625rem] leading-[1.65] text-ink-soft">
          Nothing in {sector} cleared the bar today.
        </p>
      ) : (
        <div className="mt-5 space-y-10">
          {items.map((item) => (
            <article key={item.id}>
              <h3 className="font-display text-[1.375rem] font-semibold leading-[1.2] tracking-[-0.015em] text-ink sm:text-[1.5rem]">
                {item.headline}
              </h3>
              <p className="mt-3 text-[1.0625rem] leading-[1.65] text-ink/90">{item.summary}</p>
              {item.whyItMatters ? (
                <div className="mt-4 rounded-2xl border-l-[3px] border-aurora bg-morning-2 px-4 py-3.5 sm:px-5">
                  <p className="text-sm font-semibold text-ink">Why it matters</p>
                  <p className="mt-1 text-[0.975rem] leading-[1.6] text-ink">{item.whyItMatters}</p>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 rounded-full text-sm font-medium text-ink-soft underline decoration-rule underline-offset-4 transition-colors hover:text-ink hover:decoration-ink"
                >
                  <span className="truncate">Source: {sourceDomain(item.sourceUrl)}</span>
                  <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
                {readOnly ? null : (
                  <FeedbackButtons digestItemId={item.id} initial={existingFeedback[item.id] ?? null} />
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {rejected.length > 0 ? (
        <div className="mt-8">
          <button
            onClick={() => setShowRejected((v) => !v)}
            aria-expanded={showRejected}
            className="inline-flex items-center gap-1.5 rounded-full text-sm text-ink-soft transition-colors hover:text-ink"
          >
            <ChevronDown
              className={`size-4 transition-transform ${showRejected ? "rotate-180" : ""}`}
              aria-hidden
            />
            {rejected.length} {rejected.length === 1 ? "story" : "stories"} dropped because the editor
            couldn&rsquo;t verify {rejected.length === 1 ? "it" : "them"} against the source
          </button>
          {showRejected ? (
            <ul className="mt-3 space-y-1.5 rounded-2xl bg-morning-2 px-4 py-3 text-[0.9rem] leading-[1.55] text-ink-soft">
              {rejected.map((r, i) => (
                <li key={i}>{r.reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

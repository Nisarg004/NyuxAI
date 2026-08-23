"use client";

import { useState } from "react";
import { FeedbackButtons } from "./feedback-buttons";

type Item = {
  id: string;
  headline: string;
  summary: string;
  whyItMatters: string;
  sourceUrl: string;
};

export function SectorSection({
  sector,
  items,
  rejected,
  existingFeedback,
}: {
  sector: string;
  items: Item[];
  rejected: { article_id: string; reason: string }[];
  existingFeedback: Record<string, "up" | "down" | "save">;
}) {
  const [showRejected, setShowRejected] = useState(false);

  return (
    <section className="border-b border-border/60 py-6 last:border-0">
      <h3 className="border-b-2 border-amber pb-1.5 font-mono text-xs uppercase tracking-wide text-ink">{sector}</h3>

      {items.length === 0 ? (
        <p className="mt-3 text-sm italic text-slate">Nothing in {sector} cleared our bar today.</p>
      ) : (
        <ul className="mt-3 space-y-5">
          {items.map((item) => (
            <li key={item.id}>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="font-display text-base font-semibold text-ink hover:text-amber">
                {item.headline}
              </a>
              <p className="mt-1.5 text-sm text-slate">{item.summary}</p>
              <div className="mt-2 border-l-2 border-amber bg-amber/10 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-wide text-amber">Why it matters</p>
                <p className="mt-0.5 text-sm text-ink">{item.whyItMatters}</p>
              </div>
              <div className="mt-2">
                <FeedbackButtons digestItemId={item.id} initial={existingFeedback[item.id] ?? null} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {rejected.length > 0 ? (
        <div className="mt-3">
          <button onClick={() => setShowRejected((v) => !v)} className="text-xs text-slate underline decoration-dotted hover:text-ink">
            {rejected.length} item{rejected.length === 1 ? "" : "s"} dropped — couldn&rsquo;t verify against source
          </button>
          {showRejected ? (
            <ul className="mt-2 space-y-1 pl-3 text-xs text-slate">
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

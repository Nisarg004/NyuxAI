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
    <section className="border-b border-rule py-9 last:border-0">
      <h2 className="font-display text-lg italic text-editor">{sector}</h2>

      {items.length === 0 ? (
        <p className="mt-4 text-[1.0625rem] leading-[1.7] text-ink-soft">
          Nothing in {sector} cleared the bar today.
        </p>
      ) : (
        <div className="mt-5 space-y-9">
          {items.map((item) => (
            <article key={item.id}>
              <h3 className="font-display text-[1.4rem] font-semibold leading-[1.2] tracking-[-0.01em] text-ink">
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="decoration-editor/40 underline-offset-4 hover:text-editor hover:underline"
                >
                  {item.headline}
                </a>
              </h3>
              <p className="mt-2.5 text-[1.0625rem] leading-[1.7] text-ink/90">{item.summary}</p>
              <p className="mt-4 border-l border-editor py-0.5 pl-4 text-[0.95rem] leading-[1.65] text-ink-soft">
                <span className="font-display italic text-ink">Why it matters — </span>
                {item.whyItMatters}
              </p>
              {readOnly ? null : (
                <div className="mt-3">
                  <FeedbackButtons digestItemId={item.id} initial={existingFeedback[item.id] ?? null} />
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {rejected.length > 0 ? (
        <div className="mt-6">
          <button
            onClick={() => setShowRejected((v) => !v)}
            className="text-sm italic text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink"
          >
            {rejected.length} item{rejected.length === 1 ? "" : "s"} dropped — couldn&rsquo;t verify against source
          </button>
          {showRejected ? (
            <ul className="mt-2 space-y-1 border-l border-rule pl-4 text-[0.9rem] leading-[1.55] text-ink-soft">
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

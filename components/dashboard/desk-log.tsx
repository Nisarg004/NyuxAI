"use client";

import type { PipelineSummary, SectorAgentState } from "@/lib/stage-log";

function Marker({ status }: { status: "pending" | "running" | "done" | "error" }) {
  const cls =
    status === "done"
      ? "bg-confirm"
      : status === "error"
        ? "bg-editor"
        : status === "running"
          ? "bg-editor animate-pulse"
          : "border border-rule bg-transparent";
  return <span className={`mt-2 inline-block size-1.5 shrink-0 rounded-full ${cls}`} aria-hidden />;
}

function DeskLine({
  marker,
  children,
}: {
  marker: SectorAgentState["status"] | "pending";
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-2.5 text-[0.95rem] leading-[1.6] text-ink">
      <Marker status={marker} />
      <span>{children}</span>
    </li>
  );
}

/** The live "the curator is choosing… / the editor kept 3, cut 1" desk log,
 * shared by the Send-now affordance and the first-brief button. */
export function DeskLog({ summary }: { summary: PipelineSummary }) {
  const writerSectors = Object.keys(summary.writer);
  const editorSectors = Object.keys(summary.editor);

  return (
    <ul className="mt-4 space-y-2">
      <DeskLine marker={summary.curator.status}>
        The curator {summary.curator.status === "done" ? "chose" : "is choosing"}{" "}
        {summary.totals.selected || "—"} {summary.totals.selected === 1 ? "story" : "stories"}.
      </DeskLine>
      {summary.curator.selections.slice(0, 5).map((s) => (
        <li key={s.article_id} className="ml-4 pl-2.5 text-[0.9rem] leading-[1.55] text-ink-soft">
          <span className="font-display italic text-ink">{s.sector}</span> — {s.reason}
        </li>
      ))}

      <DeskLine marker={summary.researcher.status}>
        The researcher {summary.researcher.status === "done" ? "verified" : "is verifying"}{" "}
        {summary.totals.fetched || "—"} against source
        {summary.researcher.deep !== undefined
          ? `, ${summary.researcher.deep} in depth and ${summary.researcher.shallow} in brief`
          : ""}
        .
      </DeskLine>

      {writerSectors.map((sector) => {
        const w = summary.writer[sector];
        return (
          <DeskLine key={sector} marker={w.status}>
            The {sector} writer {w.status === "done" ? "drafted" : "is drafting"}{" "}
            {w.itemCount ?? "—"} {w.itemCount === 1 ? "item" : "items"}
            {w.attempt === 2 ? " on a second pass" : ""}.
          </DeskLine>
        );
      })}

      {editorSectors.map((sector) => {
        const e = summary.editor[sector];
        return (
          <DeskLine key={sector} marker={e.status}>
            The {sector} editor {e.status === "done" ? "kept" : "is weighing"} {e.approvedCount ?? "—"}
            {e.status === "done" ? `, cut ${e.rejectedCount ?? 0}` : ""}.
          </DeskLine>
        );
      })}

      {summary.notes.length > 0 ? (
        <li className="mt-1 border-t border-rule pt-2">
          <ul className="space-y-0.5 text-[0.9rem] italic leading-[1.55] text-ink-soft">
            {summary.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </li>
      ) : null}
    </ul>
  );
}

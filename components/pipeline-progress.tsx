import type { PipelineSummary, SectorAgentState } from "@/lib/stage-log";

type Status = SectorAgentState["status"] | "pending";

function Marker({ status }: { status: Status }) {
  if (status === "running") {
    return (
      <span className="relative mt-1.5 inline-flex size-2.5 shrink-0" aria-hidden>
        <span className="absolute inset-0 animate-ping rounded-full bg-aurora/60" />
        <span className="relative size-2.5 rounded-full bg-aurora" />
      </span>
    );
  }
  const cls = status === "done" ? "bg-confirm" : status === "error" ? "bg-alarm" : "border border-line";
  return <span className={`mt-1.5 inline-block size-2.5 shrink-0 rounded-full ${cls}`} aria-hidden />;
}

function Step({ marker, children }: { marker: Status; children: React.ReactNode }) {
  return (
    <li className={`flex gap-3 text-[0.95rem] leading-[1.55] ${marker === "pending" ? "text-haze/60" : "text-star"}`}>
      <Marker status={marker} />
      <span>{children}</span>
    </li>
  );
}

// The live view of the four agents while a brief is being built.
export function PipelineProgress({ summary }: { summary: PipelineSummary }) {
  const writerSectors = Object.keys(summary.writer);
  const editorSectors = Object.keys(summary.editor);

  return (
    <div className="panel mt-6 p-6" aria-live="polite">
      <ul className="space-y-3">
        <Step marker={summary.curator.status}>
          Curator {summary.curator.status === "done" ? "picked" : "is picking"}{" "}
          {summary.totals.selected || "the"} {summary.totals.selected === 1 ? "story" : "stories"} worth your time.
        </Step>
        {summary.curator.selections.slice(0, 5).map((s) => (
          <li key={s.article_id} className="ml-[1.375rem] border-l border-line pl-3 text-[0.875rem] leading-[1.5] text-haze">
            <span className="text-star/90">{s.sector}:</span> {s.reason}
          </li>
        ))}

        <Step marker={summary.researcher.status}>
          Researcher {summary.researcher.status === "done" ? "read" : "is reading"}{" "}
          {summary.totals.fetched || "the"} full {summary.totals.fetched === 1 ? "article" : "articles"} at the source
          {summary.researcher.deep !== undefined
            ? ` (${summary.researcher.deep} in full, ${summary.researcher.shallow} from the excerpt)`
            : ""}
          .
        </Step>

        {writerSectors.map((sector) => {
          const w = summary.writer[sector];
          return (
            <Step key={`w-${sector}`} marker={w.status}>
              Writer {w.status === "done" ? "drafted" : "is drafting"} {w.itemCount ?? "the"}{" "}
              {sector} {w.itemCount === 1 ? "story" : "stories"}
              {w.attempt === 2 ? " on a second pass" : ""}.
            </Step>
          );
        })}

        {editorSectors.map((sector) => {
          const e = summary.editor[sector];
          return (
            <Step key={`e-${sector}`} marker={e.status}>
              {e.status === "done"
                ? `Editor kept ${e.approvedCount ?? 0} ${sector} ${e.approvedCount === 1 ? "story" : "stories"} and cut ${e.rejectedCount ?? 0} after checking each claim.`
                : `Editor is checking the ${sector} claims against their sources.`}
            </Step>
          );
        })}
      </ul>

      {summary.notes.length > 0 ? (
        <ul className="mt-4 space-y-1 border-t border-line pt-3 text-[0.875rem] leading-[1.5] text-haze">
          {summary.notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

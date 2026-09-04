"use client";

import { useState } from "react";
import { DateTime } from "luxon";
import { summarizeStageLog } from "@/lib/stage-log";

type Run = {
  id: string;
  kind: string;
  userEmail: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  status: string;
  error: string | null;
  stageLog: unknown;
};

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "completed"
      ? "bg-confirm/10 text-confirm"
      : status === "failed"
        ? "bg-editor/10 text-editor"
        : "bg-ink/5 text-ink-soft";
  return <span className={`rounded-[3px] px-1.5 py-0.5 text-xs ${cls}`}>{status}</span>;
}

export function RunRow({ run, timezone }: { run: Run; timezone: string }) {
  const [open, setOpen] = useState(false);
  const summary = open ? summarizeStageLog(Array.isArray(run.stageLog) ? (run.stageLog as unknown[]) : []) : null;
  const durationMs = run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null;

  return (
    <>
      <tr onClick={() => setOpen((v) => !v)} className="cursor-pointer border-b border-rule hover:bg-paper-deep/40">
        <td className="py-2.5 pr-4 text-sm capitalize text-ink">{run.kind}</td>
        <td className="py-2.5 pr-4 text-sm text-ink-soft">{run.userEmail ?? "—"}</td>
        <td className="py-2.5 pr-4 text-sm text-ink-soft">
          {DateTime.fromJSDate(run.startedAt, { zone: timezone }).toFormat("d LLL, HH:mm:ss")}
        </td>
        <td className="py-2.5 pr-4 text-sm text-ink-soft">
          {durationMs !== null ? `${(durationMs / 1000).toFixed(1)}s` : "running"}
        </td>
        <td className="py-2.5 pr-0">
          <StatusBadge status={run.status} />
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-rule bg-paper-deep/30">
          <td colSpan={5} className="px-1 py-4 text-sm">
            {run.error ? <p className="mb-3 text-editor">{run.error}</p> : null}
            {summary ? (
              <div className="space-y-4">
                {summary.curator.selections.length > 0 ? (
                  <div>
                    <p className="font-display italic text-ink-soft">Curator reasons</p>
                    <ul className="mt-1.5 space-y-1 text-[0.9rem] leading-[1.55] text-ink">
                      {summary.curator.selections.map((s) => (
                        <li key={s.article_id}>
                          <span className="text-editor">{s.sector}</span> ({s.score}) — {s.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {Object.entries(summary.editor).map(([sector, state]) =>
                  state.rejected.length > 0 ? (
                    <div key={sector}>
                      <p className="font-display italic text-ink-soft">{sector} — rejected</p>
                      <ul className="mt-1.5 space-y-1 text-[0.9rem] leading-[1.55] text-ink">
                        {state.rejected.map((r, i) => (
                          <li key={i}>{r.reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null
                )}
                <p className="text-[0.9rem] text-ink-soft">
                  {summary.totals.selected} selected, {summary.totals.fetched} fetched,{" "}
                  {summary.totals.approved} approved, {summary.totals.rejected} rejected
                </p>
              </div>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}

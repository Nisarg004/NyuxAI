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

export function RunRow({ run }: { run: Run }) {
  const [open, setOpen] = useState(false);
  const summary = open ? summarizeStageLog(Array.isArray(run.stageLog) ? (run.stageLog as unknown[]) : []) : null;
  const durationMs = run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null;

  return (
    <>
      <tr onClick={() => setOpen((v) => !v)} className="cursor-pointer border-b border-border/60 hover:bg-paper">
        <td className="px-4 py-2 font-mono text-xs uppercase text-slate">{run.kind}</td>
        <td className="px-4 py-2 text-sm text-ink">{run.userEmail ?? "—"}</td>
        <td className="px-4 py-2 font-mono text-xs text-slate">
          {DateTime.fromJSDate(run.startedAt).toFormat("d LLL, HH:mm:ss")}
        </td>
        <td className="px-4 py-2 font-mono text-xs text-slate">{durationMs !== null ? `${(durationMs / 1000).toFixed(1)}s` : "running"}</td>
        <td className="px-4 py-2">
          <span
            className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase ${
              run.status === "completed" ? "bg-confirm/15 text-confirm" : run.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-amber/15 text-amber"
            }`}
          >
            {run.status}
          </span>
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-border/60 bg-paper">
          <td colSpan={5} className="px-6 py-4 text-sm">
            {run.error ? <p className="mb-3 text-destructive">{run.error}</p> : null}
            {summary ? (
              <div className="space-y-3">
                {summary.curator.selections.length > 0 ? (
                  <div>
                    <p className="font-mono text-xs uppercase text-slate">Curator reasons</p>
                    <ul className="mt-1 space-y-0.5 pl-3 text-xs text-ink">
                      {summary.curator.selections.map((s) => (
                        <li key={s.article_id}>
                          <span className="font-mono uppercase text-amber">{s.sector}</span> ({s.score}) — {s.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {Object.entries(summary.editor).map(([sector, state]) =>
                  state.rejected.length > 0 ? (
                    <div key={sector}>
                      <p className="font-mono text-xs uppercase text-slate">{sector} — rejected</p>
                      <ul className="mt-1 space-y-0.5 pl-3 text-xs text-ink">
                        {state.rejected.map((r, i) => (
                          <li key={i}>{r.reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null
                )}
                <p className="font-mono text-xs text-slate">
                  {summary.totals.selected} selected · {summary.totals.fetched} fetched · {summary.totals.approved} approved · {summary.totals.rejected} rejected
                </p>
              </div>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}

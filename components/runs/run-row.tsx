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
  tokenCost: string | null;
  stageLog: unknown;
};

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "completed"
      ? "bg-confirm/15 text-confirm"
      : status === "failed"
        ? "bg-alarm/15 text-alarm"
        : "bg-aurora/15 text-aurora";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>{status}</span>;
}

export function RunRow({ run, timezone }: { run: Run; timezone: string }) {
  const [open, setOpen] = useState(false);
  const summary = open ? summarizeStageLog(Array.isArray(run.stageLog) ? (run.stageLog as unknown[]) : []) : null;
  const durationMs = run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null;

  return (
    <>
      <tr
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`cursor-pointer border-b border-line/70 transition-colors hover:bg-night/50 ${open ? "bg-night/50" : ""}`}
      >
        <td className="py-3 pr-4 pl-5 text-sm font-medium capitalize text-star">{run.kind}</td>
        <td className="max-w-[14rem] truncate py-3 pr-4 text-sm text-haze">{run.userEmail ?? "—"}</td>
        <td className="py-3 pr-4 text-sm whitespace-nowrap text-haze">
          {DateTime.fromJSDate(run.startedAt, { zone: timezone }).toFormat("d LLL, HH:mm:ss")}
        </td>
        <td className="py-3 pr-4 text-sm tabular-nums text-haze">
          {durationMs !== null ? `${(durationMs / 1000).toFixed(1)}s` : "Running"}
        </td>
        <td className="py-3 pr-4 text-right text-sm tabular-nums text-haze">
          {run.tokenCost !== null ? Number(run.tokenCost).toLocaleString("en-US") : "—"}
        </td>
        <td className="py-3 pr-5">
          <StatusBadge status={run.status} />
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-line/70 bg-night/50">
          <td colSpan={6} className="px-5 pt-1 pb-5 text-sm">
            {run.error ? (
              <p className="mb-4 rounded-2xl border border-alarm/30 bg-alarm/10 px-3.5 py-2.5 text-alarm">{run.error}</p>
            ) : null}
            {summary ? (
              <div className="space-y-5">
                {summary.curator.selections.length > 0 ? (
                  <div>
                    <p className="font-medium text-star">Curator reasons</p>
                    <ul className="mt-2 space-y-1.5 text-[0.9rem] leading-[1.55] text-haze">
                      {summary.curator.selections.map((s) => (
                        <li key={s.article_id}>
                          <span className="font-medium text-aurora">{s.sector}</span>{" "}
                          <span className="tabular-nums text-star">({s.score})</span> {s.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {Object.entries(summary.editor).map(([sector, state]) =>
                  state.rejected.length > 0 ? (
                    <div key={sector}>
                      <p className="font-medium text-star">Rejected in {sector}</p>
                      <ul className="mt-2 space-y-1.5 text-[0.9rem] leading-[1.55] text-haze">
                        {state.rejected.map((r, i) => (
                          <li key={i}>{r.reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null
                )}
                <p className="text-[0.9rem] text-haze">
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

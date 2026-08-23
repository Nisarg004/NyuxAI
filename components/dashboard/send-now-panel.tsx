"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSendNow } from "@/lib/hooks/use-send-now";
import type { SectorAgentState } from "@/lib/stage-log";

function StatusDot({ status }: { status: "pending" | "running" | "done" | "error" }) {
  const color =
    status === "done" ? "bg-confirm" : status === "error" ? "bg-destructive" : status === "running" ? "bg-amber animate-pulse" : "bg-slate/30";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function SectorRow({ sector, state, kind }: { sector: string; state: SectorAgentState; kind: "writer" | "editor" }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm last:border-0">
      <span className="flex items-center gap-2">
        <StatusDot status={state.status} />
        <span className="font-mono text-xs uppercase text-slate">{sector}</span>
        {state.attempt === 2 ? (
          <span className="rounded-sm bg-amber/20 px-1.5 py-0.5 font-mono text-[10px] uppercase text-amber">attempt: 2</span>
        ) : null}
      </span>
      <span className="font-mono text-xs text-ink">
        {kind === "editor"
          ? `${state.approvedCount ?? "—"} approved · ${state.rejectedCount ?? "—"} rejected`
          : state.itemCount !== undefined
            ? `${state.itemCount} drafted`
            : "—"}
      </span>
    </div>
  );
}

export function SendNowPanel() {
  const { status, result, start, summary } = useSendNow();
  const router = useRouter();

  useEffect(() => {
    if (status === "done") {
      toast.success(result?.sent ? "Sent." : (result?.note ?? "Done — nothing to send."));
      // Refresh server components on the page (e.g. RecentDigests) so a
      // newly sent digest shows up without a manual reload.
      router.refresh();
    }
    if (status === "error") {
      toast.error(result?.error ?? "Send failed.");
    }
  }, [status, result, router]);

  const writerSectors = Object.keys(summary.writer);
  const editorSectors = Object.keys(summary.editor);

  return (
    <div className="rounded-md border border-border bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Send now</h2>
        <Button onClick={start} disabled={status === "running"} className="bg-ink text-paper hover:bg-slate">
          {status === "running" ? "Sending…" : "Send now"}
        </Button>
      </div>

      {status !== "idle" ? (
        <div className="mt-5 space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <StatusDot status={summary.curator.status} />
                <span className="font-mono text-xs uppercase text-slate">Curator</span>
              </span>
              <span className="font-mono text-xs text-ink">{summary.totals.selected || "—"} selected</span>
            </div>
            {summary.curator.selections.length > 0 ? (
              <ul className="mt-1 space-y-0.5 pl-4 text-xs text-slate">
                {summary.curator.selections.slice(0, 6).map((s) => (
                  <li key={s.article_id}>
                    <span className="font-mono uppercase text-amber">{s.sector}</span> · {s.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <StatusDot status={summary.researcher.status} />
              <span className="font-mono text-xs uppercase text-slate">Researcher</span>
            </span>
            <span className="font-mono text-xs text-ink">
              {summary.totals.fetched || "—"} fetched
              {summary.researcher.deep !== undefined ? ` · ${summary.researcher.deep} deep · ${summary.researcher.shallow} shallow` : ""}
            </span>
          </div>

          {writerSectors.length > 0 ? (
            <div>
              <span className="font-mono text-xs uppercase text-slate">Writer</span>
              <div className="mt-1">
                {writerSectors.map((sector) => (
                  <SectorRow key={sector} sector={sector} state={summary.writer[sector]} kind="writer" />
                ))}
              </div>
            </div>
          ) : null}

          {editorSectors.length > 0 ? (
            <div>
              <span className="font-mono text-xs uppercase text-slate">Editor</span>
              <div className="mt-1">
                {editorSectors.map((sector) => (
                  <SectorRow key={sector} sector={sector} state={summary.editor[sector]} kind="editor" />
                ))}
              </div>
            </div>
          ) : null}

          {summary.notes.length > 0 ? (
            <ul className="space-y-0.5 border-t border-border/60 pt-2 text-xs italic text-slate">
              {summary.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { summarizeStageLog, type PipelineSummary, type StageEntry } from "@/lib/stage-log";

type SendNowResult = { sent: boolean; digestId: string | null; error?: string; note?: string; sentTo?: string; subject?: string };

export function useSendNow() {
  const [entries, setEntries] = useState<StageEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<SendNowResult | null>(null);

  const start = useCallback(async () => {
    setEntries([]);
    setResult(null);
    setStatus("running");

    try {
      const res = await fetch("/api/digest/send-now", {
        method: "POST",
      });

      if (!res.body) {
        setStatus("error");
        setResult({ sent: false, digestId: null, error: "No response stream from server" });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          const event = JSON.parse(json) as { type: string; entry?: StageEntry } & Record<string, unknown>;

          if (event.type === "stage" && event.entry) {
            setEntries((prev) => [...prev, event.entry as StageEntry]);
          } else if (event.type === "done") {
            setStatus("done");
            setResult({
              sent: Boolean(event.sent),
              digestId: (event.digestId as string | null) ?? null,
              note: event.note as string | undefined,
              sentTo: event.sentTo as string | undefined,
              subject: event.subject as string | undefined,
            });
          } else if (event.type === "error") {
            setStatus("error");
            setResult({ sent: false, digestId: (event.digestId as string | null) ?? null, error: event.error as string });
          }
        }
      }

      setStatus((s) => (s === "running" ? "done" : s));
    } catch (err) {
      setStatus("error");
      setResult({ sent: false, digestId: null, error: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const summary: PipelineSummary = useMemo(() => summarizeStageLog(entries), [entries]);

  return { entries, status, result, start, summary };
}

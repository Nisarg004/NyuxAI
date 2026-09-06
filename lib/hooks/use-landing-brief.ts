"use client";

import { useCallback, useMemo, useState } from "react";
import { summarizeStageLog, type PipelineSummary, type StageEntry } from "@/lib/stage-log";

export type LandingBrief = {
  editorsNote: string;
  sectors: {
    sector: string;
    items: { headline: string; summary: string; whyItMatters: string; sourceUrl: string }[];
  }[];
};

export function useLandingBrief() {
  const [entries, setEntries] = useState<StageEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [brief, setBrief] = useState<LandingBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<{ retryAfterMinutes: number } | null>(null);

  const start = useCallback(async (input: { sectors: string[]; roleTitle: string }) => {
    setEntries([]);
    setBrief(null);
    setError(null);
    setRateLimit(null);
    setStatus("running");

    try {
      const res = await fetch("/api/landing/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (res.status === 429) {
        const data = (await res.json()) as { retryAfterMinutes?: number };
        setRateLimit({ retryAfterMinutes: data.retryAfterMinutes ?? 60 });
        setStatus("error");
        return;
      }

      if (!res.ok || !res.body) {
        let message = "The desk couldn't start a run just now.";
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error === "invalid_sectors") message = "Pick one to three desks first.";
        } catch {
          // non-JSON body — keep the default message
        }
        setError(message);
        setStatus("error");
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
          const event = JSON.parse(json) as { type: string; entry?: StageEntry; brief?: LandingBrief; error?: string };

          if (event.type === "stage" && event.entry) {
            setEntries((prev) => [...prev, event.entry as StageEntry]);
          } else if (event.type === "done") {
            setBrief(event.brief ?? { editorsNote: "", sectors: [] });
            setStatus("done");
          } else if (event.type === "error") {
            setError(event.error ?? "The run failed.");
            setStatus("error");
          }
        }
      }

      setStatus((s) => (s === "running" ? "done" : s));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, []);

  const summary: PipelineSummary = useMemo(() => summarizeStageLog(entries), [entries]);

  return { entries, status, brief, error, rateLimit, summary, start };
}

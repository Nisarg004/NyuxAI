"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSendNow } from "@/lib/hooks/use-send-now";
import { PipelineProgress } from "@/components/pipeline-progress";

/** Shown instead of an empty state when the reader has never had a brief.
 * One tap runs the full pipeline, persists the brief and (best-effort) emails
 * it; the page then refreshes to render that brief inline. */
export function FirstBriefCta() {
  const { status, result, start, summary } = useSendNow();
  const router = useRouter();

  useEffect(() => {
    if (status === "done") {
      toast.success(result?.sent ? "Your first brief is ready." : (result?.note ?? "Done."));
      router.refresh();
    }
    if (status === "error") {
      toast.error(result?.error ?? "The run failed.");
    }
  }, [status, result, router]);

  return (
    <section className="py-6">
      <h2 className="font-display text-[1.75rem] leading-tight text-ink">
        Your first brief hasn’t run yet
      </h2>
      <p className="mt-1 text-[1.0625rem] leading-[1.7] text-ink-soft">
        The desk can put one together right now — the curator, researcher, writer and
        editor take about a minute.
      </p>
      <Button
        onClick={start}
        disabled={status === "running"}
        className="mt-4 rounded-[3px] bg-ink px-4 text-paper hover:bg-editor"
      >
        {status === "running" ? "Going to press…" : "Generate my first brief now"}
      </Button>

      {status !== "idle" ? <PipelineProgress summary={summary} /> : null}
    </section>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StarMark } from "@/components/brand/logo";
import { useSendNow } from "@/lib/hooks/use-send-now";
import { PipelineProgress } from "@/components/pipeline-progress";

/** Shown instead of an empty state when the reader has never had a brief.
 * One tap runs the full pipeline, persists the brief and (best-effort) emails
 * it; the page then refreshes to render that brief inline on a morning sheet. */
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
    <section className="panel px-5 py-8 sm:px-8 sm:py-10">
      <StarMark className="size-6 text-dawn" />
      <h2 className="mt-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-[1.05] tracking-[-0.03em] text-star">
        Your first brief hasn&rsquo;t been written yet
      </h2>
      <p className="mt-3 max-w-xl text-[1.0625rem] leading-[1.65] text-haze">
        Nyux can build one right now. The curator, researcher, writer and editor take about a
        minute, and every claim is checked against its source.
      </p>
      <Button size="lg" onClick={start} disabled={status === "running"} className="mt-6">
        {status === "running" ? "Writing your brief…" : "Write my first brief now"}
      </Button>

      {status !== "idle" ? <PipelineProgress summary={summary} /> : null}
    </section>
  );
}

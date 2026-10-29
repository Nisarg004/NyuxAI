"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PipelineProgress } from "@/components/pipeline-progress";
import { useSendNow } from "@/lib/hooks/use-send-now";

/** A quiet off-schedule re-run in the side column, for pulling the next
 * brief forward. The dashboard leads with the brief itself. */
export function SendNowPanel() {
  const { status, result, start, summary } = useSendNow();
  const router = useRouter();

  useEffect(() => {
    if (status === "done") {
      toast.success(result?.sent ? "Brief sent." : (result?.note ?? "Done. Nothing new to send."));
      router.refresh();
    }
    if (status === "error") {
      toast.error(result?.error ?? "The run failed.");
    }
  }, [status, result, router]);

  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-star">Can&rsquo;t wait?</h2>
      <p className="mt-1 text-sm leading-[1.55] text-haze">
        Build and send a fresh brief now instead of waiting for your usual time.
      </p>
      <Button variant="outline" onClick={start} disabled={status === "running"} className="mt-3">
        {status === "running" ? "Writing your brief…" : "Send me a brief now"}
      </Button>

      {status !== "idle" ? <PipelineProgress summary={summary} /> : null}
    </section>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PipelineProgress } from "@/components/pipeline-progress";
import { useSendNow } from "@/lib/hooks/use-send-now";

export function SendNowPanel() {
  const { status, result, start, summary } = useSendNow();
  const router = useRouter();

  useEffect(() => {
    if (status === "done") {
      toast.success(result?.sent ? "Edition sent." : (result?.note ?? "Done — nothing to send."));
      router.refresh();
    }
    if (status === "error") {
      toast.error(result?.error ?? "The run failed.");
    }
  }, [status, result, router]);

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-sm italic text-ink-soft">An edition now, off schedule</h2>
        <Button
          onClick={start}
          disabled={status === "running"}
          className="rounded-[3px] bg-ink px-4 text-paper hover:bg-editor"
        >
          {status === "running" ? "Going to press…" : "Send now"}
        </Button>
      </div>

      {status !== "idle" ? <PipelineProgress summary={summary} /> : null}
    </section>
  );
}

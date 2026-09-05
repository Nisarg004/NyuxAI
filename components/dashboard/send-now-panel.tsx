"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSendNow } from "@/lib/hooks/use-send-now";
import { DeskLog } from "./desk-log";

/** A quiet off-schedule re-run. The dashboard leads with the brief itself;
 * this is a single line beneath it for pulling the next edition forward. */
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
      <button
        onClick={start}
        disabled={status === "running"}
        className="text-sm text-editor underline decoration-editor/40 underline-offset-4 hover:decoration-editor disabled:text-ink-soft disabled:no-underline"
      >
        {status === "running" ? "Going to press…" : "Bring the next edition forward →"}
      </button>

      {status !== "idle" ? <DeskLog summary={summary} /> : null}
    </section>
  );
}

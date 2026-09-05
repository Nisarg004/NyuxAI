"use client";

import { useState } from "react";
import { toast } from "sonner";
import { submitFeedback } from "@/app/archive/actions";

export function FeedbackButtons({ digestItemId, initial }: { digestItemId: string; initial: "up" | "down" | "save" | null }) {
  const [signal, setSignal] = useState(initial);
  const [pending, setPending] = useState(false);

  const send = async (next: "up" | "down") => {
    setPending(true);
    try {
      const result = await submitFeedback(digestItemId, next);
      if (!result.success) throw new Error(result.error ?? "Feedback failed to save");
      setSignal(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Feedback failed to save");
    } finally {
      setPending(false);
    }
  };

  const base =
    "rounded-[3px] border px-2.5 py-1 text-sm transition-colors disabled:opacity-50";

  return (
    <div className="flex gap-2">
      <button
        onClick={() => send("up")}
        disabled={pending}
        aria-pressed={signal === "up"}
        className={`${base} ${
          signal === "up"
            ? "border-editor bg-editor text-paper"
            : "border-rule text-ink-soft hover:border-ink hover:text-ink"
        }`}
      >
        Useful
      </button>
      <button
        onClick={() => send("down")}
        disabled={pending}
        aria-pressed={signal === "down"}
        className={`${base} ${
          signal === "down"
            ? "border-ink bg-ink text-paper"
            : "border-rule text-ink-soft hover:border-ink hover:text-ink"
        }`}
      >
        Not for me
      </button>
    </div>
  );
}

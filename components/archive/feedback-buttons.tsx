"use client";

import { useState } from "react";
import { toast } from "sonner";

export function FeedbackButtons({ digestItemId, initial }: { digestItemId: string; initial: "up" | "down" | "save" | null }) {
  const [signal, setSignal] = useState(initial);
  const [pending, setPending] = useState(false);

  const send = async (next: "up" | "down") => {
    setPending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestItemId, signal: next }),
      });
      if (!res.ok) throw new Error("Feedback failed to save");
      setSignal(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Feedback failed to save");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => send("up")}
        disabled={pending}
        aria-pressed={signal === "up"}
        className={`rounded-sm border px-2 py-1 text-xs ${signal === "up" ? "border-confirm bg-confirm/10 text-confirm" : "border-border text-slate hover:border-ink"}`}
      >
        ↑ Useful
      </button>
      <button
        onClick={() => send("down")}
        disabled={pending}
        aria-pressed={signal === "down"}
        className={`rounded-sm border px-2 py-1 text-xs ${signal === "down" ? "border-ink bg-ink/5 text-ink" : "border-border text-slate hover:border-ink"}`}
      >
        ↓ Not for me
      </button>
    </div>
  );
}

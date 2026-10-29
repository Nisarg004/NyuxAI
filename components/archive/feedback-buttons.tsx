"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bookmark, ThumbsDown, ThumbsUp, type LucideIcon } from "lucide-react";
import { submitFeedback } from "@/app/archive/actions";

type Signal = "up" | "down" | "save";

const OPTIONS: { signal: Signal; label: string; Icon: LucideIcon }[] = [
  { signal: "up", label: "More like this", Icon: ThumbsUp },
  { signal: "down", label: "Less like this", Icon: ThumbsDown },
  { signal: "save", label: "Save this story", Icon: Bookmark },
];

/** Small round icon buttons on a morning sheet; the chosen one fills with ink. */
export function FeedbackButtons({ digestItemId, initial }: { digestItemId: string; initial: Signal | null }) {
  const [signal, setSignal] = useState(initial);
  const [pending, setPending] = useState(false);

  const send = async (next: Signal) => {
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

  return (
    <div className="flex gap-1.5" role="group" aria-label="Feedback on this story">
      {OPTIONS.map(({ signal: value, label, Icon }) => {
        const selected = signal === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => send(value)}
            disabled={pending}
            aria-pressed={selected}
            aria-label={label}
            title={label}
            className={`inline-flex size-9 items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${
              selected
                ? "border-ink bg-ink text-morning"
                : "border-rule bg-morning text-ink-soft hover:border-ink-soft hover:text-ink"
            }`}
          >
            <Icon className="size-4" fill={selected ? "currentColor" : "none"} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

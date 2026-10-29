import { cn } from "@/lib/utils";

/**
 * The nyux wordmark: lowercase, set in the display face, with a four-point star
 * where the x crosses — the one bright point in the night.
 */
export function Logo({ className, star = true }: { className?: string; star?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {star ? <StarMark className="h-[0.9em] w-[0.9em] text-dawn" /> : null}
      <span className="font-display text-[1.25em] font-bold leading-none tracking-[-0.04em]">nyux</span>
    </span>
  );
}

export function StarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="currentColor"
        d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0Z"
      />
    </svg>
  );
}

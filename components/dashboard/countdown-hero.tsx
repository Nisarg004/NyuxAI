"use client";

import { useEffect, useState } from "react";
import { getCountdownDisplay, formatRemaining } from "@/lib/countdown";

export function CountdownHero(props: {
  sectors: string[];
  deliveryHour: number;
  deliveryMinute: number;
  timezone: string | null;
  nextRunAt: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const display = mounted ? getCountdownDisplay({ ...props, now }) : null;

  return (
    <div className="rounded-md bg-ink px-8 py-10 text-paper">
      {display === null ? (
        <div className="h-8" />
      ) : display.mode === "unscheduled" ? (
        <>
          <p className="font-mono text-sm uppercase tracking-wide text-amber">{display.sectorLabel || "NO SECTORS SELECTED"}</p>
          <p className="mt-2 font-display text-2xl">Not scheduled yet</p>
          <p className="mt-1 text-sm text-paper/70">Set your delivery time below to start the countdown.</p>
        </>
      ) : display.mode === "due" ? (
        <>
          <p className="font-mono text-sm uppercase tracking-wide text-amber">
            {display.sectorLabel} — {display.timeLabel}
          </p>
          <p className="mt-2 font-mono text-3xl text-amber">SENDING SOON</p>
        </>
      ) : (
        <p className="font-mono text-xl uppercase tracking-wide text-amber sm:text-2xl">
          {display.sectorLabel} — {display.timeLabel} — NEXT BRIEF IN {formatRemaining(display.remainingMs)}
        </p>
      )}
    </div>
  );
}

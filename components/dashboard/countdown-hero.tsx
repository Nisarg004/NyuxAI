"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { getCountdownDisplay, formatRemainingHuman } from "@/lib/countdown";
import { safeTimezone } from "@/lib/schedule";

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
    // Deliberate hydration-safe mount flag: server and first client render must
    // match (no `now`-derived output), so the real countdown only turns on
    // after mount. The one extra render this causes is the point, not a bug.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const display = mounted ? getCountdownDisplay({ ...props, now }) : null;
  const zone = safeTimezone(props.timezone);
  const weekday =
    display && display.mode !== "unscheduled" && props.nextRunAt
      ? DateTime.fromISO(props.nextRunAt, { zone }).toFormat("cccc")
      : null;

  return (
    <section>
      <h2 className="font-display text-sm italic text-ink-soft">Your next edition</h2>
      {display === null ? (
        <p className="mt-2 h-9 font-display text-2xl text-ink/30">&hellip;</p>
      ) : display.mode === "unscheduled" ? (
        <>
          <p className="mt-1 font-display text-[1.75rem] leading-tight text-ink">Not scheduled yet</p>
          <p className="mt-1 text-[0.95rem] text-ink-soft">
            Set a delivery time below and the countdown starts.
          </p>
        </>
      ) : display.mode === "due" ? (
        <>
          <p className="mt-1 font-display text-[1.75rem] leading-tight text-ink">Going to press now</p>
          <p className="mt-1 text-[0.95rem] text-ink-soft">
            {display.sectorLabel || "No sectors chosen"}
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 font-display text-[1.75rem] leading-tight text-ink sm:text-[2rem]">
            {weekday ? `${weekday} ` : ""}
            {display.timeLabel} — {formatRemainingHuman(display.remainingMs)}
          </p>
          <p className="mt-1 text-[0.95rem] text-ink-soft">{display.sectorLabel}</p>
        </>
      )}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { getCountdownDisplay, formatRemainingHuman } from "@/lib/countdown";
import { safeTimezone } from "@/lib/schedule";

/** One line above the brief: "Your next brief: today at 20:00 · in 3 hours 41 minutes". */
export function NextBriefLine(props: {
  sectors: string[];
  deliveryHour: number;
  deliveryMinute: number;
  timezone: string | null;
  nextRunAt: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    // Hydration-safe: server and first client render must not depend on `now`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const zone = safeTimezone(props.timezone);
  const display = mounted ? getCountdownDisplay({ ...props, now }) : null;

  let text: string;
  if (display === null) {
    text = "Your next brief: loading…";
  } else if (display.mode === "unscheduled") {
    text = "No delivery time set yet — add one in your brief settings below.";
  } else if (display.mode === "due") {
    text = "Your next brief: going to press now.";
  } else {
    const next = props.nextRunAt ? DateTime.fromISO(props.nextRunAt, { zone }) : null;
    const today = DateTime.now().setZone(zone);
    const day = !next
      ? ""
      : next.hasSame(today, "day")
        ? "today"
        : next.hasSame(today.plus({ days: 1 }), "day")
          ? "tomorrow"
          : next.toFormat("cccc");
    text = `Your next brief: ${day ? `${day} at ` : ""}${display.timeLabel} · ${formatRemainingHuman(display.remainingMs)}`;
  }

  return (
    <p className="text-sm text-ink-soft" suppressHydrationWarning>
      {text}
    </p>
  );
}

"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { getCountdownDisplay, formatRemainingHuman } from "@/lib/countdown";
import { safeTimezone } from "@/lib/schedule";

/** One line under the greeting: "Your next brief arrives today at 20:00, in 3 hours 41 minutes." */
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
    text = "Checking when your next brief arrives…";
  } else if (display.mode === "unscheduled") {
    text = "No delivery time set yet. Add one in your brief settings.";
  } else if (display.mode === "due") {
    text = "Your next brief is being written now.";
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
    text = `Your next brief arrives ${day ? `${day} at ` : "at "}${display.timeLabel}, ${formatRemainingHuman(display.remainingMs)}.`;
  }

  return (
    <p className="flex items-start gap-2.5 text-[1.0625rem] leading-[1.5] text-haze" suppressHydrationWarning>
      <span className="mt-[0.55em] size-2 shrink-0 rounded-full bg-dawn shadow-[0_0_12px_rgb(255_190_138/0.8)]" aria-hidden />
      <span>{text}</span>
    </p>
  );
}

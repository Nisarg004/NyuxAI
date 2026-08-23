import { DateTime } from "luxon";
import { safeTimezone } from "@/lib/schedule";

export type CountdownDisplay =
  | { mode: "unscheduled"; sectorLabel: string }
  | { mode: "due"; sectorLabel: string; timeLabel: string }
  | { mode: "counting"; sectorLabel: string; timeLabel: string; remainingMs: number };

export function getCountdownDisplay(input: {
  sectors: string[];
  deliveryHour: number;
  deliveryMinute: number;
  timezone: string | null;
  nextRunAt: string | Date | null;
  now?: Date;
}): CountdownDisplay {
  const sectorLabel = input.sectors.map((s) => s.toUpperCase()).join(" · ");
  const zone = safeTimezone(input.timezone);
  const deliveryLocal = DateTime.fromObject(
    { hour: input.deliveryHour, minute: input.deliveryMinute },
    { zone }
  );
  const timeLabel = `${deliveryLocal.toFormat("HH:mm")} ${deliveryLocal.offsetNameShort ?? zone}`;

  if (!input.nextRunAt) {
    return { mode: "unscheduled", sectorLabel };
  }

  const next = typeof input.nextRunAt === "string" ? new Date(input.nextRunAt) : input.nextRunAt;
  if (Number.isNaN(next.getTime())) {
    return { mode: "unscheduled", sectorLabel };
  }

  const now = input.now ?? new Date();
  const remainingMs = next.getTime() - now.getTime();

  if (remainingMs <= 0) {
    return { mode: "due", sectorLabel, timeLabel };
  }

  return { mode: "counting", sectorLabel, timeLabel, remainingMs };
}

export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

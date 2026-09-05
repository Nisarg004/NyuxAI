import { DateTime } from "luxon";

/**
 * The reader never sees an internal digest status. Every value of
 * `digestStatusEnum` (pending | generating | ready | sent | failed) is either
 * mapped to plain edition language or hidden (null) — a brief that is simply
 * ready to read needs no badge at all.
 */
export function readerLabel(
  status: string,
  sentAt: Date | null,
  timezone: string
): string | null {
  switch (status) {
    case "sent":
      return sentAt
        ? `Delivered ${DateTime.fromJSDate(sentAt, { zone: timezone }).toFormat("HH:mm")}`
        : "Delivered";
    case "generating":
      return "Being written now";
    case "failed":
      return "Didn’t finish";
    case "ready":
    case "pending":
    default:
      return null;
  }
}

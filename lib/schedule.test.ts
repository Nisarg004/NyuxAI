import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";

import { computeNextRunAt, safeTimezone } from "./schedule";

// Helper: build the UTC instant of a local wall-clock slot, as an ISO string,
// the same way a reader would reason about it ("07:00 in New York on Mar 8").
function slotUtcISO(
  parts: { year: number; month: number; day: number; hour: number; minute?: number },
  zone: string,
): string {
  return DateTime.fromObject(
    { minute: 0, ...parts },
    { zone },
  )
    .toUTC()
    .toJSDate()
    .toISOString();
}

test("returns today's slot when the target time is 5 minutes ahead", () => {
  const zone = "Asia/Kolkata"; // UTC+5:30, no DST
  // 2026-06-15T12:00:00Z === 17:30 local in Kolkata
  const from = new Date("2026-06-15T12:00:00.000Z");

  const result = computeNextRunAt(17, 35, zone, from);

  // Same calendar day, 17:35 local -> 12:05:00Z
  assert.equal(result.toISOString(), "2026-06-15T12:05:00.000Z");
  assert.equal(
    result.toISOString(),
    slotUtcISO({ year: 2026, month: 6, day: 15, hour: 17, minute: 35 }, zone),
  );
});

test("rolls to tomorrow's slot when the target time is 5 minutes behind", () => {
  const zone = "Asia/Kolkata";
  // 17:30 local
  const from = new Date("2026-06-15T12:00:00.000Z");

  const result = computeNextRunAt(17, 25, zone, from);

  // 17:25 already passed today -> tomorrow 2026-06-16 17:25 local -> 11:55:00Z
  assert.equal(result.toISOString(), "2026-06-16T11:55:00.000Z");
  assert.equal(
    result.toISOString(),
    slotUtcISO({ year: 2026, month: 6, day: 16, hour: 17, minute: 25 }, zone),
  );
});

test("crosses midnight: 23:58 local now, 00:15 target -> next calendar day", () => {
  const zone = "Asia/Kolkata";
  // 2026-06-15 23:58 local -> 18:28:00Z
  const from = new Date("2026-06-15T18:28:00.000Z");

  const result = computeNextRunAt(0, 15, zone, from);

  // 00:15 on 2026-06-15 already passed -> 2026-06-16 00:15 local -> 2026-06-15T18:45:00Z
  assert.equal(result.toISOString(), "2026-06-15T18:45:00.000Z");
  assert.equal(
    result.toISOString(),
    slotUtcISO({ year: 2026, month: 6, day: 16, hour: 0, minute: 15 }, zone),
  );
});

test("DST spring forward: target lands at correct wall-clock time on the EDT side", () => {
  const zone = "America/New_York";
  // 2026-03-07 12:00 local EST (UTC-5) -> 17:00:00Z. Spring forward is 2026-03-08 02:00.
  const from = new Date("2026-03-07T17:00:00.000Z");

  const result = computeNextRunAt(7, 0, zone, from);

  // 07:00 already passed on Mar 7 -> Mar 8 07:00 local, which is EDT (UTC-4) -> 11:00:00Z
  // (NOT 12:00:00Z, which would be wrong EST math)
  assert.equal(result.toISOString(), "2026-03-08T11:00:00.000Z");
  assert.equal(
    result.toISOString(),
    slotUtcISO({ year: 2026, month: 3, day: 8, hour: 7 }, zone),
  );
});

test("DST fall back: target on Nov 1 2026 lands in EST (UTC-5)", () => {
  const zone = "America/New_York";
  // 2026-10-31 12:00 local EDT (UTC-4) -> 16:00:00Z. Fall back is 2026-11-01 02:00.
  const from = new Date("2026-10-31T16:00:00.000Z");

  const result = computeNextRunAt(7, 0, zone, from);

  // Nov 1 07:00 local is after the fall-back -> EST (UTC-5) -> 12:00:00Z
  assert.equal(result.toISOString(), "2026-11-01T12:00:00.000Z");
  assert.equal(
    result.toISOString(),
    slotUtcISO({ year: 2026, month: 11, day: 1, hour: 7 }, zone),
  );
});

test("nonexistent 02:30 'spring forward' wall time is normalized like Luxon does", () => {
  const zone = "America/New_York";
  // 2026-03-08 01:00 local EST -> 06:00:00Z, before the 02:00 -> 03:00 jump.
  const from = new Date("2026-03-08T06:00:00.000Z");

  const result = computeNextRunAt(2, 30, zone, from);

  // 02:30 does not exist on 2026-03-08. Luxon shifts it forward to 03:30 EDT.
  // candidate (03:30) is still after now (01:00), so no +1 day roll.
  const expected = DateTime.fromObject(
    { year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
    { zone },
  )
    .toUTC()
    .toJSDate()
    .toISOString();

  assert.equal(result.toISOString(), expected);
  // Concretely: 03:30 EDT -> 07:30:00Z
  assert.equal(result.toISOString(), "2026-03-08T07:30:00.000Z");
});

test("safeTimezone falls back to Asia/Kolkata for an invalid zone, and computeNextRunAt follows", () => {
  assert.equal(safeTimezone("Not/AZone"), "Asia/Kolkata");
  assert.equal(safeTimezone(null), "Asia/Kolkata");
  assert.equal(safeTimezone("America/New_York"), "America/New_York");

  const from = new Date("2026-06-15T12:00:00.000Z"); // 17:30 in Kolkata
  const viaInvalid = computeNextRunAt(17, 35, "Not/AZone", from);
  const viaKolkata = computeNextRunAt(17, 35, "Asia/Kolkata", from);

  assert.equal(viaInvalid.toISOString(), viaKolkata.toISOString());
  assert.equal(viaInvalid.toISOString(), "2026-06-15T12:05:00.000Z");
});

test("exact-match target time (candidate === now) rolls to tomorrow", () => {
  const zone = "Asia/Kolkata";
  // Exactly 17:30:00.000 local
  const from = new Date("2026-06-15T12:00:00.000Z");

  const result = computeNextRunAt(17, 30, zone, from);

  // candidate <= nowLocal is inclusive, so this rolls forward a day
  assert.equal(result.toISOString(), "2026-06-16T12:00:00.000Z");
});

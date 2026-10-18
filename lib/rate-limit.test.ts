import { test } from "node:test";
import assert from "node:assert/strict";
import { decideLandingRun, LANDING_HOURLY_LIMIT } from "./rate-limit";

const now = new Date("2026-09-06T12:00:00.000Z");

test("allows a run when the window is empty", () => {
  assert.deepEqual(decideLandingRun([], now), { ok: true });
});

test("allows a run at one below the limit", () => {
  const stamps = Array.from({ length: LANDING_HOURLY_LIMIT - 1 }, () => new Date(now.getTime() - 5 * 60_000));
  assert.deepEqual(decideLandingRun(stamps, now), { ok: true });
});

test("blocks a run at the limit and reports minutes until the oldest ages out", () => {
  // oldest was 50 minutes ago -> retry in ~10 minutes
  const stamps = [
    new Date(now.getTime() - 50 * 60_000),
    ...Array.from({ length: LANDING_HOURLY_LIMIT - 1 }, () => new Date(now.getTime() - 5 * 60_000)),
  ];
  const result = decideLandingRun(stamps, now);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.retryAfterMinutes >= 9 && result.retryAfterMinutes <= 11, `got ${result.retryAfterMinutes}`);
});

test("retryAfterMinutes is at least 1 even when the oldest is almost 60 minutes old", () => {
  const stamps = [
    new Date(now.getTime() - 59.9 * 60_000),
    ...Array.from({ length: LANDING_HOURLY_LIMIT - 1 }, () => new Date(now.getTime() - 5 * 60_000)),
  ];
  const result = decideLandingRun(stamps, now);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.retryAfterMinutes, 1);
});

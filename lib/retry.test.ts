import assert from "node:assert/strict";
import { test } from "node:test";
import { isRetryableError, withBackoff } from "./retry";

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly headers: Record<string, string> = {}
  ) {
    super(`HTTP ${status}`);
  }
}

const noSleep = { sleep: async () => {}, random: () => 1 };

test("isRetryableError: 429 and 5xx yes, other 4xx and plain errors no", () => {
  assert.equal(isRetryableError(new HttpError(429)), true);
  assert.equal(isRetryableError(new HttpError(503)), true);
  assert.equal(isRetryableError(new HttpError(400)), false);
  assert.equal(isRetryableError(new HttpError(401)), false);
  assert.equal(isRetryableError(new Error("boom")), false);
  assert.equal(isRetryableError("nope"), false);
});

test("withBackoff retries transient errors then succeeds, with doubling delays", async () => {
  const delays: number[] = [];
  let calls = 0;
  const result = await withBackoff(
    async () => {
      calls++;
      if (calls < 3) throw new HttpError(429);
      return "ok";
    },
    { random: () => 1, sleep: async (ms) => void delays.push(ms) }
  );
  assert.equal(result, "ok");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [1000, 2000]);
});

test("withBackoff does not retry non-retryable errors", async () => {
  let calls = 0;
  await assert.rejects(
    withBackoff(async () => {
      calls++;
      throw new HttpError(400);
    }, noSleep),
    /HTTP 400/
  );
  assert.equal(calls, 1);
});

test("withBackoff gives up after maxAttempts and rethrows the last error", async () => {
  let calls = 0;
  await assert.rejects(
    withBackoff(
      async () => {
        calls++;
        throw new HttpError(500);
      },
      { ...noSleep, maxAttempts: 3 }
    ),
    /HTTP 500/
  );
  assert.equal(calls, 3);
});

test("withBackoff honours Retry-After when longer than the computed delay", async () => {
  const delays: number[] = [];
  let calls = 0;
  await withBackoff(
    async () => {
      calls++;
      if (calls === 1) throw new HttpError(429, { "retry-after": "7" });
      return 1;
    },
    { random: () => 0, sleep: async (ms) => void delays.push(ms) }
  );
  assert.deepEqual(delays, [7000]);
});

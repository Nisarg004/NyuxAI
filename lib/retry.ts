export type BackoffOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

type HttpLikeError = { status?: unknown; headers?: unknown; name?: unknown };

function statusOf(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const status = (err as HttpLikeError).status;
  return typeof status === "number" ? status : undefined;
}

// 429 and 5xx are transient, as are connection-level failures (no HTTP status at all).
export function isRetryableError(err: unknown): boolean {
  const status = statusOf(err);
  if (status !== undefined) return status === 429 || status >= 500;
  if (typeof err !== "object" || err === null) return false;
  const name = (err as HttpLikeError).name;
  return name === "APIConnectionError" || name === "APIConnectionTimeoutError";
}

// Honours a Retry-After header (seconds) when the provider sends one.
function retryAfterMs(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const headers = (err as HttpLikeError).headers;
  if (typeof headers !== "object" || headers === null) return undefined;
  const raw =
    typeof (headers as Headers).get === "function"
      ? (headers as Headers).get("retry-after")
      : (headers as Record<string, unknown>)["retry-after"];
  const seconds = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

// Runs `fn`, retrying transient failures with exponential backoff + jitter. Non-retryable
// errors and the final attempt's error are rethrown unchanged for the caller to handle.
export async function withBackoff<T>(fn: () => Promise<T>, opts: BackoffOptions = {}): Promise<T> {
  const {
    maxAttempts = 4,
    baseDelayMs = 1000,
    maxDelayMs = 20_000,
    sleep = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    random = Math.random,
  } = opts;

  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxAttempts || !isRetryableError(err)) throw err;
      const exponential = baseDelayMs * 2 ** (attempt - 1);
      const jittered = exponential * (0.5 + random() * 0.5);
      const delay = Math.min(maxDelayMs, Math.max(retryAfterMs(err) ?? 0, jittered));
      console.warn(`[llm] transient error (status ${statusOf(err) ?? "network"}); retry ${attempt}/${maxAttempts - 1} in ${Math.round(delay)}ms`);
      await sleep(delay);
    }
  }
}

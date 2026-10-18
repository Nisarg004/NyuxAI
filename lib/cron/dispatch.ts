import { and, eq, isNotNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences, users } from "@/lib/db/schema";
import { cronSecretHeader, getInternalBaseUrl } from "@/lib/internal-api";
import { computeNextRunAt } from "@/lib/schedule";

/**
 * The Phase 6 scheduler. `runDispatch` finds every active user whose
 * `preferences.next_run_at` is due, and for each one:
 *
 *  1. Atomically claims the slot — a conditional
 *     `UPDATE preferences SET next_run_at = <tomorrow's slot>
 *      WHERE user_id = ? AND next_run_at = <the exact value we just read>`.
 *     If another dispatcher (a second GitHub Actions run, or `npm run watch`
 *     firing while the previous tick is still working) already rolled that
 *     row forward, this UPDATE matches zero rows and we skip the user. This
 *     is the primary double-send guard; `claimDueRun` is unit-tested for the
 *     concurrent case in `dispatch.test.ts`.
 *  2. Loops back into `/api/digest/send-now/run` with the CRON_SECRET and the
 *     due slot as `scheduledFor`. That route runs the pipeline and sends the
 *     email; passing `scheduledFor` makes the `digests (user_id, scheduled_for)`
 *     unique index the backstop guard against a true simultaneous race.
 *
 * `next_run_at` is rolled forward BEFORE the pipeline runs, so a user whose
 * pipeline fails is not retried every 15 minutes forever — the failure is
 * recorded in a `runs` row and they get the next day's brief as normal.
 *
 * Users are processed sequentially (LLM rate limits, and the route's 300s
 * budget). `durationMs` is reported so the ceiling stays visible as the user
 * count grows.
 */

export type DispatchUserResult = {
  email: string;
  claimed: boolean;
  sent: boolean;
  note?: string;
  error?: string;
};

export type DispatchResult = {
  due: number;
  processed: DispatchUserResult[];
  durationMs: number;
};

type DueUser = {
  userId: string;
  email: string;
  dueRunAt: Date;
  deliveryHour: number;
  deliveryMinute: number;
  timezone: string;
};

async function fetchDueUsers(asOf: Date): Promise<DueUser[]> {
  const rows = await db
    .select({
      userId: preferences.userId,
      email: users.email,
      dueRunAt: preferences.nextRunAt,
      deliveryHour: preferences.deliveryHour,
      deliveryMinute: preferences.deliveryMinute,
      timezone: preferences.timezone,
    })
    .from(preferences)
    .innerJoin(users, eq(users.id, preferences.userId))
    .where(
      and(
        eq(preferences.isActive, true),
        isNotNull(users.emailVerifiedAt),
        isNotNull(preferences.nextRunAt),
        lte(preferences.nextRunAt, asOf)
      )
    );

  return rows.flatMap((row) =>
    row.dueRunAt ? [{ ...row, dueRunAt: row.dueRunAt }] : []
  );
}

/**
 * The atomic slot claim. Returns true only if THIS call is the one that moved
 * `next_run_at` off `expectedRunAt` — a concurrent caller with the same
 * `expectedRunAt` gets false. Exported for `dispatch.test.ts`.
 */
export async function claimDueRun(
  userId: string,
  expectedRunAt: Date,
  nextRunAt: Date
): Promise<boolean> {
  const claimed = await db
    .update(preferences)
    .set({ nextRunAt })
    .where(
      and(eq(preferences.userId, userId), eq(preferences.nextRunAt, expectedRunAt))
    )
    .returning({ userId: preferences.userId });

  return claimed.length > 0;
}

// Drains the SSE stream from /api/digest/send-now/run and returns the terminal
// event (a `done` or `error`), or null if the stream ended without one.
async function drainRunStream(
  body: ReadableStream<Uint8Array>
): Promise<Record<string, unknown> | null> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal: Record<string, unknown> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      const dataLine = frame
        .split("\n")
        .find((line) => line.startsWith("data:"));
      if (!dataLine) continue;

      try {
        const event = JSON.parse(dataLine.slice(5).trim()) as Record<string, unknown>;
        if (event.type === "done" || event.type === "error") {
          terminal = event;
        }
      } catch {
        // A malformed frame is not fatal — keep reading for the terminal event.
      }
    }
  }

  return terminal;
}

async function runPipelineFor(
  user: DueUser,
  baseUrl: string
): Promise<{ sent: boolean; note?: string; error?: string }> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/digest/send-now/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cronSecretHeader() },
      body: JSON.stringify({
        userId: user.userId,
        scheduledFor: user.dueRunAt.toISOString(),
      }),
    });
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }

  if (!response.ok || !response.body) {
    return { sent: false, error: `send-now/run responded ${response.status}` };
  }

  const terminal = await drainRunStream(response.body);
  if (!terminal) {
    return { sent: false, error: "stream ended without a terminal event" };
  }
  if (terminal.type === "error") {
    return { sent: false, error: String(terminal.error ?? "unknown pipeline error") };
  }
  return {
    sent: Boolean(terminal.sent),
    note: typeof terminal.note === "string" ? terminal.note : undefined,
  };
}

export async function runDispatch(opts: {
  baseUrl?: string;
  now?: Date;
} = {}): Promise<DispatchResult> {
  const startedAt = Date.now();
  const asOf = opts.now ?? new Date();
  // Loop back through the same base URL the app uses for its other
  // server-to-server calls — the production alias, never the per-deployment
  // hostname (which Vercel Deployment Protection gates). See lib/internal-api.ts.
  const baseUrl = opts.baseUrl ?? getInternalBaseUrl();
  const dueUsers = await fetchDueUsers(asOf);
  const processed: DispatchUserResult[] = [];

  for (const user of dueUsers) {
    const nextRunAt = computeNextRunAt(
      user.deliveryHour,
      user.deliveryMinute,
      user.timezone,
      asOf
    );

    const claimed = await claimDueRun(user.userId, user.dueRunAt, nextRunAt);
    if (!claimed) {
      processed.push({
        email: user.email,
        claimed: false,
        sent: false,
        note: "slot already claimed by a concurrent dispatch",
      });
      continue;
    }

    const outcome = await runPipelineFor(user, baseUrl);
    processed.push({ email: user.email, claimed: true, ...outcome });
  }

  return {
    due: dueUsers.length,
    processed,
    durationMs: Date.now() - startedAt,
  };
}

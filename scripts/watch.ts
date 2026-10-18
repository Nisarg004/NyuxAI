import { config } from "dotenv";
config({ path: ".env.local" });

/**
 * A local stand-in for the GitHub Actions cron (.github/workflows/dispatch.yml),
 * for demos where that cron's 5-15 minute lateness would be a problem. Polls
 * POST /api/cron/dispatch every 60s and prints what it queued. The server starts
 * the workers itself (see app/api/cron/dispatch/route.ts), so this is all a demo needs.
 *
 *   npm run watch                                  # -> http://localhost:3000
 *   BASE_URL=https://brieff-nine.vercel.app npm run watch
 *
 * Reads CRON_SECRET from .env.local (same as the other scripts). Ctrl-C to stop.
 */

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const INTERVAL_MS = 60_000;
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error("CRON_SECRET is not set (expected in .env.local).");
  process.exit(1);
}

type DispatchResponse = {
  success: boolean;
  due?: number;
  durationMs?: number;
  runnableJobs?: number;
  processed?: { email: string; claimed: boolean; enqueued: boolean; note?: string }[];
  error?: string;
};

function stamp(): string {
  return new Date().toLocaleTimeString();
}

async function tick(): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/cron/dispatch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${CRON_SECRET}`, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[${stamp()}] request failed: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  if (!res.ok) {
    console.error(`[${stamp()}] ${BASE_URL} responded ${res.status}`);
    return;
  }

  const body = (await res.json()) as DispatchResponse;
  const took = body.durationMs != null ? ` (${(body.durationMs / 1000).toFixed(1)}s)` : "";

  // The dispatcher only enqueues; workers it starts in the background do the generating
  // and sending. Each tick also picks up send jobs that have come due since the last one.
  console.log(`[${stamp()}] ${body.due ?? 0} due, ${body.runnableJobs ?? 0} runnable job(s)${took}`);
  for (const p of body.processed ?? []) {
    const state = p.claimed ? "queued" : (p.note ?? "already claimed");
    console.log(`[${stamp()}]   ${p.email}: ${state}`);
  }
}

async function main(): Promise<void> {
  console.log(`watch: polling ${BASE_URL}/api/cron/dispatch every ${INTERVAL_MS / 1000}s`);
  await tick();
  setInterval(() => {
    void tick();
  }, INTERVAL_MS);
}

void main();

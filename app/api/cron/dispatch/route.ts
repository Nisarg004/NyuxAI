import { NextResponse, after } from "next/server";
import { isAuthorizedCronCaller } from "@/lib/internal-api";
import { fanOutWorkers, runDispatch } from "@/lib/cron/dispatch";

// Enqueue-only: finds due users, queues their jobs and returns within seconds. The
// actual generation and sending happens in /api/jobs/worker invocations that this
// route starts in `after()`, which keeps running for up to maxDuration after the
// response and waits on all of them.
export const maxDuration = 300;

// Requires the CRON_SECRET bearer token — see lib/internal-api.ts. Called by
// .github/workflows/dispatch.yml every 15 minutes and by `npm run watch`.
export async function POST(request: Request) {
  if (!isAuthorizedCronCaller(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDispatch();
  after(() => fanOutWorkers({ runnableJobs: result.runnableJobs }));
  return NextResponse.json({ success: true, ...result });
}

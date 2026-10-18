import { NextResponse } from "next/server";
import { isAuthorizedCronCaller } from "@/lib/internal-api";
import { runWorker } from "@/lib/jobs/worker";

// Drains the jobs queue (generate + send). Several of these run in parallel, each in
// its own serverless function — see fanOutWorkers in lib/cron/dispatch.ts. 300s is
// Vercel's ceiling; runWorker stops claiming new jobs well before then.
export const maxDuration = 300;

// Requires the CRON_SECRET bearer token — see lib/internal-api.ts.
export async function POST(request: Request) {
  if (!isAuthorizedCronCaller(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runWorker();
  return NextResponse.json({ success: true, ...result });
}

import { NextResponse } from "next/server";
import { isAuthorizedCronCaller } from "@/lib/internal-api";
import { runDispatch } from "@/lib/cron/dispatch";

// Fans out to /api/digest/send-now/run once per due user, sequentially. Each of
// those can take well over a minute; 300s is Vercel's ceiling on Hobby (with
// Fluid Compute). The response reports `durationMs` so the ceiling stays
// visible as the user count grows — see lib/cron/dispatch.ts.
export const maxDuration = 300;

// Requires the CRON_SECRET bearer token — see lib/internal-api.ts. Called by
// .github/workflows/dispatch.yml every 15 minutes and by `npm run watch`.
export async function POST(request: Request) {
  if (!isAuthorizedCronCaller(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDispatch();
  return NextResponse.json({ success: true, ...result });
}

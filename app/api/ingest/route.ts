import { NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest";
import { isAuthorizedCronCaller } from "@/lib/internal-api";

// Fetching every active RSS source can run well past a minute (observed 70s+
// live). 300s is Vercel's actual ceiling on Hobby (with Fluid Compute, both
// the default and the maximum) — set explicitly so it's a guaranteed floor,
// not an implicit default that could change.
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isAuthorizedCronCaller(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await runIngest();
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { generateDigest } from "@/lib/agents/pipeline";
import { isAuthorizedCronCaller } from "@/lib/internal-api";

// Runs the full Curator -> Researcher -> Writer -> Editor pipeline; a
// multi-sector user can take well over a minute. 300s is Vercel's ceiling on
// Hobby (with Fluid Compute) — set explicitly, not left as an implicit default.
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isAuthorizedCronCaller(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const userId = typeof body.userId === "string" ? body.userId : null;
  if (!userId) {
    return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
  }

  const dryRun = Boolean(body.dryRun);
  const result = await generateDigest(userId, { dryRun });
  return NextResponse.json(result);
}

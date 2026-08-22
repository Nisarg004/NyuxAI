import { NextResponse } from "next/server";
import { generateDigest } from "@/lib/agents/pipeline";

export async function POST(request: Request) {
  const body = await request.json();
  const userId = typeof body.userId === "string" ? body.userId : null;
  if (!userId) {
    return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
  }

  const dryRun = Boolean(body.dryRun);
  const result = await generateDigest(userId, { dryRun });
  return NextResponse.json(result);
}

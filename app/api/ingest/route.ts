import { NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest";
import { isAuthorizedCronCaller } from "@/lib/internal-api";

export async function POST(request: Request) {
  if (!isAuthorizedCronCaller(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await runIngest();
  return NextResponse.json(result);
}

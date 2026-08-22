import { NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest";

export async function POST() {
  const result = await runIngest();
  return NextResponse.json(result);
}

"use server";

import { redirect } from "next/navigation";
import { unsubscribeByToken } from "@/lib/unsubscribe";

export async function confirmUnsubscribe(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const ok = token ? await unsubscribeByToken(token) : false;
  redirect(ok ? "/unsubscribe?done=1" : "/unsubscribe?error=invalid");
}

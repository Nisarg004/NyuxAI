"use server";

import { redirect } from "next/navigation";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { startSession } from "@/lib/session";

export async function confirmSignIn(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const userId = token ? await consumeMagicLink(token) : null;
  if (!userId) redirect("/signin?error=expired");

  await startSession(userId);
  redirect("/dashboard");
}

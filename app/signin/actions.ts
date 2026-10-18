"use server";

import { redirect } from "next/navigation";
import { requestMagicLink } from "@/lib/auth/magic-link";

export async function requestSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) redirect("/signin?error=invalid");

  const outcome = await requestMagicLink(email, { requireAccount: true });
  redirect(outcome === "rate_limited" ? "/signin?error=rate" : "/signin?sent=1");
}

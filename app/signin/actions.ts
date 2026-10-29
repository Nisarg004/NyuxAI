"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestMagicLink } from "@/lib/auth/magic-link";
import { clientIp, hashIp } from "@/lib/client-ip";

export async function requestSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) redirect("/signin?error=invalid");

  const outcome = await requestMagicLink(email, {
    requireAccount: true,
    ipHash: hashIp(clientIp(await headers())),
  });
  redirect(outcome === "rate_limited" ? "/signin?error=rate" : "/signin?sent=1");
}

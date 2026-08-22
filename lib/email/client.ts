import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  throw new Error("RESEND_API_KEY is not set");
}

export const resend = new Resend(apiKey);
export const EMAIL_FROM = process.env.EMAIL_FROM ?? "Brieff <onboarding@resend.dev>";

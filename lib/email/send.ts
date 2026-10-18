export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
};

export type SendEmailResult = { ok: true; id?: string } | { ok: false; error: string };

// The one place the digest email leaves the app. Without RESEND_API_KEY (local
// dev, tests) it logs instead of sending, so the full pipeline can run safely;
// the Resend client is imported lazily because it throws at import without a key.
export async function sendEmail(email: OutgoingEmail): Promise<SendEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email] RESEND_API_KEY not set — would send "${email.subject}" to ${email.to}`, email.headers ?? {});
    return { ok: true };
  }
  const { resend, EMAIL_FROM } = await import("./client");
  const { data, error } = await resend.emails.send({ from: EMAIL_FROM, ...email });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

import { unsubscribeByToken } from "@/lib/unsubscribe";

// RFC 8058 one-click target: mail clients POST `List-Unsubscribe=One-Click` here
// with no cookies, so authority comes entirely from the signed token in the URL.
// GET is deliberately unsupported — link scanners prefetch GETs and must not
// be able to unsubscribe anyone; the human-facing flow is the /unsubscribe page.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("t");
  const ok = token ? await unsubscribeByToken(token) : false;
  return new Response(ok ? "Unsubscribed" : "Invalid or malformed link", { status: ok ? 200 : 400 });
}

import { redirect } from "next/navigation";
import { confirmSignIn } from "./actions";
import { Button } from "@/components/ui/button";

// The link in the email only renders this confirmation page; the token is
// spent by the POST below. Mail scanners that prefetch links issue a GET, so
// a GET must never consume the token.
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect("/signin?error=expired");

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-16">
      <h1 className="font-display text-4xl font-semibold leading-none tracking-[-0.02em] text-ink">Brieff</h1>
      <p className="mt-3 font-display text-lg italic text-ink-soft">One click and you&rsquo;re in.</p>
      <form action={confirmSignIn} className="mt-10">
        <input type="hidden" name="token" value={token} />
        <Button type="submit" className="w-full rounded-[3px] bg-ink text-paper hover:bg-editor">
          Sign in to Brieff
        </Button>
      </form>
    </main>
  );
}

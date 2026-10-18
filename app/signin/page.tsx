import Link from "next/link";
import { requestSignIn } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERRORS: Record<string, string> = {
  invalid: "That doesn't look like an email address.",
  rate: "Too many links requested for that address. Try again in an hour.",
  expired: "That sign-in link has expired or was already used. Request a new one.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? ERRORS[sp.error] : undefined;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-16">
      <h1 className="font-display text-4xl font-semibold leading-none tracking-[-0.02em] text-ink">Brieff</h1>
      <p className="mt-3 font-display text-lg italic text-ink-soft">Back to your desk.</p>

      {sp.sent ? (
        <p className="mt-10 text-ink">
          If there&rsquo;s an account for that address, a sign-in link is on its way. It works once and expires in
          30 minutes.
        </p>
      ) : (
        <form action={requestSignIn} className="mt-10 space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-ink-soft">Email</Label>
            <Input id="email" name="email" type="email" required autoFocus className="rounded-[3px]" />
          </div>
          {error ? <p className="text-sm text-editor">{error}</p> : null}
          <Button type="submit" className="w-full rounded-[3px] bg-ink text-paper hover:bg-editor">
            Email me a sign-in link
          </Button>
        </form>
      )}

      <p className="mt-8 text-sm text-ink-soft">
        New here?{" "}
        <Link href="/onboarding" className="text-editor underline decoration-editor/40 underline-offset-4">
          Set up your briefing
        </Link>
      </p>
    </main>
  );
}

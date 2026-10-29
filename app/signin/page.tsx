import Link from "next/link";
import { requestSignIn } from "./actions";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERRORS: Record<string, string> = {
  invalid: "That doesn't look like an email address. Check it and try again.",
  rate: "Too many links requested for that address. Try again in an hour.",
  expired: "That sign-in link has expired or was already used. Request a new one below.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? ERRORS[sp.error] : undefined;

  return (
    <main className="horizon flex flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-16">
      <Link href="/" aria-label="Nyux home" className="inline-flex text-xl text-star">
        <Logo />
      </Link>

      <div className="panel mt-10 w-full max-w-md p-6 sm:p-8">
        {sp.sent ? (
          <>
            <h1 className="font-display text-3xl font-bold leading-none tracking-[-0.03em] text-star">
              Check your inbox
            </h1>
            <p className="mt-4 leading-relaxed text-haze">
              If there&rsquo;s an account for that address, a sign-in link is on its way. It works once and expires
              in 30 minutes.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-haze">
              Nothing arrived? Check spam, or{" "}
              <Link href="/signin" className="text-aurora underline underline-offset-4 hover:text-star">
                try another address
              </Link>
              .
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-bold leading-none tracking-[-0.03em] text-star">
              Sign in to Nyux
            </h1>
            <p className="mt-3 leading-relaxed text-haze">
              We&rsquo;ll email you a link. No password needed.
            </p>
            <form action={requestSignIn} className="mt-7 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-star">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoFocus
                  aria-invalid={sp.error === "invalid" ? true : undefined}
                  aria-describedby={error ? "signin-error" : undefined}
                />
              </div>
              {error ? (
                <p
                  id="signin-error"
                  role="alert"
                  className="rounded-[14px] border border-alarm/40 bg-alarm/10 px-4 py-3 text-sm leading-relaxed text-alarm"
                >
                  {error}
                </p>
              ) : null}
              <Button type="submit" size="lg" className="w-full">
                Email me a sign-in link
              </Button>
            </form>
          </>
        )}
      </div>

      <p className="mt-6 w-full max-w-md text-sm text-haze">
        New here?{" "}
        <Link href="/onboarding" className="text-aurora underline underline-offset-4 hover:text-star">
          Set up your brief
        </Link>
      </p>
    </main>
  );
}

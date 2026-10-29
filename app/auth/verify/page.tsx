import Link from "next/link";
import { redirect } from "next/navigation";
import { confirmSignIn } from "./actions";
import { Logo } from "@/components/brand/logo";
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
    <main className="horizon flex flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-16">
      <Link href="/" aria-label="Nyux home" className="inline-flex text-xl text-star">
        <Logo />
      </Link>

      <div className="panel mt-10 w-full max-w-md p-6 sm:p-8">
        <h1 className="font-display text-3xl font-bold leading-none tracking-[-0.03em] text-star">
          One click and you&rsquo;re in
        </h1>
        <p className="mt-3 leading-relaxed text-haze">Confirm it&rsquo;s you to open your brief.</p>
        <form action={confirmSignIn} className="mt-7">
          <input type="hidden" name="token" value={token} />
          <Button type="submit" size="lg" className="w-full">
            Sign in to Nyux
          </Button>
        </form>
      </div>
    </main>
  );
}

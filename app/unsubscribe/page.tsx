import Link from "next/link";
import { confirmUnsubscribe } from "./actions";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

// The emailed link only renders this confirmation; the POST below does the work,
// so a mail scanner that prefetches the URL can't unsubscribe anyone.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; done?: string; error?: string }>;
}) {
  const { t, done, error } = await searchParams;

  const title = "font-display text-3xl font-bold leading-none tracking-[-0.03em] text-star";
  const link = "text-aurora underline underline-offset-4 hover:text-star";

  return (
    <main className="horizon flex flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-16">
      <Link href="/" aria-label="Nyux home" className="inline-flex text-xl text-star">
        <Logo />
      </Link>

      <div className="panel mt-10 w-full max-w-md p-6 sm:p-8">
        {done ? (
          <>
            <h1 className={title}>You&rsquo;re unsubscribed</h1>
            <p className="mt-4 leading-relaxed text-haze">
              We&rsquo;ve stopped your daily brief and won&rsquo;t email you again.
            </p>
            <Button asChild variant="outline" size="lg" className="mt-7 w-full">
              <Link href="/">Back to Nyux</Link>
            </Button>
          </>
        ) : error || !t ? (
          <>
            <h1 className={title}>This link isn&rsquo;t valid</h1>
            <p className="mt-4 leading-relaxed text-haze">
              Please use the unsubscribe link in your most recent Nyux email, or{" "}
              <Link href="/signin" className={link}>
                sign in
              </Link>{" "}
              to change your delivery.
            </p>
          </>
        ) : (
          <>
            <h1 className={title}>Stop your daily brief?</h1>
            <p className="mt-3 leading-relaxed text-haze">
              You&rsquo;ll stop getting Nyux by email. You can come back any time.
            </p>
            <form action={confirmUnsubscribe} className="mt-7">
              <input type="hidden" name="token" value={t} />
              <Button type="submit" size="lg" className="w-full">
                Unsubscribe
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

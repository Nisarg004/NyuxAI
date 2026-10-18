import Link from "next/link";
import { confirmUnsubscribe } from "./actions";
import { Button } from "@/components/ui/button";

// The emailed link only renders this confirmation; the POST below does the work,
// so a mail scanner that prefetches the URL can't unsubscribe anyone.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; done?: string; error?: string }>;
}) {
  const { t, done, error } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-16">
      <h1 className="font-display text-4xl font-semibold leading-none tracking-[-0.02em] text-ink">Brieff</h1>
      {done ? (
        <>
          <p className="mt-3 font-display text-lg italic text-ink-soft">You&rsquo;re unsubscribed.</p>
          <p className="mt-6 text-ink">
            We&rsquo;ve stopped your daily brief and won&rsquo;t email you again.{" "}
            <Link href="/" className="underline">
              Back to Brieff
            </Link>
          </p>
        </>
      ) : error || !t ? (
        <p className="mt-6 text-ink">
          This unsubscribe link isn&rsquo;t valid. Please use the link in your most recent Brieff email.
        </p>
      ) : (
        <>
          <p className="mt-3 font-display text-lg italic text-ink-soft">Stop your daily brief?</p>
          <form action={confirmUnsubscribe} className="mt-10">
            <input type="hidden" name="token" value={t} />
            <Button type="submit" className="w-full rounded-[3px] bg-ink text-paper hover:bg-editor">
              Unsubscribe
            </Button>
          </form>
        </>
      )}
    </main>
  );
}

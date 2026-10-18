import Link from "next/link";
import { BriefGenerator } from "@/components/landing/brief-generator";

/**
 * The landing page IS the product demo. A stranger picks up to three desks,
 * says what they do, and reads a real brief — generated live by the same
 * four-agent pipeline subscribers get — before being asked for an email.
 */
export default function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 sm:py-14">
      <header className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <div>
          <h1 className="font-display text-5xl font-semibold leading-none tracking-[-0.02em] text-ink sm:text-6xl">
            Brieff
          </h1>
          <p className="mt-2 font-display text-lg italic text-ink-soft">
            An edition of the news, edited for one reader.
          </p>
        </div>
        <Link
          href="/signin"
          className="text-editor underline decoration-editor/40 underline-offset-4 hover:decoration-editor"
        >
          Already set up? Sign in
        </Link>
      </header>

      <div className="mt-6 border-t border-ink" />

      <div className="mt-8 max-w-2xl">
        <p className="text-[1.0625rem] leading-[1.7] text-ink/90">
          Tell the desk what you watch and what you do. A curator, a researcher, a writer and an
          editor will assemble today&rsquo;s edition for you — right now, in about a minute. No signup
          to read it.
        </p>
      </div>

      <BriefGenerator />
    </main>
  );
}

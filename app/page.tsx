import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { WireCanvas } from "@/components/landing/wire-canvas";
import { BriefGenerator } from "@/components/landing/brief-generator";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Showcase } from "@/components/landing/showcase";
import { Plans } from "@/components/landing/plans";
import { getLandingStats, getShowcaseEdition } from "@/lib/landing-data";

// The numbers and the sample edition change through the day; ten minutes is fresh enough.
export const revalidate = 600;

/**
 * The landing page. The hero shows the idea (hundreds of stories become ten lines),
 * then the visitor builds a real brief live with the same pipeline subscribers get,
 * before being asked for an email.
 */
export default async function LandingPage() {
  const [stats, edition] = await Promise.all([getLandingStats(), getShowcaseEdition()]);

  return (
    <main className="flex-1">
      <section className="relative isolate overflow-hidden horizon">
        <WireCanvas className="absolute inset-0 -z-10 h-full w-full" />

        <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <Link href="/" aria-label="Nyux home" className="text-2xl text-star">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-2">
            <a href="#how" className="hidden rounded-full px-3 py-1.5 text-haze hover:text-star sm:block">
              How it works
            </a>
            <a href="#plans" className="hidden rounded-full px-3 py-1.5 text-haze hover:text-star sm:block">
              Plans
            </a>
            <Link href="/signin" className="rounded-full px-3 py-1.5 text-haze hover:text-star">
              Sign in
            </Link>
            <Button asChild size="default" className="ml-1">
              <Link href="/onboarding">Get my brief</Link>
            </Button>
          </nav>
        </header>

        <div className="mx-auto flex min-h-[calc(100svh-76px)] max-w-6xl flex-col justify-end px-6 pb-14 pt-[42svh] md:justify-center md:pb-24 md:pt-10">
          <div className="max-w-[38rem]">
            <h1 className="font-display text-[clamp(2.6rem,5.2vw,4.6rem)] font-bold leading-[0.97] tracking-[-0.04em] text-star [font-stretch:92%]">
              Hundreds of stories broke overnight. Read the ten that matter to your work.
            </h1>
            <p className="mt-6 max-w-[30rem] text-[1.125rem] leading-[1.6] text-haze">
              Nyux reads every feed on your beat, checks each claim against its source, and writes a short
              brief for the job you do. It lands in your inbox at the hour you choose.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href="#try">Build a brief now</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/onboarding">Sign up free</Link>
              </Button>
            </div>
            {stats && stats.storiesToday > 0 ? (
              <p className="mt-8 max-w-[30rem] text-sm leading-[1.6] text-haze/80">
                {stats.storiesToday.toLocaleString("en-US")} stories from {stats.sources} sources in the last 24
                hours. Every line in your brief links to where it came from.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section id="try" className="scroll-mt-6 border-t border-line/60">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
            <div>
              <h2 className="font-display text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[1] tracking-[-0.035em] text-star">
                Try it on today&rsquo;s news.
              </h2>
              <p className="mt-5 text-[1.0625rem] leading-[1.65] text-haze">
                Pick up to three desks and tell us what you do. Four agents will build your brief from the
                last day of reporting while you watch. It takes about a minute, and you don&rsquo;t need an
                account to read it.
              </p>
            </div>
            <BriefGenerator />
          </div>
        </div>
      </section>

      <HowItWorks />

      {edition ? <Showcase edition={edition} /> : null}

      <Plans />

      <section className="relative isolate overflow-hidden border-t border-line/60 horizon">
        <div className="mx-auto max-w-6xl px-6 py-28 text-left">
          <h2 className="max-w-3xl font-display text-[clamp(2.25rem,5vw,4.25rem)] font-bold leading-[0.98] tracking-[-0.04em] text-star">
            Tomorrow&rsquo;s brief is already being written.
          </h2>
          <p className="mt-5 max-w-xl text-[1.0625rem] leading-[1.65] text-haze">
            Tell Nyux what you follow and when you read. The first one arrives at your next delivery time.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/onboarding">Sign up free</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

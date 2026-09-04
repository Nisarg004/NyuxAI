import Link from "next/link";

/**
 * The landing page is a sample edition. A visitor reads the product
 * itself — two lead stories from a real brief — and the call to action
 * sits at the end like a subscribe line.
 */

function WhyItMatters({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 border-l border-editor pl-4 text-[0.95rem] leading-[1.65] text-ink-soft">
      <span className="font-display italic text-ink">Why it matters — </span>
      {children}
    </p>
  );
}

function LeadStory({
  kicker,
  headline,
  standfirst,
  why,
  desk,
}: {
  kicker: string;
  headline: string;
  standfirst: string;
  why: React.ReactNode;
  desk: string;
}) {
  return (
    <article className="max-w-[34rem]">
      <p className="font-display text-sm italic text-ink-soft">{kicker}</p>
      <h2 className="mt-2 font-display text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.01em] text-ink sm:text-[2rem]">
        {headline}
      </h2>
      <p className="mt-3 text-[1.0625rem] leading-[1.7] text-ink/90">{standfirst}</p>
      <WhyItMatters>{why}</WhyItMatters>
      <p className="mt-4 font-display text-sm italic text-ink-soft">{desk}</p>
    </article>
  );
}

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
          href="/onboarding"
          className="text-editor underline decoration-editor/40 underline-offset-4 hover:decoration-editor"
        >
          Set up your brief
        </Link>
      </header>

      <div className="mt-6 border-t border-ink" />

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-3">
        <p className="font-display italic text-ink-soft">Tonight&rsquo;s edition</p>
        <p className="text-sm text-ink-soft">Technology and Finance, 20:00 IST</p>
      </div>

      <div className="mt-10 grid gap-12 md:grid-cols-2 md:gap-10">
        <LeadStory
          kicker="The Finance desk"
          headline="Private banks rally as credit growth holds through Q1FY27"
          standfirst="Most private-bank stocks drew buying interest after Q1FY27 results, with asset quality and NPAs at multi-year lows for several lenders. Karnataka Bank gained more than 15% in August; ICICI and HDFC Bank slipped on profit booking."
          why="you would weigh the sector's double-digit credit-growth case against the chance that margin compression runs another quarter or two."
          desk="Assembled from Reuters and Bloomberg reporting"
        />
        <div className="md:border-l md:border-rule md:pl-10">
          <LeadStory
            kicker="The Technology desk"
            headline="Nvidia leans on agent harnesses for its AI performance gains"
            standfirst="Nvidia researchers used a custom harness — memory management plus a supervisor component — to bring Claude Opus 5 to 100% on ARC-AGI-3, against 30% without it. OpenAI reported that changing two harness settings tripled its own score."
            why="for anyone building agents, the 100%-versus-30% result argues for treating memory and supervision as engineering choices alongside model selection."
            desk="Assembled from the Nvidia and OpenAI research notes"
          />
        </div>
      </div>

      <div className="mt-14 border-t border-ink pt-6">
        <div className="flex max-w-3xl flex-wrap items-end justify-between gap-6">
          <p className="max-w-xl text-[1.0625rem] leading-[1.7] text-ink/90">
            A curator, a researcher, a writer and an editor assemble an edition like this every day and send it at the
            hour you actually sit down to read. Thumbs up or down on any story and the next edition shifts.
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center rounded-[3px] bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-editor"
          >
            Set up your brief
          </Link>
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const FREE = [
  "A daily brief at the hour you choose",
  "Up to five desks",
  "Written for your role, if you tell us it",
  "Every past brief, kept in your archive",
  "Thumbs up or down to tune what you get",
];

const PRO = [
  "Briefs morning and evening, or when a story breaks",
  "Delivery to Slack and WhatsApp",
  "Your own sources and keywords",
  "Shared briefs for a team",
];

export function Plans() {
  return (
    <section id="plans" className="scroll-mt-6 border-t border-line/60">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="max-w-2xl font-display text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[1] tracking-[-0.035em] text-star">
          Free while we&rsquo;re in early access.
        </h2>
        <p className="mt-5 max-w-xl text-[1.0625rem] leading-[1.65] text-haze">
          Everything Nyux does today costs nothing. A paid plan for heavier readers is on the way; you&rsquo;ll
          hear about it first, and nothing is ever charged without you choosing it.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <div className="sheet flex flex-col p-8">
            <h3 className="font-display text-2xl font-bold tracking-[-0.03em] text-ink">Early access</h3>
            <p className="mt-1 text-ink-soft">Free, everything included</p>
            <ul className="mt-6 space-y-3">
              {FREE.map((line) => (
                <li key={line} className="flex gap-3 text-[0.975rem] leading-[1.5] text-ink">
                  <Check className="mt-0.5 size-4 shrink-0 text-aurora" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
            <Button asChild variant="ink" size="lg" className="mt-8 self-start">
              <Link href="/onboarding">Sign up free</Link>
            </Button>
          </div>

          <div className="panel flex flex-col p-8">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-display text-2xl font-bold tracking-[-0.03em] text-star">Pro</h3>
              <span className="rounded-full border border-line px-3 py-1 text-sm text-haze">Coming soon</span>
            </div>
            <p className="mt-1 text-haze">For people whose job is knowing first</p>
            <ul className="mt-6 space-y-3">
              {PRO.map((line) => (
                <li key={line} className="flex gap-3 text-[0.975rem] leading-[1.5] text-star/90">
                  <Check className="mt-0.5 size-4 shrink-0 text-dawn" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-auto pt-8 text-sm text-haze">Early access readers get first look and a founding price.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

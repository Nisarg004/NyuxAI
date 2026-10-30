"use client";

import { useEffect, useState } from "react";
import { track } from "@vercel/analytics";
import Link from "next/link";
import { SECTORS } from "@/lib/sectors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLandingBrief } from "@/lib/hooks/use-landing-brief";
import { PipelineProgress } from "@/components/pipeline-progress";
import { BriefResult } from "@/components/landing/brief-result";
import { EmailCapture } from "@/components/landing/email-capture";

const MAX_SECTORS = 3;

export function BriefGenerator() {
  const { status, brief, error, rateLimit, summary, start } = useLandingBrief();
  const [selected, setSelected] = useState<string[]>([]);
  const [role, setRole] = useState("");

  const toggle = (sector: string) => {
    setSelected((prev) => {
      if (prev.includes(sector)) return prev.filter((s) => s !== sector);
      if (prev.length >= MAX_SECTORS) return prev;
      return [...prev, sector];
    });
  };

  const running = status === "running";

  // The demo funnel: how many visitors build a sample, and how many get one back.
  useEffect(() => {
    if (status === "done") track("demo_completed", { desks: selected.length, role: role.trim().length > 0 });
    if (status === "error") track("demo_failed", { rateLimited: Boolean(rateLimit) });
    // Only on status changes; the selections are read as they were when it finished.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const build = () => {
    track("demo_started", { desks: selected.length, role: role.trim().length > 0 });
    start({ sectors: selected, roleTitle: role });
  };
  const atCap = selected.length >= MAX_SECTORS;

  return (
    <section className="min-w-0">
      <div className="panel p-6 sm:p-8">
      <p className="text-sm font-medium text-star">Your desks</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SECTORS.map((sector) => {
          const on = selected.includes(sector);
          return (
            <button
              key={sector}
              type="button"
              onClick={() => toggle(sector)}
              disabled={running || (!on && atCap)}
              aria-pressed={on}
              className={`rounded-full border px-4 py-2 text-sm transition-colors disabled:opacity-40 ${
                on ? "border-dawn bg-dawn text-night" : "border-line text-haze hover:border-haze hover:text-star"
              }`}
            >
              {sector}
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 text-sm text-haze">
        {atCap ? "Three is the limit for a sample brief." : "Pick one to three."}
      </p>

      <label htmlFor="landing-role" className="mt-6 block text-sm font-medium text-star">
        What you do <span className="font-normal text-haze">(optional)</span>
      </label>
      <div className="mt-2 max-w-md">
        <Input
          id="landing-role"
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={running}
          placeholder="Product manager at a fintech"
        />
      </div>
      <p className="mt-2 text-sm text-haze">With a role, each story says why it matters to your job.</p>

      <Button
        onClick={build}
        disabled={running || selected.length === 0}
        size="lg"
        className="mt-7"
      >
        {running ? "Building your brief…" : "Build my brief"}
      </Button>
      </div>

      {running ? <PipelineProgress summary={summary} /> : null}

      {status === "error" && rateLimit ? (
        <p role="alert" className="mt-6 rounded-[14px] border border-line bg-night-2 p-4 text-[0.975rem] leading-[1.6] text-haze">
          You&rsquo;ve built a few sample briefs in the last hour. Try again in about {rateLimit.retryAfterMinutes}{" "}
          {rateLimit.retryAfterMinutes === 1 ? "minute" : "minutes"}, or{" "}
          <Link href="/onboarding" className="text-aurora underline underline-offset-4">
            sign up for a daily one
          </Link>
          .
        </p>
      ) : null}

      {status === "error" && !rateLimit ? (
        <div role="alert" className="mt-6 rounded-[14px] border border-alarm/40 bg-alarm/10 p-4 text-[0.975rem] leading-[1.6] text-star">
          <p>{error ?? "The brief couldn't be built just now. Try again in a moment."}</p>
          <Button
            onClick={build}
            disabled={selected.length === 0}
            variant="outline"
            className="mt-3"
          >
            Try again
          </Button>
        </div>
      ) : null}

      {status === "done" && brief ? (
        <>
          <BriefResult brief={brief} />
          <EmailCapture sectors={selected} roleTitle={role} />
        </>
      ) : null}
    </section>
  );
}

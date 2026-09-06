"use client";

import { useState } from "react";
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
  const atCap = selected.length >= MAX_SECTORS;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap gap-2">
        {SECTORS.map((sector) => {
          const on = selected.includes(sector);
          return (
            <button
              key={sector}
              type="button"
              onClick={() => toggle(sector)}
              disabled={running || (!on && atCap)}
              aria-pressed={on}
              className={`rounded-[3px] border px-3 py-1.5 text-sm transition-colors disabled:opacity-40 ${
                on ? "border-ink bg-ink text-paper" : "border-rule text-ink-soft hover:border-ink hover:text-ink"
              }`}
            >
              {sector}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-ink-soft">
        Pick one to three desks{atCap ? " — that's the limit for a sample" : ""}.
      </p>

      <div className="mt-4 max-w-md">
        <Input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={running}
          placeholder="What you do — e.g. Product manager"
          className="rounded-[3px]"
        />
      </div>

      <Button
        onClick={() => start({ sectors: selected, roleTitle: role })}
        disabled={running || selected.length === 0}
        className="mt-4 rounded-[3px] bg-ink px-5 py-2.5 text-paper hover:bg-editor"
      >
        {running ? "The desk is working…" : "Show me today's brief"}
      </Button>

      {status !== "idle" && status !== "error" ? <PipelineProgress summary={summary} /> : null}

      {status === "error" && rateLimit ? (
        <p className="mt-6 text-[1.0625rem] leading-[1.7] text-ink-soft">
          You&rsquo;ve run a few sample briefs recently. Try again in about {rateLimit.retryAfterMinutes}{" "}
          {rateLimit.retryAfterMinutes === 1 ? "minute" : "minutes"} — or{" "}
          <Link href="/onboarding" className="text-editor underline decoration-editor/40 underline-offset-4">
            set one up now
          </Link>
          .
        </p>
      ) : null}

      {status === "error" && !rateLimit ? (
        <div className="mt-6 text-[1.0625rem] leading-[1.7] text-ink-soft">
          <p>{error ?? "The desk couldn't assemble a brief just now."}</p>
          <Button
            onClick={() => start({ sectors: selected, roleTitle: role })}
            disabled={selected.length === 0}
            className="mt-3 rounded-[3px] border border-ink bg-transparent px-4 text-ink hover:bg-ink hover:text-paper"
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

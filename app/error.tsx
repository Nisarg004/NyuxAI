"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

// Any page that throws while rendering lands here instead of a blank screen.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[page error]", error.digest ?? "", error);
  }, [error]);

  return (
    <main className="horizon flex flex-1 items-center">
      <div className="mx-auto w-full max-w-xl px-6 py-24">
        <Link href="/" aria-label="Nyux home" className="text-2xl text-star">
          <Logo />
        </Link>
        <h1 className="mt-10 font-display text-[clamp(2rem,5vw,3.25rem)] font-bold leading-[1] tracking-[-0.035em] text-star">
          This page didn&rsquo;t load.
        </h1>
        <p className="mt-4 text-[1.0625rem] leading-[1.65] text-haze">
          Something went wrong on our side, not yours. Try again, and if it keeps happening, come back in a few
          minutes.
          {error.digest ? <span className="mt-2 block text-sm text-haze/70">Reference: {error.digest}</span> : null}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" onClick={() => retry()}>
            Try again
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/">Back to the front page</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

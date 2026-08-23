import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-ink px-6 py-20 text-paper">
      <p className="font-mono text-xs uppercase tracking-widest text-amber">Brieff</p>
      <h1 className="mt-4 max-w-2xl text-center font-display text-4xl leading-tight sm:text-5xl">
        A briefing timed to when you actually read.
      </h1>
      <p className="mt-4 max-w-lg text-center text-paper/70">
        Four agents curate, research, write, and edit a sourced brief in your sectors, delivered at your local time
        every day. Thumbs up or down and it learns.
      </p>
      <div className="mt-8 w-full max-w-md rounded-md border border-paper/15 bg-paper/5 p-5 font-mono text-sm">
        <p className="text-amber">FINANCE · TECHNOLOGY — 20:00 IST — NEXT BRIEF IN 03:41:12</p>
        <p className="mt-3 text-paper/80">
          <span className="text-paper">RBI holds repo rate at 6.5%</span>
          <br />
          <span className="text-paper/60">Why it matters: unchanged EMI outlook for the quarter.</span>
        </p>
      </div>
      <Link href="/onboarding">
        <Button className="mt-8 bg-amber text-ink hover:bg-amber/90">Get your first brief</Button>
      </Link>
    </main>
  );
}

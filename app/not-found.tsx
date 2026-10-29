import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="horizon flex-1">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/" aria-label="Nyux home" className="inline-flex text-xl text-star">
          <Logo />
        </Link>
        <h1 className="mt-16 max-w-[16ch] font-display text-[clamp(2.5rem,7vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.035em] text-star">
          This page isn&rsquo;t in today&rsquo;s brief
        </h1>
        <p className="mt-5 max-w-[50ch] text-[1.0625rem] leading-relaxed text-haze">
          The link may be old or mistyped. Start again from the front page.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/">Back to the front page</Link>
        </Button>
      </div>
    </main>
  );
}

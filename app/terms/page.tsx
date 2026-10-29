import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, POSTAL_ADDRESS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms — Brieff",
};

const h2 = "mt-10 font-display text-2xl font-semibold tracking-[-0.01em] text-ink";
const p = "mt-3 leading-relaxed text-ink";
const ul = "mt-3 list-disc space-y-1.5 pl-5 leading-relaxed text-ink";

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="font-display text-4xl font-semibold leading-none tracking-[-0.02em] text-ink">Terms</h1>
      <p className="mt-3 font-display text-lg italic text-ink-soft">Last updated: 30 October 2026</p>

      <p className={`${p} mt-8`}>
        These are the terms for using Brieff. We&rsquo;ve tried to keep them short and plain. By using Brieff you
        agree to them.
      </p>

      <h2 className={h2}>What Brieff is</h2>
      <p className={p}>
        Brieff reads news from public sources and sends you a short daily brief on the topics you choose, by email
        and in the app. The summaries are written by AI models and checked by an automated editor before they reach
        you.
      </p>

      <h2 className={h2}>AI summaries can be wrong</h2>
      <p className={p}>
        AI-generated summaries can contain mistakes, leave out context, or misread a story. Always check the linked
        source before you rely on anything in your brief. Brieff is a news digest, not financial, legal or
        investment advice, and nothing in it should be treated as such.
      </p>

      <h2 className={h2}>The news belongs to its publishers</h2>
      <p className={p}>
        The articles we summarise belong to their original publishers. Every item in your brief links to its source,
        and we encourage you to read the full story there.
      </p>

      <h2 className={h2}>Acceptable use</h2>
      <p className={p}>Please use Brieff the way it&rsquo;s meant to be used. In particular, don&rsquo;t:</p>
      <ul className={ul}>
        <li>abuse, overload or try to break the service, or get around its limits;</li>
        <li>scrape or bulk-download content from Brieff;</li>
        <li>sign up automatically, or sign up other people without their permission.</li>
      </ul>
      <p className={p}>We may suspend accounts that do any of these.</p>

      <h2 className={h2}>Price</h2>
      <p className={p}>
        Brieff is free today. We may introduce paid plans later. If we do, we&rsquo;ll tell you before anything is
        charged, and nothing will be billed without your explicit agreement.
      </p>

      <h2 className={h2}>Changes to the service</h2>
      <p className={p}>
        Brieff is an early-stage product. We may change, pause or stop all or part of the service at any time. If we
        stop it for good, we&rsquo;ll try to let you know by email first.
      </p>

      <h2 className={h2}>No warranty</h2>
      <p className={p}>
        We provide Brieff as it is, without any promise that it will always be available, error-free or accurate. To
        the extent the law allows, we aren&rsquo;t liable for any loss that comes from using Brieff or relying on its
        summaries. Nothing here limits rights you have under law that can&rsquo;t be limited.
      </p>

      <h2 className={h2}>Changes to these terms</h2>
      <p className={p}>
        We may update these terms as Brieff grows. When we make a meaningful change, we&rsquo;ll update the date at
        the top of this page and, where it matters, tell you by email. If you keep using Brieff after a change, the
        new terms apply. You can stop at any time by unsubscribing or deleting your account. See also our{" "}
        <Link href="/privacy" className="underline hover:text-editor">
          Privacy policy
        </Link>
        .
      </p>

      <h2 className={h2}>Contact</h2>
      <p className={p}>
        {CONTACT_EMAIL ? (
          <>
            Questions about these terms? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-editor">
              {CONTACT_EMAIL}
            </a>
            .
          </>
        ) : (
          <>Questions about these terms? Reply to any Brieff email and it will reach us.</>
        )}
      </p>
      {POSTAL_ADDRESS ? <p className="mt-2 text-sm text-ink-soft">{POSTAL_ADDRESS}</p> : null}
    </main>
  );
}

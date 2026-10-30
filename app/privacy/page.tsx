import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { CONTACT_EMAIL, POSTAL_ADDRESS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy policy: Nyux",
};

const h2 =
  "mt-12 font-display text-2xl font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[1.75rem]";
const p = "mt-4 text-[1.0625rem] leading-[1.65] text-ink";
const ul =
  "mt-4 list-disc space-y-2 pl-5 text-[1.0625rem] leading-[1.65] text-ink marker:text-ink-soft";
const a =
  "underline decoration-ink-soft/50 underline-offset-4 hover:decoration-ink";

export default function PrivacyPage() {
  return (
    <main className="horizon flex-1">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href="/"
          aria-label="Nyux home"
          className="inline-flex text-xl text-star"
        >
          <Logo />
        </Link>

        <article className="sheet mt-8 px-6 py-10 sm:px-12 sm:py-14">
          <div className="max-w-[68ch]">
            <h1 className="font-display text-[clamp(2.25rem,6vw,3.25rem)] font-bold leading-[0.95] tracking-[-0.035em] text-ink">
              Privacy
            </h1>
            <p className="mt-4 text-ink-soft">Last updated: 30 October 2026</p>

            <p className={`${p} mt-8`}>
              Nyux is a small, early-stage product that sends you a daily news
              brief. This page explains, in plain language, what we collect,
              why, who helps us run the service, and what you can do about it.
            </p>

            <h2 className={h2}>What we collect</h2>
            <ul className={ul}>
              <li>Your email address and name.</li>
              <li>
                Your role or job title, if you choose to give one, and any
                keywords you add.
              </li>
              <li>
                The sectors you pick, your delivery time and your timezone.
              </li>
              <li>
                Your feedback on brief items: thumbs up, thumbs down and saves.
              </li>
              <li>
                A sign-in session cookie, so you stay signed in. We use no
                advertising or tracking cookies.
              </li>
              <li>
                Anonymous visit counts (pages viewed, and whether a sample
                brief or sign-up was started), through Vercel Web Analytics.
                It sets no cookies and doesn&rsquo;t identify you.
              </li>
              <li>
                Hashed IP addresses, used only to rate-limit sign-in links and
                the free sample brief. We don&rsquo;t store your raw IP address.
              </li>
              <li>
                Email delivery status from our email provider, such as bounces
                and spam complaints.
              </li>
            </ul>

            <h2 className={h2}>Why we collect it</h2>
            <ul className={ul}>
              <li>
                To build your brief and send it to you at the time you chose.
              </li>
              <li>
                To sign you in with one-time email links, without a password.
              </li>
              <li>
                To prevent abuse, and to stop emailing addresses that bounce or
                report us as spam.
              </li>
            </ul>
            <p className={p}>
              Your feedback is summarised into a short description of what you
              like and avoid, which shapes which stories are picked for you next
              time.
            </p>

            <h2 className={h2}>Who helps us run Nyux</h2>
            <p className={p}>
              We use a few service providers. Each one only gets what it needs
              to do its job:
            </p>
            <ul className={ul}>
              <li>
                <strong>OpenAI</strong> generates and personalises the summaries
                in your brief. To do that we send it news articles plus your
                role title, keywords and the feedback summary described above.
                We don&rsquo;t send it your email address.
              </li>
              <li>
                <strong>Resend</strong> sends our emails, so it receives your
                email address and the content of each email.
              </li>
              <li>
                <strong>Supabase</strong> hosts our database, where your account
                and preferences are stored.
              </li>
              <li>
                <strong>Vercel</strong> hosts the website and the servers that
                run Nyux.
              </li>
              <li>
                <strong>Jina Reader</strong> fetches the text of public news
                articles so we can summarise them. It never receives any
                information about you.
              </li>
            </ul>

            <h2 className={h2}>What we don&rsquo;t do</h2>
            <p className={p}>
              We don&rsquo;t sell your data, we don&rsquo;t share it with
              advertisers, and there are no ads in Nyux.
            </p>

            <h2 className={h2}>How long we keep it</h2>
            <p className={p}>
              We keep your account data until you delete your account, which you
              can do at any time from your{" "}
              <Link href="/dashboard" className={a}>
                dashboard
              </Link>
              . News articles we&rsquo;ve collected are deleted after 14 days,
              and expired sign-in links and sessions are removed automatically.
            </p>

            <h2 className={h2}>Your rights</h2>
            <ul className={ul}>
              <li>You can ask for a copy of the data we hold about you.</li>
              <li>
                You can correct your details and preferences from your
                dashboard, or ask us to.
              </li>
              <li>
                You can delete your account and its data from your dashboard, or
                ask us to.
              </li>
              <li>
                You can unsubscribe at any time using the link at the bottom of
                every Nyux email.
              </li>
            </ul>

            <h2 className={h2}>Contact</h2>
            <p className={p}>
              {CONTACT_EMAIL ? (
                <>
                  Questions or requests about your data? Email{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`} className={a}>
                    {CONTACT_EMAIL}
                  </a>
                  .
                </>
              ) : (
                <>
                  Questions or requests about your data? Reply to any Nyux email
                  and it will reach us.
                </>
              )}
            </p>
            {POSTAL_ADDRESS ? (
              <p className="mt-2 text-sm text-ink-soft">{POSTAL_ADDRESS}</p>
            ) : null}
          </div>
        </article>
      </div>
    </main>
  );
}

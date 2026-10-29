import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, POSTAL_ADDRESS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy — Brieff",
};

const h2 = "mt-10 font-display text-2xl font-semibold tracking-[-0.01em] text-ink";
const p = "mt-3 leading-relaxed text-ink";
const ul = "mt-3 list-disc space-y-1.5 pl-5 leading-relaxed text-ink";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="font-display text-4xl font-semibold leading-none tracking-[-0.02em] text-ink">Privacy</h1>
      <p className="mt-3 font-display text-lg italic text-ink-soft">Last updated: 30 October 2026</p>

      <p className={`${p} mt-8`}>
        Brieff is a small, early-stage product that sends you a daily news brief. This page explains, in plain
        language, what we collect, why, who helps us run the service, and what you can do about it.
      </p>

      <h2 className={h2}>What we collect</h2>
      <ul className={ul}>
        <li>Your email address and name.</li>
        <li>Your role or job title, if you choose to give one, and any keywords you add.</li>
        <li>The sectors you pick, your delivery time and your timezone.</li>
        <li>Your feedback on brief items: thumbs up, thumbs down and saves.</li>
        <li>A sign-in session cookie, so you stay signed in. We use no advertising or tracking cookies.</li>
        <li>
          Hashed IP addresses, used only to rate-limit sign-in links and the free sample brief. We don&rsquo;t store
          your raw IP address.
        </li>
        <li>Email delivery status from our email provider, such as bounces and spam complaints.</li>
      </ul>

      <h2 className={h2}>Why we collect it</h2>
      <ul className={ul}>
        <li>To build your brief and send it to you at the time you chose.</li>
        <li>To sign you in with one-time email links, without a password.</li>
        <li>To prevent abuse, and to stop emailing addresses that bounce or report us as spam.</li>
      </ul>
      <p className={p}>
        Your feedback is summarised into a short description of what you like and avoid, which shapes which stories
        are picked for you next time.
      </p>

      <h2 className={h2}>Who helps us run Brieff</h2>
      <p className={p}>We use a few service providers. Each one only gets what it needs to do its job:</p>
      <ul className={ul}>
        <li>
          <strong>OpenAI</strong> generates and personalises the summaries in your brief. To do that we send it news
          articles plus your role title, keywords and the feedback summary described above. We don&rsquo;t send it
          your email address.
        </li>
        <li>
          <strong>Resend</strong> sends our emails, so it receives your email address and the content of each email.
        </li>
        <li>
          <strong>Supabase</strong> hosts our database, where your account and preferences are stored.
        </li>
        <li>
          <strong>Vercel</strong> hosts the website and the servers that run Brieff.
        </li>
        <li>
          <strong>Jina Reader</strong> fetches the text of public news articles so we can summarise them. It never
          receives any information about you.
        </li>
      </ul>

      <h2 className={h2}>What we don&rsquo;t do</h2>
      <p className={p}>
        We don&rsquo;t sell your data, we don&rsquo;t share it with advertisers, and there are no ads in Brieff.
      </p>

      <h2 className={h2}>How long we keep it</h2>
      <p className={p}>
        We keep your account data until you delete your account, which you can do at any time from your{" "}
        <Link href="/dashboard" className="underline hover:text-editor">
          dashboard
        </Link>
        . News articles we&rsquo;ve collected are deleted after 14 days, and expired sign-in links and sessions are removed automatically.
      </p>

      <h2 className={h2}>Your rights</h2>
      <ul className={ul}>
        <li>You can ask for a copy of the data we hold about you.</li>
        <li>You can correct your details and preferences from your dashboard, or ask us to.</li>
        <li>You can delete your account and its data from your dashboard, or ask us to.</li>
        <li>You can unsubscribe at any time using the link at the bottom of every Brieff email.</li>
      </ul>

      <h2 className={h2}>Contact</h2>
      <p className={p}>
        {CONTACT_EMAIL ? (
          <>
            Questions or requests about your data? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-editor">
              {CONTACT_EMAIL}
            </a>
            .
          </>
        ) : (
          <>Questions or requests about your data? Reply to any Brieff email and it will reach us.</>
        )}
      </p>
      {POSTAL_ADDRESS ? <p className="mt-2 text-sm text-ink-soft">{POSTAL_ADDRESS}</p> : null}
    </main>
  );
}

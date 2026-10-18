# Brieff

Brieff sends each user a personalised news briefing — in their chosen sectors, at their
chosen local time — by email and in an in-app archive. A four-agent pipeline (**Curator →
Researcher → Writer → Editor**) builds the brief; each stage is individually observable in
the `/runs` log, and a thumbs up/down feedback loop reshapes what the Curator selects on
future runs.

Stack: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui, Postgres via Drizzle
ORM (hosted on Supabase), the OpenAI SDK for the agents, `resend` + `@react-email/components`
for email, `rss-parser` for ingestion, `luxon` for all timezone math.

> The scheduler (Phase 6) is built: `POST /api/cron/dispatch` reads each user's
> `next_run_at` and sends their brief when it's due. `.github/workflows/dispatch.yml` polls
> it every 15 minutes; `npm run watch` polls it every 60s for demos. Ingestion still runs
> by hand — see below. Everything can also still be triggered manually.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values below
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Supabase pooler URL works) |
| `OPENAI_API_KEY` | OpenAI API key, used by `lib/llm.ts` |
| `MODEL_WRITER` | Model id for the Writer agent |
| `MODEL_FAST` | Model id for the Curator, Editor, editor's-note, and feedback-profile calls |
| `JINA_API_KEY` | Optional. Sent as a bearer token to `r.jina.ai` for full-text fetches; the Researcher works without it, just at a lower rate limit |
| `RESEND_API_KEY` | Resend API key, used to send digest emails |
| `RESEND_WEBHOOK_SECRET` | Signing secret (`whsec_…`) of the Resend webhook pointed at `/api/webhooks/resend`. The route returns 503 until set. Subscribe it to `email.bounced` and `email.complained` |
| `CRON_SECRET` | Bearer token for the write routes (`/api/ingest`, `/api/digest/*`, `/api/feedback`) and the cron dispatcher (`/api/cron/dispatch`). Also the HMAC key (derived) for signed email links, so rotating it invalidates unsubscribe links already sent. Fails closed if unset |
| `NEXT_PUBLIC_APP_URL` | Base URL used to build links inside sent emails (e.g. `http://localhost:3000`) |

Both `MODEL_WRITER` and `MODEL_FAST` are required at import time — `lib/agents/models.ts`
throws if either is unset, so the app won't start the pipeline without them.

## Database: seed and migrate

```bash
npm run db:generate   # regenerate Drizzle migrations from lib/db/schema.ts
npm run db:migrate     # apply migrations to DATABASE_URL
npm run db:seed        # replace all rows in `sources` with the seeded RSS feeds
npm run db:studio      # optional: browse the DB in Drizzle Studio
```

`db:seed` (`lib/db/seed.ts`) deletes and re-inserts every row in `sources` from
`lib/db/candidate-sources.ts` — it seeds sources only, not users. Users are created by
completing onboarding in the app.

## Running the app

```bash
npm run dev
```

Open `http://localhost:3000`. There's no auth: onboarding at `/onboarding` collects an
email, name, role, sectors, and delivery time, and stores the user id in a cookie
(`brieff_uid`). Re-entering an email you've already onboarded with logs you back in as
that user instead of creating a duplicate (see `app/onboarding/actions.ts`).

## Triggering each phase manually

Ingestion runs by hand; digest send can run by hand or via the scheduler (see
"Scheduling" below).

**A note on auth:** `/api/ingest`, `/api/digest/generate`, `/api/digest/send-now/run`, and
`/api/feedback` all require `Authorization: Bearer $CRON_SECRET` — they refuse to do
anything without it, which is what makes it safe to expose this app on a public URL with
no other auth in front of it. The commands below need that header. The app's own UI never
sends it from the browser: `/api/digest/send-now` (what the dashboard's Send Now button
calls) and `app/archive/actions.ts`'s `submitFeedback` (what the feedback buttons call)
resolve the session server-side and attach the secret on a server-to-server call — see
`lib/internal-api.ts`.

**1. Ingestion** — fetch all active RSS sources and store new articles:

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer $CRON_SECRET"
```

Returns `{ fetched, inserted, skipped, failedFeeds, disabledSources }` and writes a `runs`
row of kind `ingest`. A source is disabled automatically after 3 consecutive feed
failures.

**2. Dry-run digest** — run the full Curator → Researcher → Writer → Editor pipeline for
one user without persisting or sending anything:

```bash
npm run digest:test <userId>
```

`scripts/digest-test.ts` calls `generateDigest` directly (no HTTP, no auth needed) — it
prints the user's current `feedback_profile`, runs `generateDigest(userId, { dryRun: true
})`, then prints the editor's note, the approved items grouped by sector (headline,
summary, why-it-matters, source URL), and any items the Editor rejected with its stated
reason. Find a `userId` via `npm run db:studio` or the `users` table.

You can also hit the underlying route directly:

```bash
curl -X POST http://localhost:3000/api/digest/generate \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<uuid>","dryRun":true}'
```

**3. Send now** — generate a digest for the *logged-in* user (via the `brieff_uid`
cookie) and email it immediately:

- In the UI: dashboard → **Send now** button, which streams live per-stage progress
  (curator, researcher, writer, editor, email) over SSE.
- `POST /api/digest/send-now` (session-cookie-gated, what the button calls) resolves the
  cookie to a `userId` and re-issues the request to `POST /api/digest/send-now/run` with
  the secret attached, piping the SSE stream straight back — see
  `app/api/digest/send-now/route.ts`. To trigger a send without the UI, hit `/run`
  directly with the secret and an explicit `userId`:

```bash
curl -N -X POST http://localhost:3000/api/digest/send-now/run \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<uuid>"}'
```

This persists the digest and its items, sends the email via Resend, and sets `sent_at`.

**4. Feedback** — thumbs up/down/save on a digest item, from the archive UI
(`/archive/[id]`, which calls the `submitFeedback` Server Action in
`app/archive/actions.ts`) or directly against the underlying route:

```bash
curl -X POST http://localhost:3000/api/feedback \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<uuid>","digestItemId":"<uuid>","signal":"down"}'
```

Every 3rd signal since the last profile update triggers a regeneration of the user's
`feedback_profile` (`lib/agents/feedback-profile.ts`), which is then injected verbatim into
the Curator's prompt on the next run.

**5. Pipeline logs** — visit `/runs` for a table of every `runs` row (ingest and digest
runs alike); expand a row to see the full `stage_log`, including the Curator's per-article
`reason` and the Editor's rejections with their reasons.

## Scheduling

`POST /api/cron/dispatch` (bearer `$CRON_SECRET`) finds every active user whose
`next_run_at` has passed, sends their brief via `/api/digest/send-now/run`, and rolls
`next_run_at` forward one day with `computeNextRunAt` (`lib/schedule.ts`, unit-tested in
`lib/schedule.test.ts`). Each user's slot is claimed with an atomic conditional `UPDATE`,
and the `digests (user_id, scheduled_for)` unique index is the backstop, so overlapping
dispatches never double-send (`lib/cron/dispatch.test.ts` proves the race). The JSON
response reports `due`, per-user results, and `durationMs`.

**Production** — `.github/workflows/dispatch.yml` runs every 15 minutes (and on
`workflow_dispatch`). Add two repo secrets under **Settings → Secrets and variables →
Actions**:

| Secret | Value |
| --- | --- |
| `DISPATCH_URL` | The deployed base URL, no trailing slash — e.g. `https://brieff-nine.vercel.app` |
| `CRON_SECRET` | The exact same value as the `CRON_SECRET` env var in the deployment |

**Demos** — GitHub's cron can lag 5–15 minutes. For a tight loop, run the poller locally:

```bash
npm run watch                                    # polls http://localhost:3000 every 60s
BASE_URL=https://brieff-nine.vercel.app npm run watch
```

It prints `0 due` or `sending for <email>` each tick. Needs `CRON_SECRET` in `.env.local`.

## Tests

```bash
npm test   # node --test over lib/**/*.test.ts (schedule math + the dispatch claim race)
```

## What's not built

Everything from CC.md's phases 1–7 is built.

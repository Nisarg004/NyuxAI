# Brieff

Brieff sends each user a personalised news briefing — in their chosen sectors, at their
chosen local time — by email and in an in-app archive. A four-agent pipeline (**Curator →
Researcher → Writer → Editor**) builds the brief; each stage is individually observable in
the `/runs` log, and a thumbs up/down feedback loop reshapes what the Curator selects on
future runs.

Stack: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui, Postgres via Drizzle
ORM (hosted on Supabase), the OpenAI SDK for the agents, `resend` + `@react-email/components`
for email, `rss-parser` for ingestion, `luxon` for all timezone math.

> Phase 6 (cron scheduler / GitHub Actions deploy) was intentionally skipped — there is no
> live cron and nothing is deployed. Every phase below is triggered manually.

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
| `CRON_SECRET` | Reserved for the (unbuilt) cron dispatch route — not currently read anywhere |
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

Since there's no live cron (Phase 6 was skipped), every stage is triggered by hand:

**1. Ingestion** — fetch all active RSS sources and store new articles:

```bash
curl -X POST http://localhost:3000/api/ingest
```

Returns `{ fetched, inserted, skipped, failedFeeds, disabledSources }` and writes a `runs`
row of kind `ingest`. A source is disabled automatically after 3 consecutive feed
failures.

**2. Dry-run digest** — run the full Curator → Researcher → Writer → Editor pipeline for
one user without persisting or sending anything:

```bash
npm run digest:test <userId>
```

`scripts/digest-test.ts` prints the user's current `feedback_profile`, runs
`generateDigest(userId, { dryRun: true })`, then prints the editor's note, the approved
items grouped by sector (headline, summary, why-it-matters, source URL), and any items the
Editor rejected with its stated reason. Find a `userId` via `npm run db:studio` or the
`users` table.

You can also hit the underlying route directly:

```bash
curl -X POST http://localhost:3000/api/digest/generate \
  -H "Content-Type: application/json" \
  -d '{"userId":"<uuid>","dryRun":true}'
```

**3. Send now** — generate a digest for the *logged-in* user (via the `brieff_uid`
cookie) and email it immediately:

- In the UI: dashboard → **Send now** button, which streams live per-stage progress
  (curator, researcher, writer, editor, email) over SSE.
- Or directly: `curl -N -X POST http://localhost:3000/api/digest/send-now -b "brieff_uid=<uuid>"`

This persists the digest and its items, sends the email via Resend, and sets `sent_at`.

**4. Feedback** — thumbs up/down/save on a digest item, from the archive UI
(`/archive/[id]`) or directly:

```bash
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -b "brieff_uid=<uuid>" \
  -d '{"digestItemId":"<uuid>","signal":"down"}'
```

Every 3rd signal since the last profile update triggers a regeneration of the user's
`feedback_profile` (`lib/agents/feedback-profile.ts`), which is then injected verbatim into
the Curator's prompt on the next run.

**5. Pipeline logs** — visit `/runs` for a table of every `runs` row (ingest and digest
runs alike); expand a row to see the full `stage_log`, including the Curator's per-article
`reason` and the Editor's rejections with their reasons.

## What's not built

Phase 6 (`POST /api/cron/dispatch`, the GitHub Actions dispatch workflow, and
`computeNextRunAt` wired into an actual scheduler loop) was intentionally skipped per
product decision — this is a manually-triggered demo app, not a deployed one.
`lib/schedule.ts` still exposes `computeNextRunAt` and is used to set `next_run_at` at
onboarding and preference updates, but nothing currently reads `next_run_at` to fire a
send.

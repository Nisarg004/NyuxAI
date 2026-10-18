@AGENTS.md

# Brieff — project reference for Claude Code

Brieff is a personalized-news-briefing app: a four-agent pipeline (Curator → Researcher →
Writer → Editor, with Writer/Editor results shared across users per article) builds a sourced daily brief per user, sent by email and readable in-app,
with a thumbs up/down feedback loop that reshapes future curation. Full original build
spec (phases 1–7): `files/CC.md`. Phases 1–7 are built. Phase 6 (cron scheduler) was
skipped for a long time and then added: `POST /api/cron/dispatch` reads `next_run_at`,
enqueues a generate job per due user and rolls the slot forward (workers do the work);
`.github/workflows/dispatch.yml` polls it every 15 min and `npm run watch` polls it every
60s for demos. See "The job queue and cron dispatcher" below. The current UI is a warm-newsprint/ink/oxblood editorial design (Fraunces +
Hanken Grotesk, no monospace, "desk"/"edition" language) — this superseded an earlier
dark-mode/amber direction described in CC.md's Phase 5 section; treat that section as
historical.

## Commands

```bash
npm run dev              # start the app (http://localhost:3000)
npm run build            # production build
npm run lint             # eslint
npm test                 # node --test over lib/**/*.test.ts (needs DATABASE_URL — see below)
node --import tsx --test lib/cron/dispatch.test.ts   # run a single test file

npm run db:generate      # regenerate Drizzle migrations from lib/db/schema.ts
npm run db:migrate       # apply migrations to DATABASE_URL
npm run db:seed          # replace all `sources` rows from lib/db/candidate-sources.ts
npm run db:studio        # browse the DB

npm run digest:test <userId>   # run the full pipeline for one user, dry-run, no auth needed
npm run watch             # poll /api/cron/dispatch every 60s against BASE_URL (demo mode)
```

`MODEL_WRITER` and `MODEL_FAST` env vars are required at import time (`lib/agents/models.ts`
throws if either is unset). `lib/cron/dispatch.test.ts` needs a reachable `DATABASE_URL` —
it fails with a Postgres connection error, not a logic error, if the DB isn't reachable
(e.g. no local Postgres, or a stale/pooler-only connection string).

## Database schema (`lib/db/schema.ts`)

All timestamps are `timestamptz` (`{ withTimezone: true }`).

- **`users`** — `id`, `email` (unique), `name`, `role_title` (nullable), `created_at`
- **`preferences`** — `user_id` (fk, unique), `sectors` (text[]), `delivery_hour`,
  `delivery_minute`, `timezone` (default `Asia/Kolkata`), `depth`
  (`brief|standard|deep`, default `standard`), `keywords` (text[]), `feedback_profile`
  (nullable text), `feedback_profile_updated_at`, `next_run_at`, `is_active`
- **`sources`** — `id`, `sector`, `name`, `rss_url`, `weight` (default 1), `is_active`,
  `consecutive_failures` (int, default 0) — not in the original CC.md schema; added so
  ingestion can auto-disable a source after repeated failures (see below)
- **`articles`** — `id`, `source_id` (fk), `sector`, `title`, `url`, `author`,
  `published_at`, `excerpt`, `content_hash` (unique), `fetched_at`, plus `full_text` and
  `full_text_fetched_at` (also not in CC.md's original schema — the Researcher's cache of
  `r.jina.ai` output lives in the `articles` row itself, not just in-memory, so repeat runs
  over the same article never re-fetch), `embedding` (`real[]`) and `story_id` (fk, set null)
- **`stories`** — `id`, `sector`, `canonical_article_id`, `article_count`, `first_seen`,
  `last_updated`: a cross-outlet cluster of articles about one event (see "Story clustering")
- **`article_briefs`** — one shared, Editor-verified brief per article (`headline`, `summary`,
  `why_it_matters`, `key_facts`, `verified`, `editor_notes`, `research_depth`, `model`)
- **`jobs`** — the generate/send work queue (see "The job queue and cron dispatcher")
- **`digests`** — `id`, `user_id` (fk), `scheduled_for`, `sent_at`, `status`
  (`pending|generating|ready|sent|failed`), `subject`, `html`, `run_meta` (jsonb). Unique
  index on `(user_id, scheduled_for)`.
- **`digest_items`** — `id`, `digest_id` (fk, cascade), `article_id` (fk, `set null`),
  `sector`, `headline`, `summary`, `why_it_matters`, `source_url` (**NOT NULL**), `rank`
- **`feedback`** — `id`, `user_id`, `digest_item_id` (fk, cascade), `signal`
  (`up|down|save`), `created_at`
- **`runs`** — `id`, `kind`, `user_id` (nullable), `started_at`, `finished_at`, `status`,
  `stage_log` (jsonb array), `token_cost`, `error`

## The four-agent pipeline (`lib/agents/*.ts`, orchestrated by `lib/agents/pipeline.ts`)

Entry point: `generateDigest(userId, { dryRun, onStage?, scheduledFor? })` in
`lib/agents/pipeline.ts` — a thin wrapper that loads the user's preferences, calls the
persistence-free core `generateBrief(ctx, { kind, userId, ... })` (also used by the public
landing route), then inserts `digests` + `digest_items`.
`onStage` is called with each stage-log entry as it's produced, which is what powers the
SSE progress stream on `/api/digest/send-now`.

**Story clustering** (`lib/story-index.ts`, `lib/clustering.ts`; tables `stories`, `articles.embedding`
/ `articles.story_id`). After the feed loop, `runIngest` calls `indexRecentArticles`: it embeds
(`embedTexts` in `lib/llm.ts`, `text-embedding-3-small` at 256 dims, override with `MODEL_EMBEDDING`)
any article from the last 48h that has no embedding, then assigns each un-storied article to a story
or opens a new one. It works from "recent articles still missing X", so a failed run is finished by
the next; a failure is logged to the ingest `stage_log` and never fails ingestion. Similarity is
computed in app code over `real[]` columns (a 48h window is ~1.5k rows), so no pgvector. Matching
is against each story's canonical (first-seen) article, and is two-tier because embeddings alone
can't tell "same event" from "same template" (ICICI vs HDFC results score 0.83, real duplicates
0.80-0.82): `>= 0.88` merges outright; `0.76-0.88` merges only if the titles share a specific token
(a 3+ digit number or a distinctive capitalised name, `specificTokens`). Merging distinct events
is worse than leaving a near-duplicate, so it errs towards separate stories. Retention nulls
embeddings and deletes stories older than 14 days.

**Candidates** (`lib/agents/candidates.ts`). `selectCandidates` builds the Curator's pool from the
last 24h: one representative per story (fullest excerpt) with `outlets` (distinct sources), then the
best 16 per sector, ranked by embedding similarity to the reader (`profileQuery`: role, keywords,
feedback profile; one ~10-token embedding call) or, with no profile, by outlet count then recency.
Un-embedded articles rank last rather than vanish. Replaces the old "newest 150 total".

**Curator** (`lib/agents/curator.ts`, `MODEL_FAST`). Input: `roleTitle`, `keywords`,
`feedbackProfile`, `sectors`, and the pool above, each `{ id, title, excerpt (240 chars), sector,
source, covered_by, publishedAt }`. Output (`curatorOutputSchema`): `{ selected: [{ article_id, sector,
score (0-100), reason }] }`. Returns the top `perSector` per sector (the pipeline over-selects, see
below); `reason` is one short clause, surfaced in `/runs`. Measured on the dev DB: Curator input
fell from ~25.9k to ~2.4k tokens (a warm role-tuned digest: ~30k -> ~10.5k total).

**Researcher** (`lib/agents/researcher.ts`, no LLM). For each selected article: check
`articles.full_text` in the DB first; if cached, reuse it (`depth: "deep"`) with no
network call. Otherwise fetch `https://r.jina.ai/<encoded url>` (8s timeout via
`AbortSignal.timeout`, truncated to 4000 chars, bearer `JINA_API_KEY` if set), persist the
result back onto the `articles` row, and use it (`depth: "deep"`). On fetch failure, fall
back to the RSS excerpt (`depth: "shallow"`). Runs with concurrency 10 (`lib/concurrency.ts`
— bumped from the spec's 5 after a dry run showed 5-wide concurrency forcing two sequential
8s-timeout waves on a typical 10-article selection).

**Shared article briefs** (`lib/agents/article-brief.ts`, table `article_briefs`) replace the
per-user Writer and Editor. `ensureBriefs` takes the Curator's selection and, for each article
without a brief, researches it (Researcher above), then runs a *neutral* Writer (`MODEL_WRITER`,
batched 6 articles per call: `headline` ≤12 words, `summary`, general-reader `why_it_matters`
(nullable), 3-5 literal `key_facts`) and an Editor (`MODEL_FAST`) that verifies every claim in
summary / why_it_matters / key_facts against the source text and rejects null consequences.
Results are persisted once and reused by every later user whose Curator picks that article; a
fully cached batch makes no network or LLM calls. Verified briefs are always stored; Editor
rejections are stored (`verified=false`, `editor_notes`) only after *deep* research, so a thin
RSS-excerpt rejection (maybe a failed Jina fetch) is retried later. Built on demand rather than
as a post-ingest job, so nothing is spent on the ~600 daily articles no Curator selects. It logs
per-sector `writer`/`editor` stage events (`cached: true` when served from cache) in the shape the
progress UI and `/runs` already read. `writer.ts` now only holds `runCrossSectorNote`
(`MODEL_FAST`, the real cross-sector `editors_note`, run once all items are known).

**Personalizer** (`lib/agents/personalizer.ts`, `MODEL_FAST`). Only for readers with a
`role_title`: one batched call per digest writes a role-specific `why_it_matters` per item from
the shared `summary` + `key_facts`, and a second call has an Editor verify each line against
those facts. Approved lines replace the neutral one; rejected or failed ones fall back to it.
`depth` is applied when assembling items (`lib/agents/depth.ts`: `brief` keeps the lead
sentence; `deep` reads as standard).

**Backfill instead of retry**: the Curator over-selects (`perSector` + 2, max 7) and the top
verified briefs per sector fill the digest, so a rejected item is replaced by the next-best pick.
Measured on the dev DB: cold run 47k tokens, warm run 30k (86% of it the Curator) vs a flat 38k
before; the Curator is what Phase 2.3/2.4 attack next.

**Ranking & persistence**: verified briefs are ranked within each sector by the Curator's
score (highest first); an item whose `article_id` doesn't resolve to a known
`source_url` after the round trip is dropped and logged as a rejection (never ships without
a `source_url` — rule 2 below). With `dryRun: false`, approved items are inserted into
`digests` + `digest_items`; with `dryRun: true`, nothing is persisted and the result is
returned as JSON (this is what `npm run digest:test` and `POST /api/digest/generate` with
`dryRun: true` use).

**Feedback loop** (`lib/agents/feedback-profile.ts`). `POST /api/feedback` records a
signal, then counts signals since `feedback_profile_updated_at`; at ≥3, calls
`regenerateFeedbackProfile` (`MODEL_FAST`) over the user's last 30 signals (`{ signal,
sector, headline }`), producing `feedback_profile` as literal `"Prefers: … Avoids: …"` text
(`feedbackProfileOutputSchema`). That string is injected verbatim into the Curator's `user`
prompt on the next run.

## Auth model for the API routes (`lib/internal-api.ts`)

**User sign-in** is passwordless email links (`lib/auth/magic-link.ts`, `lib/session.ts`). Onboarding
and `/signin` both mail a one-time link (`/auth/verify?token=`, 30 min, max 5/hour/email); the
page only renders a confirm button and the POST spends the token, so mail scanners that
prefetch the URL can't burn it. `sessions` / `auth_tokens` store only SHA-256 hashes; the
`brieff_session` cookie holds the raw random token (30 days). Submitting onboarding for an
already-verified email never changes that account — it just sends the owner a link. The
dispatcher skips users with `email_verified_at` null. `users.role = 'admin'` gates `/runs`
(`requireAdmin`); the migration promoted the earliest-created user. Without `RESEND_API_KEY`
the link is printed to the server log (local dev/testing).

The four routes that trigger
real work — `/api/ingest`, `/api/digest/generate`, `/api/digest/send-now/run`, and
`/api/feedback` — all require `Authorization: Bearer ${CRON_SECRET}` and refuse to do
anything without it (`isAuthorizedCronCaller`, fails closed if `CRON_SECRET` itself is
unset). This is what makes it safe to run this app on a public URL with no other auth in
front of it.

**One deliberate exception:** `POST /api/landing/brief` runs the pipeline
(`generateBrief`, `kind: "landing"`) for an anonymous visitor on the public
landing page and is **not** gated by `isAuthorizedCronCaller` — a stranger has
no session and no secret. Abuse is bounded instead by `lib/rate-limit.ts`
(`checkAndRecordLandingRun`: 5 runs/hour/IP, IP hashed with `CRON_SECRET` as
salt) plus hard caps in the route: ≤3 sectors, ≤3 items/sector, ≤45 candidate
headlines to the Curator, role text truncated to 120 chars. It persists
nothing except a `runs` row (`kind: "landing"`, `user_id` null) and a
`landing_runs` row. No email is sent. This is the only unauthenticated route
that triggers an LLM call.

The app's own UI never sends the secret header from the browser:

- **Send now**: the browser calls `/api/digest/send-now` (session-gated, unchanged
  contract). That route resolves `getSessionUserId()`, then re-issues the request to
  `/api/digest/send-now/run` with the secret attached, piping the SSE response straight
  back (`getInternalBaseUrl()` prefers Vercel's `VERCEL_URL` over `NEXT_PUBLIC_APP_URL` for
  this loopback call). `/run` is the one that actually executes the pipeline and sends
  email, and is used by the interactive Send now flow only (scheduled sends go through the job queue).
- **Feedback**: the browser calls the `submitFeedback` Server Action
  (`app/archive/actions.ts`), not `/api/feedback` directly. The action resolves the
  session, then does the same secret-attached server-to-server call.

Any new route that triggers an LLM call, a send, or a write with real cost should follow
this pattern — gate the route with `isAuthorizedCronCaller`, add a session-gated
proxy/action if the browser needs to reach it.

## Non-negotiable engineering rules (verified against current code)

1. **Every LLM call goes through one wrapper** — `lib/llm.ts` is the only file that imports
   the `openai` package (verified: `grep -rl 'from "openai"' lib app components` returns
   only `lib/llm.ts`). `callLLM` sends the request with `zodResponseFormat`-generated
   structured output, validates the parsed result against the zod schema, retries once with
   the validation/refusal error appended to the conversation, and on a second failure
   returns `{ ok: false, degraded: true, error }` — it never throws.
2. **Every `digest_item` has a non-null `source_url`.** Enforced at the schema level
   (`digestItems.sourceUrl` is `notNull()`) and at the pipeline level — an approved item
   with no resolvable source URL is dropped and logged, never persisted.
3. **Per-feed failures don't fail the batch.** `lib/ingest.ts`'s `fetchAndPersistFeed`
   wraps each feed in its own try/catch and always returns a `FeedEntry`, run across all
   sources via `runWithConcurrency`. Failures are recorded in `stage_log` and in
   `sources.consecutive_failures`; a source is auto-disabled (`is_active = false`) after 3
   consecutive failures — an addition beyond CC.md's original spec.
4. **All times stored as UTC `timestamptz`; converted only at the display boundary.** Every
   timestamp column in `lib/db/schema.ts` uses `{ withTimezone: true }`; `lib/schedule.ts`
   uses Luxon to convert local delivery time to a UTC `next_run_at`, and display components
   convert back to the user's `preferences.timezone` (e.g. `app/archive/[id]/page.tsx`,
   `lib/countdown.ts`).
5. **A `runs` row per pipeline execution with a `stage_log` jsonb array**, appended to as
   each stage starts and finishes with counts and duration. Both `generateDigest`
   (`lib/agents/pipeline.ts`, kind `digest`) and `runIngest` (`lib/ingest.ts`, kind
   `ingest`) do this. `/runs` renders the log; expanding a row shows Curator reasons and
   Editor rejections.
6. **No `any`, no swallowed errors, small files.** `grep -rn ': any\b|<any>|as any\b'`
   across `lib`/`app`/`components` returns nothing. Errors are either propagated as typed
   `degraded`/`error` results or explicitly logged (e.g. `console.error` in
   `lib/agents/feedback-profile.ts` and the feedback route) rather than caught and dropped.
   Files are generally small and single-purpose; the orchestrator `lib/agents/pipeline.ts`
   (~360 lines) is the natural exception as the one place that has to know about every
   stage.

## Cost tracking and email compliance

**Cost.** `callLLM` returns `usage` (prompt/completion/total tokens, summed across both
attempts, including failed ones). `generateBrief` accumulates it into `runs.token_cost`
(total tokens) and puts `usage` on each stage's `finish` entry in `stage_log`; `/runs`
shows a Tokens column. Transient 429/5xx/connection errors are retried with exponential
backoff + jitter in `lib/retry.ts` (SDK retries are disabled so they don't multiply).

**Email compliance.** `lib/signed-link.ts` makes stateless HMAC tokens bound to a purpose
(key derived from `CRON_SECRET`; throws if unset). Every digest email carries a footer
unsubscribe link (`/unsubscribe?t=`, a confirm page — a GET never acts, so scanners can't
unsubscribe anyone) plus `List-Unsubscribe` / `List-Unsubscribe-Post` headers pointing at
`POST /api/unsubscribe?t=` (RFC 8058 one-click). Both set `preferences.is_active = false`.
`POST /api/webhooks/resend` (Svix signature, `RESEND_WEBHOOK_SECRET`, 503 until set) sets
`users.email_status` to `bounced` (permanent bounces only) or `complained`; the dispatcher
and `/api/digest/send-now/run` skip any user whose status isn't `ok`. All sends go through
`lib/email/send.ts`, which logs instead of sending when `RESEND_API_KEY` is empty. There is
no UI yet to resume an unsubscribed user (Phase 3 settings).

## The job queue and cron dispatcher (Phase 6 + 2.1)

Scheduled delivery is a queue (`jobs` table, `lib/jobs/*`) so throughput scales with the
number of parallel workers instead of one 300s request. Three pieces:

1. **Dispatcher** — `runDispatch` (`lib/cron/dispatch.ts`), `POST /api/cron/dispatch`
   (`isAuthorizedCronCaller`-gated). Enqueue-only, returns in milliseconds. For every
   active, verified, non-suppressed user whose `next_run_at` is within `LEAD_MS` (45 min):
   enqueue a `generate` job for that slot, then atomically claim the slot (`claimDueRun`:
   `UPDATE preferences SET next_run_at = <following slot> WHERE user_id = ? AND
   next_run_at = <exact value read>`). Enqueue-then-claim, so a crash between them can only
   cause a no-op duplicate enqueue (unique index `(kind, user_id, scheduled_for)`), never a
   lost slot. The following slot is computed from the slot itself, not from `now`. Then
   `after(() => fanOutWorkers(...))` starts up to `WORKER_FANOUT` (default 4) parallel
   `POST /api/jobs/worker` invocations, sized to the runnable backlog.
2. **Worker** — `POST /api/jobs/worker` (`runWorker`, `lib/jobs/worker.ts`). Loops claiming
   small batches until the queue is empty or <90s of the 300s budget remain. `claimJobs`
   (`lib/jobs/queue.ts`) is one `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`:
   pending-and-due jobs, or running jobs whose lease (`locked_until`, 6 min) expired because
   their worker died. `attempts` is bumped on claim; at 3 a job is failed, not retried.
   Handler failures retry with backoff (`failJob`).
3. **Handlers** (`lib/jobs/handlers.ts`). `generate`: re-checks the recipient (active, not
   suppressed), skips generation if a digest for the slot already exists (retry-safe), runs
   `generateDigest(..., scheduledFor: slot)`, then enqueues a `send` job with
   `run_after = slot`. `send`: re-checks the recipient (they may have unsubscribed in the
   45 min window), then `deliverDigest` (`lib/email/deliver.ts`), which renders from the
   stored `digests`/`digest_items` rows and is idempotent (already-sent digests are skipped).

"Generate early, send on time": briefs are built between 45 and 0 minutes before the slot;
the email goes out on the first dispatch tick at/after the slot. The digest and its items
are inserted in one transaction, with `(user_id, scheduled_for)` unique as the backstop.
The interactive send-now route (`/api/digest/send-now/run`) bypasses the queue: it runs
`generateDigest` + `deliverDigest` inline and streams stage events over SSE.

**Triggers**: `.github/workflows/dispatch.yml` (`*/15 * * * *` + `workflow_dispatch`) curls
the deployed dispatch route — needs repo secrets `DISPATCH_URL` and `CRON_SECRET`.
`npm run watch` (`scripts/watch.ts`) polls it every 60s against `BASE_URL` for demos.
Tests: `lib/jobs/queue.test.ts` (race, lease expiry, attempt cap), `lib/jobs/worker.test.ts`
(lead window, send-on-slot, unsubscribed-in-window), `lib/cron/dispatch.test.ts` (CAS race).
DB tests that run a worker must pass `userIds` so they never claim real jobs.

## Not built

Nothing outstanding from CC.md's phases 1–7.

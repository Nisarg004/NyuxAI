@AGENTS.md

# Brieff — project reference for Claude Code

Brieff is a personalized-news-briefing app: a four-agent pipeline (Curator → Researcher →
Writer → Editor) builds a sourced daily brief per user, sent by email and readable in-app,
with a thumbs up/down feedback loop that reshapes future curation. Full original build
spec (phases 1–7): `files/CC.md`. Phases 1–7 are built. Phase 6 (cron scheduler) was
skipped for a long time and then added: `POST /api/cron/dispatch` reads `next_run_at`,
fires `/api/digest/send-now/run` per due user, and rolls the slot forward;
`.github/workflows/dispatch.yml` polls it every 15 min and `npm run watch` polls it every
60s for demos. See "The cron dispatcher" below. The current UI is a warm-newsprint/ink/oxblood editorial design (Fraunces +
Hanken Grotesk, no monospace, "desk"/"edition" language) — this superseded an earlier
dark-mode/amber direction described in CC.md's Phase 5 section; treat that section as
historical.

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
  over the same article never re-fetch)
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

Entry point: `generateDigest(userId, { dryRun, onStage? })` in `lib/agents/pipeline.ts`.
`onStage` is called with each stage-log entry as it's produced, which is what powers the
SSE progress stream on `/api/digest/send-now`.

**Curator** (`lib/agents/curator.ts`, `MODEL_FAST`). Input: `roleTitle`, `keywords`,
`feedbackProfile`, `sectors`, and up to 150 candidate articles from the last 24h in those
sectors (`fetchCandidateArticles`) — each `{ id, title, excerpt, sector, source,
publishedAt }`. Output (`curatorOutputSchema`): `{ selected: [{ article_id, sector, score
(0–100), reason }] }`. Prompted to dedupe near-identical stories and return the top 5 per
sector; `reason` is one short clause, surfaced in `/runs`.

**Researcher** (`lib/agents/researcher.ts`, no LLM). For each selected article: check
`articles.full_text` in the DB first; if cached, reuse it (`depth: "deep"`) with no
network call. Otherwise fetch `https://r.jina.ai/<encoded url>` (8s timeout via
`AbortSignal.timeout`, truncated to 4000 chars, bearer `JINA_API_KEY` if set), persist the
result back onto the `articles` row, and use it (`depth: "deep"`). On fetch failure, fall
back to the RSS excerpt (`depth: "shallow"`). Runs with concurrency 10 (`lib/concurrency.ts`
— bumped from the spec's 5 after a dry run showed 5-wide concurrency forcing two sequential
8s-timeout waves on a typical 10-article selection).

**Writer** (`lib/agents/writer.ts`, `MODEL_WRITER`). Called once per sector, sectors run in
parallel. Input: reader `{ name, role_title, depth }` and that sector's researched items
`{ article_id, sector, title, source, research_depth, source_text }` (plus
`previous_rejections` on a retry — see below). Output (`writerOutputSchema`): `{ items:
[{ article_id, sector, headline (≤12 words), summary (2–3 sentences), why_it_matters
(string | null) }], editors_note }`. `why_it_matters` is explicitly nullable at this stage —
the Writer is instructed to set it `null` rather than invent a generic consequence when the
source doesn't support one; the Editor is responsible for rejecting those. A separate,
cheap `runCrossSectorNote` call (`MODEL_FAST`) synthesizes the real cross-sector
`editors_note` afterward, once all sectors' items are known — the per-sector Writer calls
never see each other's output.

**Editor** (`lib/agents/editor.ts`, `MODEL_FAST`). Input: each written item plus its
`source_text`. Verifies every claim in `summary`/`why_it_matters` is supported by the
source text, rejects items with a null `why_it_matters` or an unsupported claim, strips
hype/hedging, enforces word limits. Output (`editorOutputSchema`): `{ approved: [{
article_id, sector, headline, summary, why_it_matters (non-null) }], rejected: [{
article_id, reason }] }`. `writerItemSchema` (used for `approved`) requires non-null
`why_it_matters`, so structured-output validation itself blocks a null from shipping.
Rejections are preserved in `stage_log` — a demo asset, not swallowed.

**Per-sector retry**: `runSectorPipeline` in `pipeline.ts` runs Writer → Editor for one
sector; if the first pass approves zero items, it retries the Writer once with the specific
rejection reasons (`previousRejections`) before shipping that sector empty. This is beyond
CC.md's original spec but keeps a single bad pass from silently zeroing a sector.

**Ranking & persistence**: approved items are ranked within each sector by the Curator's
original score (highest first); an item whose `article_id` doesn't resolve to a known
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

There's no user auth (deliberately deferred — see CC.md), but the four routes that trigger
real work — `/api/ingest`, `/api/digest/generate`, `/api/digest/send-now/run`, and
`/api/feedback` — all require `Authorization: Bearer ${CRON_SECRET}` and refuse to do
anything without it (`isAuthorizedCronCaller`, fails closed if `CRON_SECRET` itself is
unset). This is what makes it safe to run this app on a public URL with no other auth in
front of it. The app's own UI never sends that header from the browser:

- **Send now**: the browser calls `/api/digest/send-now` (session-cookie-gated, unchanged
  contract). That route resolves `getSessionUserId()`, then re-issues the request to
  `/api/digest/send-now/run` with the secret attached, piping the SSE response straight
  back (`getInternalBaseUrl()` prefers Vercel's `VERCEL_URL` over `NEXT_PUBLIC_APP_URL` for
  this loopback call). `/run` is the one that actually executes the pipeline and sends
  email, and is the one a future Phase 6 cron dispatcher would call directly.
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

## The cron dispatcher (Phase 6)

`runDispatch` (`lib/cron/dispatch.ts`), exposed as `POST /api/cron/dispatch`
(`isAuthorizedCronCaller`-gated, `maxDuration = 300`):

1. Selects `preferences` rows where `is_active` and `next_run_at <= now()`, joined to
   `users` for the email.
2. Per user, **atomically claims the slot**: `claimDueRun` runs
   `UPDATE preferences SET next_run_at = <computeNextRunAt(...)> WHERE user_id = ? AND
   next_run_at = <the exact value just read>` and returns whether it matched a row. A
   second concurrent dispatcher (overlapping GitHub Actions run, or `npm run watch` firing
   mid-pipeline) matches zero rows and skips the user. This is the primary double-send
   guard; `lib/cron/dispatch.test.ts` races two claims against one DB row to prove it.
3. Loops back into `/api/digest/send-now/run` with `cronSecretHeader()` and
   `scheduledFor` = the due slot, drains the SSE stream, records the terminal event.
   Passing `scheduledFor` makes `generateDigest` insert the `digests` row with that exact
   timestamp and `.onConflictDoNothing()`, so the `(user_id, scheduled_for)` unique index
   is the backstop guard — a true simultaneous race that somehow passes step 2 still can't
   double-insert. `generateDigest` returns `{ ..., skipped: true }` in that case.

`next_run_at` is rolled forward *before* the pipeline runs, so a user whose pipeline fails
isn't retried every 15 minutes forever (the failure is in a `runs` row; they get tomorrow's
brief). Users are processed sequentially; the JSON response includes `durationMs` so the
300s ceiling stays visible as the user count grows.

**Triggers**: `.github/workflows/dispatch.yml` (`*/15 * * * *` + `workflow_dispatch`) curls
the deployed route — needs repo secrets `DISPATCH_URL` (production base URL) and
`CRON_SECRET`. `npm run watch` (`scripts/watch.ts`) polls the same route every 60s against
`BASE_URL` (default `http://localhost:3000`) for demos where Actions' lateness is too slow.

## Not built

Nothing outstanding from CC.md's phases 1–7.

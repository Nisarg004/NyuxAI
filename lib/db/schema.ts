import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  pgEnum,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const depthEnum = pgEnum("depth", ["brief", "standard", "deep"]);
export const digestStatusEnum = pgEnum("digest_status", [
  "pending",
  "generating",
  "ready",
  "sent",
  "failed",
]);
// "role": curated and personalised for this reader. "sectors": the shared edition for each
// chosen sector, built once per sector and bucket and served with no per-user LLM calls.
export const preferencesModeEnum = pgEnum("preferences_mode", ["sectors", "role"]);
export const feedbackSignalEnum = pgEnum("feedback_signal", ["up", "down", "save"]);

export const jobKindEnum = pgEnum("job_kind", ["generate", "send"]);
export const jobStatusEnum = pgEnum("job_status", ["pending", "running", "done", "failed"]);

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
// Set by the Resend webhook; anything other than "ok" means we must not email this address.
export const emailStatusEnum = pgEnum("email_status", ["ok", "bounced", "complained"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  roleTitle: text("role_title"),
  role: userRoleEnum("role").notNull().default("user"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  emailStatus: emailStatusEnum("email_status").notNull().default("ok"),
  emailStatusUpdatedAt: timestamp("email_status_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Both tables store only the SHA-256 of the secret handed to the browser/email,
// so a leaked database dump can't be replayed as a login.
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_tokens_email_created_at_idx").on(t.email, t.createdAt)],
);

export const preferences = pgTable("preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  sectors: text("sectors").array().notNull(),
  deliveryHour: integer("delivery_hour").notNull(),
  deliveryMinute: integer("delivery_minute").notNull(),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  depth: depthEnum("depth").notNull().default("standard"),
  keywords: text("keywords").array().notNull().default([]),
  feedbackProfile: text("feedback_profile"),
  feedbackProfileUpdatedAt: timestamp("feedback_profile_updated_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  mode: preferencesModeEnum("mode").notNull().default("sectors"),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => [index("preferences_due_idx").on(t.nextRunAt).where(sql`${t.isActive}`)]);

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  sector: text("sector").notNull(),
  name: text("name").notNull(),
  rssUrl: text("rss_url").notNull(),
  weight: integer("weight").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
});

// A story is a cluster of articles, across outlets, about the same event within ~48h.
// `canonical_article_id` is the first article seen; later ones are matched against its embedding.
export const stories = pgTable(
  "stories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sector: text("sector").notNull(),
    canonicalArticleId: uuid("canonical_article_id"),
    articleCount: integer("article_count").notNull().default(1),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stories_sector_last_updated_idx").on(t.sector, t.lastUpdated)],
);

export const articles = pgTable("articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  sector: text("sector").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  author: text("author"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  excerpt: text("excerpt"),
  contentHash: text("content_hash").notNull().unique(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  fullText: text("full_text"),
  fullTextFetchedAt: timestamp("full_text_fetched_at", { withTimezone: true }),
  // Title+excerpt embedding (EMBEDDING_DIMENSIONS floats) and the story it was clustered into.
  // Plain real[] with similarity computed in app code: a 48h window is ~1.5k articles, far
  // below where an ANN index (pgvector) starts to matter.
  embedding: real("embedding").array(),
  storyId: uuid("story_id").references(() => stories.id, { onDelete: "set null" }),
}, (t) => [
  index("articles_story_id_idx").on(t.storyId),
  index("articles_sector_fetched_at_idx").on(t.sector, t.fetchedAt),
  index("articles_source_id_idx").on(t.sourceId),
]);

export const digests = pgTable(
  "digests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    status: digestStatusEnum("status").notNull().default("pending"),
    subject: text("subject"),
    html: text("html"),
    runMeta: jsonb("run_meta"),
  },
  (table) => [uniqueIndex("digests_user_scheduled_idx").on(table.userId, table.scheduledFor)]
);

export const digestItems = pgTable("digest_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  digestId: uuid("digest_id")
    .notNull()
    .references(() => digests.id, { onDelete: "cascade" }),
  articleId: uuid("article_id").references(() => articles.id, { onDelete: "set null" }),
  sector: text("sector").notNull(),
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  whyItMatters: text("why_it_matters").notNull(),
  sourceUrl: text("source_url").notNull(),
  rank: integer("rank").notNull(),
}, (t) => [index("digest_items_digest_id_idx").on(t.digestId)]);

export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  digestItemId: uuid("digest_item_id")
    .notNull()
    .references(() => digestItems.id, { onDelete: "cascade" }),
  signal: feedbackSignalEnum("signal").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("feedback_user_created_at_idx").on(t.userId, t.createdAt)]);

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull(),
  stageLog: jsonb("stage_log"),
  tokenCost: numeric("token_cost"),
  error: text("error"),
}, (t) => [index("runs_started_at_idx").on(t.startedAt)]);

export const landingRuns = pgTable(
  "landing_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ipHash: text("ip_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("landing_runs_ip_hash_created_at_idx").on(t.ipHash, t.createdAt)],
);

// The work queue the dispatcher fills and /api/jobs/worker drains. A job is claimed by
// flipping pending -> running with a lease (`locked_until`); a worker that dies leaves an
// expired lease, which makes the job claimable again until `attempts` hits the cap.
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: jobKindEnum("kind").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // The delivery slot this job belongs to — the same value as digests.scheduled_for.
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    status: jobStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("jobs_kind_user_slot_idx").on(t.kind, t.userId, t.scheduledFor),
    index("jobs_status_run_after_idx").on(t.status, t.runAfter),
  ],
);

// One neutral, Editor-verified brief per article, written once and shared by every user
// whose Curator selects it. Per-user work is then limited to curation and (for role-tuned
// readers) a short personalised "why it matters" checked against `key_facts`.
// Unverified rows record an Editor rejection after deep research, so a thin article is not
// rewritten and re-rejected on every run.
export const articleBriefs = pgTable("article_briefs", {
  articleId: uuid("article_id")
    .primaryKey()
    .references(() => articles.id, { onDelete: "cascade" }),
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  whyItMatters: text("why_it_matters"),
  keyFacts: jsonb("key_facts").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  verified: boolean("verified").notNull(),
  editorNotes: text("editor_notes"),
  researchDepth: text("research_depth").notNull(),
  model: text("model").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// The sector edition: one neutral brief per sector per time bucket, shared by every reader
// in "sectors" mode. `items` are copies (headline, summary, why_it_matters, source_url, rank)
// so an edition stays readable after its articles are pruned, like digest_items.
export type EditionItem = {
  article_id: string;
  headline: string;
  summary: string;
  why_it_matters: string;
  source_url: string;
  rank: number;
};

export const sectorEditions = pgTable(
  "sector_editions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sector: text("sector").notNull(),
    // Start of the 12h UTC bucket this edition covers, e.g. 2026-10-18T12:00Z.
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    items: jsonb("items").$type<EditionItem[]>().notNull(),
    runId: uuid("run_id").references(() => runs.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sector_editions_sector_bucket_idx").on(t.sector, t.bucketStart)],
);

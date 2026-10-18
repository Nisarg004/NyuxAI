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
export const feedbackSignalEnum = pgEnum("feedback_signal", ["up", "down", "save"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  roleTitle: text("role_title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  isActive: boolean("is_active").notNull().default(true),
});

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  sector: text("sector").notNull(),
  name: text("name").notNull(),
  rssUrl: text("rss_url").notNull(),
  weight: integer("weight").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
});

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
});

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
});

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
});

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
});

export const landingRuns = pgTable(
  "landing_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ipHash: text("ip_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("landing_runs_ip_hash_created_at_idx").on(t.ipHash, t.createdAt)],
);

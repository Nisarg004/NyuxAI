CREATE TABLE "article_briefs" (
	"article_id" uuid PRIMARY KEY NOT NULL,
	"headline" text NOT NULL,
	"summary" text NOT NULL,
	"why_it_matters" text,
	"key_facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verified" boolean NOT NULL,
	"editor_notes" text,
	"research_depth" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_briefs" ADD CONSTRAINT "article_briefs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
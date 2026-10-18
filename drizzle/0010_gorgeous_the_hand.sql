CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sector" text NOT NULL,
	"canonical_article_id" uuid,
	"article_count" integer DEFAULT 1 NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "embedding" real[];--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "story_id" uuid;--> statement-breakpoint
CREATE INDEX "stories_sector_last_updated_idx" ON "stories" USING btree ("sector","last_updated");--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_story_id_idx" ON "articles" USING btree ("story_id");
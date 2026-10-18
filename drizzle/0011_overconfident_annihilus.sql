CREATE TYPE "public"."preferences_mode" AS ENUM('sectors', 'role');--> statement-breakpoint
CREATE TABLE "sector_editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sector" text NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"items" jsonb NOT NULL,
	"run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "mode" "preferences_mode" DEFAULT 'sectors' NOT NULL;--> statement-breakpoint
ALTER TABLE "sector_editions" ADD CONSTRAINT "sector_editions_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sector_editions_sector_bucket_idx" ON "sector_editions" USING btree ("sector","bucket_start");--> statement-breakpoint
-- Preserve today's behaviour: anyone who gave a role keeps a role-tuned brief; the rest get the sector edition.
UPDATE "preferences" SET "mode" = 'role' WHERE "user_id" IN (SELECT "id" FROM "users" WHERE btrim(coalesce("role_title", '')) <> '');

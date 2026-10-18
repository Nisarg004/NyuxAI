CREATE TYPE "public"."email_status" AS ENUM('ok', 'bounced', 'complained');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_status" "email_status" DEFAULT 'ok' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_status_updated_at" timestamp with time zone;
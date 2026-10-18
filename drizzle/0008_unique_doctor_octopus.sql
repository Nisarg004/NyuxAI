CREATE TYPE "public"."job_kind" AS ENUM('generate', 'send');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "job_kind" NOT NULL,
	"user_id" uuid NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_kind_user_slot_idx" ON "jobs" USING btree ("kind","user_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "jobs_status_run_after_idx" ON "jobs" USING btree ("status","run_after");
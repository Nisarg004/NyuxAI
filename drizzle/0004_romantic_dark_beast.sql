CREATE TABLE "landing_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "landing_runs_ip_hash_created_at_idx" ON "landing_runs" USING btree ("ip_hash","created_at");
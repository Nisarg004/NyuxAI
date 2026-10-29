ALTER TABLE "auth_tokens" ADD COLUMN "ip_hash" text;--> statement-breakpoint
CREATE INDEX "auth_tokens_ip_hash_created_at_idx" ON "auth_tokens" USING btree ("ip_hash","created_at");
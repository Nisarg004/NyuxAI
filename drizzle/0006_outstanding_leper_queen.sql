CREATE INDEX "articles_sector_fetched_at_idx" ON "articles" USING btree ("sector","fetched_at");--> statement-breakpoint
CREATE INDEX "articles_source_id_idx" ON "articles" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "digest_items_digest_id_idx" ON "digest_items" USING btree ("digest_id");--> statement-breakpoint
CREATE INDEX "feedback_user_created_at_idx" ON "feedback" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "preferences_due_idx" ON "preferences" USING btree ("next_run_at") WHERE "preferences"."is_active";--> statement-breakpoint
CREATE INDEX "runs_started_at_idx" ON "runs" USING btree ("started_at");
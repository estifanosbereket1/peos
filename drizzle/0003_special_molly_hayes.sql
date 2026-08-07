DROP INDEX "daily_plan_tasks_plan_id_idx";--> statement-breakpoint
CREATE INDEX "daily_plan_tasks_plan_id_idx" ON "daily_plan_tasks" USING btree ("daily_plan_id");
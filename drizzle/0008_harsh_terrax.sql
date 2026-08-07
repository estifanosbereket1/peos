CREATE TABLE "fasting_windows" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp,
	"goal_hours" integer,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fasting_windows" ADD CONSTRAINT "fasting_windows_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fasting_windows_user_idx" ON "fasting_windows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fasting_windows_user_start_idx" ON "fasting_windows" USING btree ("user_id","start_at");
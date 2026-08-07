CREATE TYPE "public"."learning_log_source" AS ENUM('suggestion', 'user', 'ai');--> statement-breakpoint
CREATE TABLE "learning_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"learn_date" text NOT NULL,
	"topic" text NOT NULL,
	"content" text NOT NULL,
	"source" "learning_log_source" DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learning_logs" ADD CONSTRAINT "learning_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_topics" ADD CONSTRAINT "learning_topics_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learning_logs_user_date_idx" ON "learning_logs" USING btree ("user_id","learn_date");
CREATE TYPE "public"."proof_source" AS ENUM('manual', 'auto');--> statement-breakpoint
CREATE TABLE "proof_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"source" "proof_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "energy" integer;--> statement-breakpoint
ALTER TABLE "learning_logs" ADD COLUMN "explain_back" text;--> statement-breakpoint
ALTER TABLE "proof_entries" ADD CONSTRAINT "proof_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proof_entries_user_idx" ON "proof_entries" USING btree ("user_id");
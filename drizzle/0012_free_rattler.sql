CREATE TYPE "public"."voice_note_status" AS ENUM('pending', 'done', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "voice_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category_id" text,
	"audio_url" text NOT NULL,
	"audio" text NOT NULL,
	"mime" text DEFAULT 'audio/webm' NOT NULL,
	"transcript" text,
	"transcript_status" "voice_note_status" DEFAULT 'pending' NOT NULL,
	"duration_seconds" integer,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "voice_categories" ADD CONSTRAINT "voice_categories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_notes" ADD CONSTRAINT "voice_notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_notes" ADD CONSTRAINT "voice_notes_category_id_voice_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."voice_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "voice_notes_user_idx" ON "voice_notes" USING btree ("user_id");
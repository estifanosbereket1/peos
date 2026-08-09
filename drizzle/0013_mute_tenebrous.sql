CREATE TYPE "public"."entry_owner_kind" AS ENUM('learn', 'proof', 'review');--> statement-breakpoint
CREATE TABLE "entry_voices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"owner_kind" "entry_owner_kind" NOT NULL,
	"owner_id" text NOT NULL,
	"field" text NOT NULL,
	"audio_url" text NOT NULL,
	"audio" text NOT NULL,
	"mime" text DEFAULT 'audio/webm' NOT NULL,
	"transcript" text,
	"transcript_status" "voice_note_status" DEFAULT 'skipped' NOT NULL,
	"duration_seconds" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learning_logs" ALTER COLUMN "content" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "proof_entries" ALTER COLUMN "text" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "entry_voices" ADD CONSTRAINT "entry_voices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entry_voices_owner_idx" ON "entry_voices" USING btree ("user_id","owner_kind","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entry_voices_unique_field_idx" ON "entry_voices" USING btree ("user_id","owner_kind","owner_id","field");
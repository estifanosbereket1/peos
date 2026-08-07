CREATE TABLE "night_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"day_key" text NOT NULL,
	"wins" text,
	"improve" text,
	"next_move" text,
	"energy" smallint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "night_reviews" ADD CONSTRAINT "night_reviews_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "night_reviews_user_day_unique" ON "night_reviews" USING btree ("user_id","day_key");
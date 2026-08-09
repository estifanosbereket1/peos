CREATE TYPE "public"."book_format" AS ENUM('pdf', 'epub');--> statement-breakpoint
CREATE TYPE "public"."book_status" AS ENUM('unread', 'reading', 'finished');--> statement-breakpoint
CREATE TABLE "book_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"book_id" text NOT NULL,
	"user_id" text NOT NULL,
	"page" integer,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"file_url" text NOT NULL,
	"mime" text NOT NULL,
	"file_size" integer NOT NULL,
	"format" "book_format" NOT NULL,
	"total_pages" integer,
	"current_page" integer DEFAULT 0 NOT NULL,
	"current_location" text,
	"progress" double precision DEFAULT 0 NOT NULL,
	"status" "book_status" DEFAULT 'unread' NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"last_opened_at" timestamp,
	"file" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_notes" ADD CONSTRAINT "book_notes_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_notes" ADD CONSTRAINT "book_notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_notes_book_user_idx" ON "book_notes" USING btree ("book_id","user_id");--> statement-breakpoint
CREATE INDEX "books_user_idx" ON "books" USING btree ("user_id");
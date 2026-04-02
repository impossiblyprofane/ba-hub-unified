CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"answer" integer NOT NULL,
	"question" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deck_likes" (
	"user_id" uuid NOT NULL,
	"deck_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deck_likes_user_id_deck_id_pk" PRIMARY KEY("user_id","deck_id")
);
--> statement-breakpoint
CREATE TABLE "deck_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"viewer_key" text NOT NULL,
	"view_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "published_decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"deck_code" text NOT NULL,
	"country_id" integer NOT NULL,
	"spec1_id" integer NOT NULL,
	"spec2_id" integer NOT NULL,
	"deck_data" jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deck_likes" ADD CONSTRAINT "deck_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_likes" ADD CONSTRAINT "deck_likes_deck_id_published_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."published_decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_views" ADD CONSTRAINT "deck_views_deck_id_published_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."published_decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_decks" ADD CONSTRAINT "published_decks_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_deck_views_deck_viewer_date" ON "deck_views" USING btree ("deck_id","viewer_key","view_date");--> statement-breakpoint
CREATE INDEX "idx_published_decks_author" ON "published_decks" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_published_decks_country" ON "published_decks" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "idx_published_decks_specs" ON "published_decks" USING btree ("spec1_id","spec2_id");--> statement-breakpoint
CREATE INDEX "idx_published_decks_like_count" ON "published_decks" USING btree ("like_count");--> statement-breakpoint
CREATE INDEX "idx_published_decks_created_at" ON "published_decks" USING btree ("created_at");
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"answer" integer NOT NULL,
	"question" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawler_state" (
	"id" text PRIMARY KEY NOT NULL,
	"scan_floor" integer DEFAULT 0 NOT NULL,
	"scan_ceiling" integer DEFAULT 0 NOT NULL,
	"scan_position" integer DEFAULT 0 NOT NULL,
	"initial_collection_done" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "fight_data" (
	"fight_id" integer PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"end_time" bigint,
	"stored_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaderboard_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"user_id" integer,
	"steam_id" text,
	"name" text,
	"rating" real,
	"elo" real,
	"level" integer,
	"win_rate" real,
	"kd_ratio" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_player_picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fight_id" integer NOT NULL,
	"steam_id" text,
	"od_id" integer,
	"team_id" integer,
	"spec1_id" integer,
	"spec1_name" text,
	"spec2_id" integer,
	"spec2_name" text,
	"faction_name" text NOT NULL,
	"old_rating" real,
	"new_rating" real,
	"destruction" integer,
	"player_losses" integer,
	"damage_dealt" real,
	"damage_received" real,
	"objectives_captured" integer
);
--> statement-breakpoint
CREATE TABLE "match_team_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fight_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"faction_name" text NOT NULL,
	"is_winner" boolean NOT NULL,
	"avg_rating" real
);
--> statement-breakpoint
CREATE TABLE "match_unit_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fight_id" integer NOT NULL,
	"steam_id" text,
	"od_id" integer,
	"unit_id" integer NOT NULL,
	"unit_name" text NOT NULL,
	"faction_name" text NOT NULL,
	"option_ids" text DEFAULT '' NOT NULL,
	"config_key" text NOT NULL,
	"player_rating" real,
	"elo_bracket" text DEFAULT 'unranked' NOT NULL,
	"killed_count" integer DEFAULT 0 NOT NULL,
	"total_damage_dealt" real DEFAULT 0 NOT NULL,
	"total_damage_received" real DEFAULT 0 NOT NULL,
	"supply_points_consumed" integer DEFAULT 0 NOT NULL,
	"was_refunded" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_matches" (
	"fight_id" integer PRIMARY KEY NOT NULL,
	"map_id" integer,
	"map_name" text,
	"is_ranked" boolean DEFAULT false NOT NULL,
	"winner_team" integer,
	"player_count" integer DEFAULT 0 NOT NULL,
	"total_play_time_sec" integer,
	"end_time" bigint,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "published_decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"publisher_name" text DEFAULT '' NOT NULL,
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
CREATE TABLE "stat_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_snapshot_id_stat_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."stat_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_player_picks" ADD CONSTRAINT "match_player_picks_fight_id_processed_matches_fight_id_fk" FOREIGN KEY ("fight_id") REFERENCES "public"."processed_matches"("fight_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_team_results" ADD CONSTRAINT "match_team_results_fight_id_processed_matches_fight_id_fk" FOREIGN KEY ("fight_id") REFERENCES "public"."processed_matches"("fight_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_unit_deployments" ADD CONSTRAINT "match_unit_deployments_fight_id_processed_matches_fight_id_fk" FOREIGN KEY ("fight_id") REFERENCES "public"."processed_matches"("fight_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_decks" ADD CONSTRAINT "published_decks_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_deck_views_deck_viewer_date" ON "deck_views" USING btree ("deck_id","viewer_key","view_date");--> statement-breakpoint
CREATE INDEX "idx_fight_data_end_time" ON "fight_data" USING btree ("end_time");--> statement-breakpoint
CREATE INDEX "idx_leaderboard_snapshots_snapshot" ON "leaderboard_snapshots" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_leaderboard_snapshots_steam" ON "leaderboard_snapshots" USING btree ("steam_id");--> statement-breakpoint
CREATE INDEX "idx_leaderboard_snapshots_rank" ON "leaderboard_snapshots" USING btree ("rank");--> statement-breakpoint
CREATE INDEX "idx_match_player_picks_fight" ON "match_player_picks" USING btree ("fight_id");--> statement-breakpoint
CREATE INDEX "idx_match_player_picks_spec1" ON "match_player_picks" USING btree ("spec1_name");--> statement-breakpoint
CREATE INDEX "idx_match_player_picks_steam" ON "match_player_picks" USING btree ("steam_id");--> statement-breakpoint
CREATE INDEX "idx_match_player_picks_od" ON "match_player_picks" USING btree ("od_id");--> statement-breakpoint
CREATE INDEX "idx_match_team_results_fight" ON "match_team_results" USING btree ("fight_id");--> statement-breakpoint
CREATE INDEX "idx_match_team_results_faction" ON "match_team_results" USING btree ("faction_name");--> statement-breakpoint
CREATE INDEX "idx_match_unit_deployments_fight" ON "match_unit_deployments" USING btree ("fight_id");--> statement-breakpoint
CREATE INDEX "idx_match_unit_deployments_unit" ON "match_unit_deployments" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_match_unit_deployments_config" ON "match_unit_deployments" USING btree ("config_key");--> statement-breakpoint
CREATE INDEX "idx_match_unit_deployments_elo" ON "match_unit_deployments" USING btree ("elo_bracket");--> statement-breakpoint
CREATE INDEX "idx_match_unit_deployments_faction" ON "match_unit_deployments" USING btree ("faction_name");--> statement-breakpoint
CREATE INDEX "idx_match_unit_deployments_steam" ON "match_unit_deployments" USING btree ("steam_id");--> statement-breakpoint
CREATE INDEX "idx_match_unit_deployments_od" ON "match_unit_deployments" USING btree ("od_id");--> statement-breakpoint
CREATE INDEX "idx_processed_matches_end_time" ON "processed_matches" USING btree ("end_time");--> statement-breakpoint
CREATE INDEX "idx_processed_matches_ranked" ON "processed_matches" USING btree ("is_ranked");--> statement-breakpoint
CREATE INDEX "idx_published_decks_author" ON "published_decks" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_published_decks_country" ON "published_decks" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "idx_published_decks_specs" ON "published_decks" USING btree ("spec1_id","spec2_id");--> statement-breakpoint
CREATE INDEX "idx_published_decks_like_count" ON "published_decks" USING btree ("like_count");--> statement-breakpoint
CREATE INDEX "idx_published_decks_created_at" ON "published_decks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_stat_snapshots_type" ON "stat_snapshots" USING btree ("snapshot_type");--> statement-breakpoint
CREATE INDEX "idx_stat_snapshots_created_at" ON "stat_snapshots" USING btree ("created_at");
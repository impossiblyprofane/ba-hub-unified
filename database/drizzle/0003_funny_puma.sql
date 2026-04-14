CREATE TABLE "crawler_faction_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"faction_name" text NOT NULL,
	"match_count" integer DEFAULT 0 NOT NULL,
	"win_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawler_state" (
	"id" text PRIMARY KEY NOT NULL,
	"high_watermark" integer DEFAULT 0 NOT NULL,
	"last_valid_fight_id" integer DEFAULT 0 NOT NULL,
	"seed_complete" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_player_picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fight_id" integer NOT NULL,
	"steam_id" text,
	"spec1_id" integer,
	"spec1_name" text,
	"spec2_id" integer,
	"spec2_name" text,
	"faction_name" text NOT NULL
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
	"unit_id" integer NOT NULL,
	"unit_name" text NOT NULL,
	"faction_name" text NOT NULL,
	"deploy_count" integer DEFAULT 1 NOT NULL
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
CREATE TABLE "spec_stats_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"spec_name" text NOT NULL,
	"spec_id" integer,
	"pick_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_popularity_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"unit_name" text NOT NULL,
	"unit_id" integer,
	"faction_name" text NOT NULL,
	"deploy_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crawler_faction_snapshots" ADD CONSTRAINT "crawler_faction_snapshots_snapshot_id_stat_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."stat_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_player_picks" ADD CONSTRAINT "match_player_picks_fight_id_processed_matches_fight_id_fk" FOREIGN KEY ("fight_id") REFERENCES "public"."processed_matches"("fight_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_team_results" ADD CONSTRAINT "match_team_results_fight_id_processed_matches_fight_id_fk" FOREIGN KEY ("fight_id") REFERENCES "public"."processed_matches"("fight_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_unit_deployments" ADD CONSTRAINT "match_unit_deployments_fight_id_processed_matches_fight_id_fk" FOREIGN KEY ("fight_id") REFERENCES "public"."processed_matches"("fight_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spec_stats_snapshots" ADD CONSTRAINT "spec_stats_snapshots_snapshot_id_stat_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."stat_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_popularity_snapshots" ADD CONSTRAINT "unit_popularity_snapshots_snapshot_id_stat_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."stat_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_crawler_faction_snapshots_snapshot" ON "crawler_faction_snapshots" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_crawler_faction_snapshots_faction" ON "crawler_faction_snapshots" USING btree ("faction_name");--> statement-breakpoint
CREATE INDEX "idx_match_player_picks_fight" ON "match_player_picks" USING btree ("fight_id");--> statement-breakpoint
CREATE INDEX "idx_match_player_picks_spec1" ON "match_player_picks" USING btree ("spec1_name");--> statement-breakpoint
CREATE INDEX "idx_match_team_results_fight" ON "match_team_results" USING btree ("fight_id");--> statement-breakpoint
CREATE INDEX "idx_match_team_results_faction" ON "match_team_results" USING btree ("faction_name");--> statement-breakpoint
CREATE INDEX "idx_match_unit_deployments_fight" ON "match_unit_deployments" USING btree ("fight_id");--> statement-breakpoint
CREATE INDEX "idx_match_unit_deployments_unit" ON "match_unit_deployments" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_match_unit_deployments_faction" ON "match_unit_deployments" USING btree ("faction_name");--> statement-breakpoint
CREATE INDEX "idx_processed_matches_end_time" ON "processed_matches" USING btree ("end_time");--> statement-breakpoint
CREATE INDEX "idx_processed_matches_ranked" ON "processed_matches" USING btree ("is_ranked");--> statement-breakpoint
CREATE INDEX "idx_spec_stats_snapshots_snapshot" ON "spec_stats_snapshots" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_spec_stats_snapshots_spec" ON "spec_stats_snapshots" USING btree ("spec_name");--> statement-breakpoint
CREATE INDEX "idx_unit_popularity_snapshots_snapshot" ON "unit_popularity_snapshots" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_unit_popularity_snapshots_faction" ON "unit_popularity_snapshots" USING btree ("faction_name");--> statement-breakpoint
CREATE INDEX "idx_unit_popularity_snapshots_unit" ON "unit_popularity_snapshots" USING btree ("unit_name");
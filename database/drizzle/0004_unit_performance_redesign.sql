-- Drop the old unit_popularity_snapshots table (0 rows, no data loss)
DROP TABLE IF EXISTS "unit_popularity_snapshots";
--> statement-breakpoint
-- Create new unit_performance_snapshots table
CREATE TABLE "unit_performance_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"config_key" text NOT NULL,
	"unit_id" integer,
	"unit_name" text NOT NULL,
	"faction_name" text NOT NULL,
	"option_ids" text DEFAULT '' NOT NULL,
	"elo_bracket" text DEFAULT 'unranked' NOT NULL,
	"deploy_count" integer DEFAULT 0 NOT NULL,
	"total_kills" integer DEFAULT 0 NOT NULL,
	"total_damage_dealt" real DEFAULT 0 NOT NULL,
	"total_damage_received" real DEFAULT 0 NOT NULL,
	"total_supply_consumed" real DEFAULT 0 NOT NULL,
	"refund_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "unit_performance_snapshots" ADD CONSTRAINT "unit_performance_snapshots_snapshot_id_stat_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."stat_snapshots"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_unit_perf_snapshots_snapshot" ON "unit_performance_snapshots" USING btree ("snapshot_id");
--> statement-breakpoint
CREATE INDEX "idx_unit_perf_snapshots_config" ON "unit_performance_snapshots" USING btree ("config_key");
--> statement-breakpoint
CREATE INDEX "idx_unit_perf_snapshots_faction" ON "unit_performance_snapshots" USING btree ("faction_name");
--> statement-breakpoint
CREATE INDEX "idx_unit_perf_snapshots_elo" ON "unit_performance_snapshots" USING btree ("elo_bracket");
--> statement-breakpoint
-- Alter match_unit_deployments: drop old columns, add new ones
-- Since this table had 0 rows, we can safely recreate it
DROP TABLE IF EXISTS "match_unit_deployments";
--> statement-breakpoint
CREATE TABLE "match_unit_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fight_id" integer NOT NULL,
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
ALTER TABLE "match_unit_deployments" ADD CONSTRAINT "match_unit_deployments_fight_id_processed_matches_fight_id_fk" FOREIGN KEY ("fight_id") REFERENCES "public"."processed_matches"("fight_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_match_unit_deployments_fight" ON "match_unit_deployments" USING btree ("fight_id");
--> statement-breakpoint
CREATE INDEX "idx_match_unit_deployments_unit" ON "match_unit_deployments" USING btree ("unit_id");
--> statement-breakpoint
CREATE INDEX "idx_match_unit_deployments_config" ON "match_unit_deployments" USING btree ("config_key");
--> statement-breakpoint
CREATE INDEX "idx_match_unit_deployments_elo" ON "match_unit_deployments" USING btree ("elo_bracket");
--> statement-breakpoint
CREATE INDEX "idx_match_unit_deployments_faction" ON "match_unit_deployments" USING btree ("faction_name");

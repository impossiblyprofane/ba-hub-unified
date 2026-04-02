CREATE TABLE "faction_stats_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"faction_name" text NOT NULL,
	"match_count" integer DEFAULT 0 NOT NULL,
	"win_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "map_stats_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"map_name" text NOT NULL,
	"play_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stat_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_stats_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"unit_name" text NOT NULL,
	"times_deployed" integer DEFAULT 0 NOT NULL,
	"total_kills" integer DEFAULT 0 NOT NULL,
	"total_damage_dealt" real DEFAULT 0 NOT NULL,
	"total_damage_received" real DEFAULT 0 NOT NULL,
	"total_supply_consumed" real DEFAULT 0 NOT NULL,
	"times_refunded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "faction_stats_snapshots" ADD CONSTRAINT "faction_stats_snapshots_snapshot_id_stat_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."stat_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_snapshot_id_stat_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."stat_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_stats_snapshots" ADD CONSTRAINT "map_stats_snapshots_snapshot_id_stat_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."stat_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_stats_snapshots" ADD CONSTRAINT "unit_stats_snapshots_snapshot_id_stat_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."stat_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_faction_stats_snapshots_snapshot" ON "faction_stats_snapshots" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_faction_stats_snapshots_faction" ON "faction_stats_snapshots" USING btree ("faction_name");--> statement-breakpoint
CREATE INDEX "idx_leaderboard_snapshots_snapshot" ON "leaderboard_snapshots" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_leaderboard_snapshots_steam" ON "leaderboard_snapshots" USING btree ("steam_id");--> statement-breakpoint
CREATE INDEX "idx_leaderboard_snapshots_rank" ON "leaderboard_snapshots" USING btree ("rank");--> statement-breakpoint
CREATE INDEX "idx_map_stats_snapshots_snapshot" ON "map_stats_snapshots" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_map_stats_snapshots_map" ON "map_stats_snapshots" USING btree ("map_name");--> statement-breakpoint
CREATE INDEX "idx_stat_snapshots_type" ON "stat_snapshots" USING btree ("snapshot_type");--> statement-breakpoint
CREATE INDEX "idx_stat_snapshots_created_at" ON "stat_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_unit_stats_snapshots_snapshot" ON "unit_stats_snapshots" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_unit_stats_snapshots_unit" ON "unit_stats_snapshots" USING btree ("unit_name");
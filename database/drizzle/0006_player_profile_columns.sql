-- Add per-match performance columns and player identity to match_player_picks & match_unit_deployments.
-- These columns enable the DB-backed player profile page (no more live S3 fetches).
-- All columns are nullable so existing rows are unaffected.

-- ── match_player_picks: new columns ─────────────────────────
ALTER TABLE "match_player_picks" ADD COLUMN IF NOT EXISTS "od_id" integer;
--> statement-breakpoint
ALTER TABLE "match_player_picks" ADD COLUMN IF NOT EXISTS "team_id" integer;
--> statement-breakpoint
ALTER TABLE "match_player_picks" ADD COLUMN IF NOT EXISTS "old_rating" real;
--> statement-breakpoint
ALTER TABLE "match_player_picks" ADD COLUMN IF NOT EXISTS "new_rating" real;
--> statement-breakpoint
ALTER TABLE "match_player_picks" ADD COLUMN IF NOT EXISTS "destruction" integer;
--> statement-breakpoint
ALTER TABLE "match_player_picks" ADD COLUMN IF NOT EXISTS "player_losses" integer;
--> statement-breakpoint
ALTER TABLE "match_player_picks" ADD COLUMN IF NOT EXISTS "damage_dealt" real;
--> statement-breakpoint
ALTER TABLE "match_player_picks" ADD COLUMN IF NOT EXISTS "damage_received" real;
--> statement-breakpoint
ALTER TABLE "match_player_picks" ADD COLUMN IF NOT EXISTS "objectives_captured" integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_match_player_picks_steam" ON "match_player_picks" USING btree ("steam_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_match_player_picks_od" ON "match_player_picks" USING btree ("od_id");

-- ── match_unit_deployments: new columns ─────────────────────
--> statement-breakpoint
ALTER TABLE "match_unit_deployments" ADD COLUMN IF NOT EXISTS "steam_id" text;
--> statement-breakpoint
ALTER TABLE "match_unit_deployments" ADD COLUMN IF NOT EXISTS "od_id" integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_match_unit_deployments_steam" ON "match_unit_deployments" USING btree ("steam_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_match_unit_deployments_od" ON "match_unit_deployments" USING btree ("od_id");

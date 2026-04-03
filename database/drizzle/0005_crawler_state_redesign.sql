-- Recreate crawler_state with new columns (old table had 0-1 rows, no data loss)
DROP TABLE IF EXISTS "crawler_state";
--> statement-breakpoint
CREATE TABLE "crawler_state" (
	"id" text PRIMARY KEY NOT NULL,
	"scan_floor" integer DEFAULT 0 NOT NULL,
	"scan_ceiling" integer DEFAULT 0 NOT NULL,
	"scan_position" integer DEFAULT 0 NOT NULL,
	"initial_collection_done" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

import { pgTable, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

/**
 * Single-row table tracking the match crawler's scanning progress.
 * The row with id = 'main' holds the current state.
 */
export const crawlerState = pgTable('crawler_state', {
  id: text('id').primaryKey(),
  /** Lowest fight ID available on S3 (found via binary search). */
  scanFloor: integer('scan_floor').notNull().default(0),
  /** Highest known fight ID at time of initialization. */
  scanCeiling: integer('scan_ceiling').notNull().default(0),
  /** Current position in the range scan (starts at floor, advances per cycle). */
  scanPosition: integer('scan_position').notNull().default(0),
  /** Whether initial collection (player fights + binary search) has completed. */
  initialCollectionDone: boolean('initial_collection_done').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

import { pgTable, uuid, text, integer, real, timestamp, index } from 'drizzle-orm/pg-core';
import { statSnapshots } from './stat-snapshots.js';

/**
 * Stores a snapshot of the leaderboard at a point in time.
 * Each row = one player entry within one snapshot.
 */
export const leaderboardSnapshots = pgTable('leaderboard_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  snapshotId: uuid('snapshot_id').notNull().references(() => statSnapshots.id, { onDelete: 'cascade' }),
  rank: integer('rank').notNull(),
  userId: integer('user_id'),
  steamId: text('steam_id'),
  name: text('name'),
  rating: real('rating'),
  elo: real('elo'),
  level: integer('level'),
  winRate: real('win_rate'),
  kdRatio: real('kd_ratio'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_leaderboard_snapshots_snapshot').on(table.snapshotId),
  index('idx_leaderboard_snapshots_steam').on(table.steamId),
  index('idx_leaderboard_snapshots_rank').on(table.rank),
]);

import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { publishedDecks } from './published-decks.js';

/**
 * Deck views — one row per unique viewer per deck per day.
 * Prevents inflating view counts via repeated page refreshes.
 */
export const deckViews = pgTable('deck_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  deckId: uuid('deck_id').notNull().references(() => publishedDecks.id, { onDelete: 'cascade' }),
  /** Viewer identification — either userId (UUID) or hashed IP. */
  viewerKey: text('viewer_key').notNull(),
  /** Date string (YYYY-MM-DD) to allow one view count per viewer per day. */
  viewDate: text('view_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_deck_views_deck_viewer_date').on(table.deckId, table.viewerKey, table.viewDate),
]);

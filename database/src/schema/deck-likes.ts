import { pgTable, uuid, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { publishedDecks } from './published-decks.js';

export const deckLikes = pgTable('deck_likes', {
  userId: uuid('user_id').notNull().references(() => users.id),
  deckId: uuid('deck_id').notNull().references(() => publishedDecks.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.deckId] }),
]);

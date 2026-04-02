import { pgTable, uuid, text, integer, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const publishedDecks = pgTable('published_decks', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').notNull().references(() => users.id),
  /** Display name chosen by the publisher (not tied to authorId). */
  publisherName: text('publisher_name').notNull().default(''),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  deckCode: text('deck_code').notNull(),
  countryId: integer('country_id').notNull(),
  spec1Id: integer('spec1_id').notNull(),
  spec2Id: integer('spec2_id').notNull(),
  /** Full compressed deck data for server-side display / filtering. */
  deckData: jsonb('deck_data').notNull(),
  /** Array of DeckTag strings. */
  tags: jsonb('tags').notNull().$type<string[]>().default([]),
  viewCount: integer('view_count').notNull().default(0),
  likeCount: integer('like_count').notNull().default(0),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_published_decks_author').on(table.authorId),
  index('idx_published_decks_country').on(table.countryId),
  index('idx_published_decks_specs').on(table.spec1Id, table.spec2Id),
  index('idx_published_decks_like_count').on(table.likeCount),
  index('idx_published_decks_created_at').on(table.createdAt),
]);

import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { publishedDecks, deckLikes, deckViews } from '../schema/index.js';
import { eq, and, sql, desc, ilike } from 'drizzle-orm';
import { verifyChallenge } from './challenges.js';
import type {
  PublishDeckInput,
  UpdatePublishedDeckInput,
  DeletePublishedDeckInput,
  PublishedDeck,
  PublishedDeckSummary,
  BrowseDecksFilter,
  BrowseDecksResult,
  BrowseDeckSort,
  ToggleLikeResult,
  RecordViewResult,
  DeckTag,
} from '@ba-hub/shared';
import { DECK_TAGS } from '@ba-hub/shared';

// ── Helpers ──────────────────────────────────────────────────────

const SUMMARY_COLUMNS = {
  id: publishedDecks.id,
  authorId: publishedDecks.authorId,
  name: publishedDecks.name,
  description: publishedDecks.description,
  deckCode: publishedDecks.deckCode,
  countryId: publishedDecks.countryId,
  spec1Id: publishedDecks.spec1Id,
  spec2Id: publishedDecks.spec2Id,
  tags: publishedDecks.tags,
  viewCount: publishedDecks.viewCount,
  likeCount: publishedDecks.likeCount,
  createdAt: publishedDecks.createdAt,
  updatedAt: publishedDecks.updatedAt,
} as const;

function toSummary(row: any): PublishedDeckSummary {
  return {
    id: row.id,
    authorId: row.authorId,
    name: row.name,
    description: row.description,
    deckCode: row.deckCode,
    countryId: row.countryId,
    spec1Id: row.spec1Id,
    spec2Id: row.spec2Id,
    tags: row.tags as DeckTag[],
    viewCount: row.viewCount,
    likeCount: row.likeCount,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

function toFullDeck(row: any): PublishedDeck {
  return {
    ...toSummary(row),
    deckData: row.deckData as PublishedDeck['deckData'],
  };
}

function validateTags(tags: unknown): DeckTag[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t): t is DeckTag => DECK_TAGS.includes(t as DeckTag));
}

// ── Routes ───────────────────────────────────────────────────────

export async function registerDeckRoutes(app: FastifyInstance) {

  // ── Publish a new deck ───────────────────────────────────────
  app.post<{ Body: PublishDeckInput; Reply: PublishedDeck }>('/', {
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    const body = req.body;

    // Validate challenge
    const valid = await verifyChallenge(body.challengeId, body.challengeAnswer);
    if (!valid) {
      return reply.status(403).send({ error: 'Challenge failed or expired' } as any);
    }

    // Validate tags
    const tags = validateTags(body.tags);

    // Validate required fields
    if (!body.authorId || !body.name?.trim() || !body.deckCode) {
      return reply.status(400).send({ error: 'Missing required fields' } as any);
    }

    if (body.name.length > 100) {
      return reply.status(400).send({ error: 'Name must be 100 characters or less' } as any);
    }

    if (body.description && body.description.length > 500) {
      return reply.status(400).send({ error: 'Description must be 500 characters or less' } as any);
    }

    const [row] = await db.insert(publishedDecks).values({
      authorId: body.authorId,
      name: body.name.trim(),
      description: (body.description ?? '').trim(),
      deckCode: body.deckCode,
      countryId: body.countryId,
      spec1Id: body.spec1Id,
      spec2Id: body.spec2Id,
      deckData: body.deckData,
      tags,
    }).returning();

    return reply.status(201).send(toFullDeck(row));
  });

  // ── Update a published deck ──────────────────────────────────
  app.put<{
    Params: { id: string };
    Body: UpdatePublishedDeckInput & { authorId: string };
    Reply: PublishedDeck;
  }>('/:id', {
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    const { id } = req.params;
    const body = req.body;

    // Validate challenge
    const valid = await verifyChallenge(body.challengeId, body.challengeAnswer);
    if (!valid) {
      return reply.status(403).send({ error: 'Challenge failed or expired' } as any);
    }

    // Verify ownership
    const [existing] = await db.select({ authorId: publishedDecks.authorId })
      .from(publishedDecks)
      .where(and(eq(publishedDecks.id, id), eq(publishedDecks.isDeleted, false)))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: 'Deck not found' } as any);
    }
    if (existing.authorId !== body.authorId) {
      return reply.status(403).send({ error: 'Not the deck owner' } as any);
    }

    // Build update set
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) {
      if (body.name.length > 100) {
        return reply.status(400).send({ error: 'Name must be 100 characters or less' } as any);
      }
      updates.name = body.name.trim();
    }
    if (body.description !== undefined) {
      if (body.description.length > 500) {
        return reply.status(400).send({ error: 'Description must be 500 characters or less' } as any);
      }
      updates.description = body.description.trim();
    }
    if (body.deckCode !== undefined) updates.deckCode = body.deckCode;
    if (body.deckData !== undefined) updates.deckData = body.deckData;
    if (body.tags !== undefined) updates.tags = validateTags(body.tags);

    const [row] = await db.update(publishedDecks)
      .set(updates)
      .where(eq(publishedDecks.id, id))
      .returning();

    return reply.send(toFullDeck(row));
  });

  // ── Delete a published deck (soft) ───────────────────────────
  app.delete<{
    Params: { id: string };
    Body: DeletePublishedDeckInput;
  }>('/:id', async (req, reply) => {
    const { id } = req.params;
    const body = req.body;

    const valid = await verifyChallenge(body.challengeId, body.challengeAnswer);
    if (!valid) {
      return reply.status(403).send({ error: 'Challenge failed or expired' } as any);
    }

    const [existing] = await db.select({ authorId: publishedDecks.authorId })
      .from(publishedDecks)
      .where(and(eq(publishedDecks.id, id), eq(publishedDecks.isDeleted, false)))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: 'Deck not found' } as any);
    }
    if (existing.authorId !== body.authorId) {
      return reply.status(403).send({ error: 'Not the deck owner' } as any);
    }

    await db.update(publishedDecks)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(publishedDecks.id, id));

    return reply.status(204).send();
  });

  // ── Get single deck ──────────────────────────────────────────
  app.get<{ Params: { id: string }; Reply: PublishedDeck }>('/:id', async (req, reply) => {
    const { id } = req.params;

    const [row] = await db.select()
      .from(publishedDecks)
      .where(and(eq(publishedDecks.id, id), eq(publishedDecks.isDeleted, false)))
      .limit(1);

    if (!row) {
      return reply.status(404).send({ error: 'Deck not found' } as any);
    }

    return reply.send(toFullDeck(row));
  });

  // ── Browse / search ──────────────────────────────────────────
  app.get<{ Querystring: BrowseDecksFilter; Reply: BrowseDecksResult }>('/', async (req, reply) => {
    const {
      countryId,
      spec1Id,
      spec2Id,
      tags: tagsParam,
      search,
      authorId,
      sort = 'recent',
      page = 1,
      pageSize: rawPageSize = 20,
    } = req.query;

    const pageSize = Math.min(Math.max(Number(rawPageSize) || 20, 1), 50);
    const pageNum = Math.max(Number(page) || 1, 1);
    const offset = (pageNum - 1) * pageSize;

    // Build WHERE conditions
    const conditions = [eq(publishedDecks.isDeleted, false)];

    if (countryId !== undefined) {
      conditions.push(eq(publishedDecks.countryId, Number(countryId)));
    }
    if (spec1Id !== undefined) {
      conditions.push(eq(publishedDecks.spec1Id, Number(spec1Id)));
    }
    if (spec2Id !== undefined) {
      conditions.push(eq(publishedDecks.spec2Id, Number(spec2Id)));
    }
    if (authorId) {
      conditions.push(eq(publishedDecks.authorId, authorId));
    }
    if (search && typeof search === 'string' && search.trim()) {
      conditions.push(ilike(publishedDecks.name, `%${search.trim()}%`));
    }

    // Tag filtering — deck must contain ALL specified tags
    if (tagsParam) {
      const tagList = (Array.isArray(tagsParam) ? tagsParam : [tagsParam]) as string[];
      const validTags = validateTags(tagList);
      for (const tag of validTags) {
        conditions.push(sql`${publishedDecks.tags} @> ${JSON.stringify([tag])}::jsonb`);
      }
    }

    const where = and(...conditions);

    // Sort
    let orderBy;
    switch (sort as BrowseDeckSort) {
      case 'mostLiked':
        orderBy = desc(publishedDecks.likeCount);
        break;
      case 'popular':
        orderBy = desc(publishedDecks.viewCount);
        break;
      case 'recent':
      default:
        orderBy = desc(publishedDecks.createdAt);
    }

    // Count total
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(publishedDecks)
      .where(where);

    const total = countResult?.count ?? 0;

    // Fetch page
    const rows = await db
      .select(SUMMARY_COLUMNS)
      .from(publishedDecks)
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset);

    return reply.send({
      decks: rows.map(toSummary),
      total,
      page: pageNum,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  });

  // ── Toggle like ──────────────────────────────────────────────
  app.post<{
    Params: { id: string };
    Body: { userId: string };
    Reply: ToggleLikeResult;
  }>('/:id/like', async (req, reply) => {
    const { id: deckId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' } as any);
    }

    // Check if deck exists
    const [deck] = await db.select({ id: publishedDecks.id })
      .from(publishedDecks)
      .where(and(eq(publishedDecks.id, deckId), eq(publishedDecks.isDeleted, false)))
      .limit(1);

    if (!deck) {
      return reply.status(404).send({ error: 'Deck not found' } as any);
    }

    // Check existing like
    const [existingLike] = await db.select()
      .from(deckLikes)
      .where(and(eq(deckLikes.userId, userId), eq(deckLikes.deckId, deckId)))
      .limit(1);

    if (existingLike) {
      // Unlike
      await db.delete(deckLikes)
        .where(and(eq(deckLikes.userId, userId), eq(deckLikes.deckId, deckId)));
      await db.update(publishedDecks)
        .set({ likeCount: sql`GREATEST(${publishedDecks.likeCount} - 1, 0)` })
        .where(eq(publishedDecks.id, deckId));
    } else {
      // Like
      await db.insert(deckLikes).values({ userId, deckId });
      await db.update(publishedDecks)
        .set({ likeCount: sql`${publishedDecks.likeCount} + 1` })
        .where(eq(publishedDecks.id, deckId));
    }

    // Return updated count
    const [updated] = await db.select({ likeCount: publishedDecks.likeCount })
      .from(publishedDecks)
      .where(eq(publishedDecks.id, deckId))
      .limit(1);

    return reply.send({
      liked: !existingLike,
      newLikeCount: updated?.likeCount ?? 0,
    });
  });

  // ── Check like status ────────────────────────────────────────
  app.get<{
    Params: { id: string };
    Querystring: { userId: string };
    Reply: { liked: boolean };
  }>('/:id/like', async (req, reply) => {
    const { id: deckId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return reply.send({ liked: false });
    }

    const [row] = await db.select()
      .from(deckLikes)
      .where(and(eq(deckLikes.userId, userId), eq(deckLikes.deckId, deckId)))
      .limit(1);

    return reply.send({ liked: !!row });
  });

  // ── Record view ──────────────────────────────────────────────
  app.post<{
    Params: { id: string };
    Body: { viewerKey?: string };
    Reply: RecordViewResult;
  }>('/:id/view', async (req, reply) => {
    const { id: deckId } = req.params;
    const viewerKey = req.body.viewerKey ?? req.ip;
    const viewDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Check if deck exists
    const [deck] = await db.select({ id: publishedDecks.id, viewCount: publishedDecks.viewCount })
      .from(publishedDecks)
      .where(and(eq(publishedDecks.id, deckId), eq(publishedDecks.isDeleted, false)))
      .limit(1);

    if (!deck) {
      return reply.status(404).send({ error: 'Deck not found' } as any);
    }

    // Check if already viewed today by this viewer
    const [existingView] = await db.select()
      .from(deckViews)
      .where(and(
        eq(deckViews.deckId, deckId),
        eq(deckViews.viewerKey, viewerKey),
        eq(deckViews.viewDate, viewDate),
      ))
      .limit(1);

    if (!existingView) {
      // Record view + increment counter
      await db.insert(deckViews).values({ deckId, viewerKey, viewDate });
      await db.update(publishedDecks)
        .set({ viewCount: sql`${publishedDecks.viewCount} + 1` })
        .where(eq(publishedDecks.id, deckId));

      const [updated] = await db.select({ viewCount: publishedDecks.viewCount })
        .from(publishedDecks)
        .where(eq(publishedDecks.id, deckId))
        .limit(1);

      return reply.send({ newViewCount: updated?.viewCount ?? deck.viewCount + 1 });
    }

    return reply.send({ newViewCount: deck.viewCount });
  });

  // ── Get decks by author (convenience) ────────────────────────
  app.get<{
    Params: { authorId: string };
    Reply: PublishedDeckSummary[];
  }>('/author/:authorId', async (req, reply) => {
    const { authorId } = req.params;

    const rows = await db
      .select(SUMMARY_COLUMNS)
      .from(publishedDecks)
      .where(and(
        eq(publishedDecks.authorId, authorId),
        eq(publishedDecks.isDeleted, false),
      ))
      .orderBy(desc(publishedDecks.updatedAt));

    return reply.send(rows.map(toSummary));
  });
}

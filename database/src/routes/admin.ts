import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../db.js';

/**
 * Read-only admin routes for database inspection.
 * Protected by a bearer token (DB_ADMIN_SECRET env var).
 *
 * If DB_ADMIN_SECRET is not set, all admin routes return 503.
 */

const ADMIN_SECRET = process.env.DB_ADMIN_SECRET || '';

function authenticate(req: FastifyRequest, reply: FastifyReply): boolean {
  if (!ADMIN_SECRET) {
    reply.status(503).send({ error: 'Admin interface not configured' });
    return false;
  }
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${ADMIN_SECRET}`) {
    reply.status(401).send({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export async function registerAdminRoutes(app: FastifyInstance) {
  /**
   * GET /api/admin/tables — list all tables with row counts and column info.
   */
  app.get('/tables', async (req, reply) => {
    if (!authenticate(req, reply)) return;

    const tables = await sql`
      SELECT
        t.table_name,
        (SELECT count(*)::int FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count,
        pg_stat_user_tables.n_live_tup::int as row_count
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables ON pg_stat_user_tables.relname = t.table_name
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `;

    return { tables };
  });

  /**
   * GET /api/admin/table/:name — get column definitions for a table.
   */
  app.get<{ Params: { name: string } }>('/table/:name', async (req, reply) => {
    if (!authenticate(req, reply)) return;

    const { name } = req.params;
    // Validate table name to prevent injection
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
      return reply.status(400).send({ error: 'Invalid table name' });
    }

    const columns = await sql`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${name}
      ORDER BY ordinal_position
    `;

    if (columns.length === 0) {
      return reply.status(404).send({ error: 'Table not found' });
    }

    // Get row count
    const countResult = await sql.unsafe(`SELECT count(*)::int as count FROM "${name}"`);
    const rowCount = countResult[0]?.count ?? 0;

    // Get indexes
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ${name}
    `;

    return { name, columns, rowCount, indexes };
  });

  /**
   * GET /api/admin/table/:name/rows?limit=50&offset=0&sort=column&order=asc
   * Browse table data (read-only). Maximum 200 rows per request.
   */
  app.get<{
    Params: { name: string };
    Querystring: { limit?: string; offset?: string; sort?: string; order?: string };
  }>('/table/:name/rows', async (req, reply) => {
    if (!authenticate(req, reply)) return;

    const { name } = req.params;
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
      return reply.status(400).send({ error: 'Invalid table name' });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const sortCol = req.query.sort;
    const sortOrder = req.query.order === 'desc' ? 'DESC' : 'ASC';

    // Validate sort column exists
    let orderClause = '';
    if (sortCol && /^[a-z_][a-z0-9_]*$/.test(sortCol)) {
      const colExists = await sql`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${name} AND column_name = ${sortCol}
      `;
      if (colExists.length > 0) {
        orderClause = `ORDER BY "${sortCol}" ${sortOrder}`;
      }
    }

    const rows = await sql.unsafe(
      `SELECT * FROM "${name}" ${orderClause} LIMIT ${limit} OFFSET ${offset}`,
    );

    const countResult = await sql.unsafe(`SELECT count(*)::int as count FROM "${name}"`);
    const total = countResult[0]?.count ?? 0;

    return { name, rows, total, limit, offset };
  });

  /**
   * GET /api/admin/query?q=SELECT...
   * Execute an arbitrary read-only SQL query.
   * Only SELECT statements are allowed.
   */
  app.get<{
    Querystring: { q: string };
  }>('/query', async (req, reply) => {
    if (!authenticate(req, reply)) return;

    const query = (req.query.q ?? '').trim();
    if (!query) {
      return reply.status(400).send({ error: 'Query parameter q is required' });
    }

    // Only allow SELECT and WITH (CTE) statements
    const normalized = query.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim().toUpperCase();
    if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
      return reply.status(403).send({ error: 'Only SELECT queries are allowed' });
    }

    // Block dangerous patterns
    const blocked = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY)\b/i;
    if (blocked.test(query)) {
      return reply.status(403).send({ error: 'Write operations are not allowed' });
    }

    try {
      const rows = await sql.unsafe(query);
      return { rows, count: rows.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: message });
    }
  });

  /**
   * GET /api/admin/stats — database-level statistics.
   */
  app.get('/stats', async (req, reply) => {
    if (!authenticate(req, reply)) return;

    const dbSize = await sql`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
    const tableStats = await sql`
      SELECT
        relname as table_name,
        n_live_tup::int as row_count,
        pg_size_pretty(pg_total_relation_size(relid)) as total_size,
        pg_size_pretty(pg_indexes_size(relid)) as index_size,
        last_vacuum,
        last_autovacuum,
        last_analyze
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(relid) DESC
    `;

    const connInfo = await sql`
      SELECT count(*)::int as active_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;

    return {
      databaseSize: dbSize[0]?.size,
      activeConnections: connInfo[0]?.active_connections,
      tables: tableStats,
    };
  });
}

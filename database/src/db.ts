import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://bahub:bahub_dev@localhost:5432/bahub';

/** Low-level postgres.js connection. */
export const sql = postgres(DATABASE_URL);

/** Drizzle ORM instance with full schema typing. */
export const db = drizzle(sql, { schema });

export type Database = typeof db;

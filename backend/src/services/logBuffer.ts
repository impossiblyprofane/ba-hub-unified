/**
 * In-memory ring buffers for backend log lines.
 *
 * Plugged into Fastify's Pino logger via a tee `Writable` that forwards each
 * NDJSON chunk to both stdout (so normal logging is preserved) and three
 * in-memory ring buffers:
 *
 *   - `ring`     — main buffer, default 1000 entries, all levels
 *   - `errorRing` — smaller buffer, default 100 entries, only level ≥ warn
 *   - `slowRing` — tracks HTTP requests whose `responseTime` exceeded a
 *                  threshold, so operators can review slow routes without
 *                  scrolling through the full log
 *
 * Each entry also carries a `cat` (category) field derived either from an
 * explicit child-logger binding (e.g. `log.child({ cat: 'crawler' })`) or
 * auto-assigned from Pino's HTTP request shape (`req`/`res` fields → `http`).
 *
 * Pure stdlib — no extra deps. Pino numeric levels:
 *   10 trace, 20 debug, 30 info, 40 warn, 50 error, 60 fatal
 */

import { Writable } from 'node:stream';

export interface LogEntry {
  /** Epoch ms */
  ts: number;
  /** Pino numeric level (10/20/30/40/50/60) */
  level: number;
  /** Lowercase level name */
  levelName: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'unknown';
  /** Primary message */
  msg: string;
  /** Category tag ('crawler', 'http', 'admin', …). */
  cat?: string;
  /** Any other fields from the Pino record */
  extra?: Record<string, unknown>;
}

/** Slow-HTTP-request record captured when responseTime > threshold. */
export interface SlowRequestEntry {
  ts: number;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  reqId?: string;
}

const LEVEL_NAMES: Record<number, LogEntry['levelName']> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

/** Numeric thresholds for `minLevel` queries. */
export const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
} as const;

export type LogLevelName = keyof typeof LOG_LEVELS;

export interface GetRecentOptions {
  limit?: number;
  /** Only return entries strictly newer than this epoch ms */
  sinceTs?: number;
  /** Filter to entries at this Pino level or higher (e.g. 40 = warn+) */
  minLevel?: number;
  /** Filter to entries with a specific category tag. */
  cat?: string;
}

export interface LogBuffer {
  /** Tee `Writable` to be passed as Fastify's `logger.stream`. */
  stream: Writable;
  /** Returns recent entries (main ring) newest-first. */
  getRecent(opts?: GetRecentOptions): LogEntry[];
  /** Returns recent entries from the warn+ error ring, newest-first. */
  getErrors(limit?: number): LogEntry[];
  /** Returns slow-request entries newest-first. */
  getSlow(limit?: number): SlowRequestEntry[];
  /** Record a slow request. Called directly from a Fastify onResponse hook. */
  recordSlow(entry: SlowRequestEntry): void;
  /** List of categories currently present in the main ring. */
  categories(): string[];
  /** Subscribe to new entries (main ring). Returns an unsubscribe function. */
  subscribe(cb: (entry: LogEntry) => void): () => void;
  /** Current main buffer size, for diagnostics. */
  size(): number;
  /** Error ring size. */
  errorSize(): number;
  /** Slow request ring size. */
  slowSize(): number;
}

/**
 * Auto-assign a category tag to entries that don't already have one.
 * Fastify emits HTTP request/response logs with `req`/`res` fields; we tag
 * those as `http` so the category filter can separate them from app logs.
 */
function autoCategory(entry: LogEntry): string | undefined {
  if (entry.cat) return entry.cat;
  const extra = entry.extra;
  if (extra && (extra.req !== undefined || extra.res !== undefined)) return 'http';
  return undefined;
}

/**
 * Create a new log buffer with the given capacity.
 *
 * @param maxEntries      - main ring capacity (default 1000)
 * @param maxErrorEntries - error-only ring capacity (default 100)
 * @param maxSlowEntries  - slow-request ring capacity (default 50)
 * @param teeStdout       - if true (default), also forward each chunk to process.stdout
 */
export function createLogBuffer(
  maxEntries = 1000,
  maxErrorEntries = 100,
  maxSlowEntries = 50,
  teeStdout = true,
): LogBuffer {
  const ring: LogEntry[] = [];
  const errorRing: LogEntry[] = [];
  const slowRing: SlowRequestEntry[] = [];
  const subscribers = new Set<(entry: LogEntry) => void>();
  let pending = '';

  function push(entry: LogEntry) {
    ring.push(entry);
    if (ring.length > maxEntries) ring.shift();
    if (entry.level >= LOG_LEVELS.warn) {
      errorRing.push(entry);
      if (errorRing.length > maxErrorEntries) errorRing.shift();
    }
    for (const cb of subscribers) {
      try {
        cb(entry);
      } catch {
        // Subscribers must not break the logger
      }
    }
  }

  function ingestLine(line: string) {
    if (!line) return;
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch {
      // Non-JSON line (rare — direct console.log etc) — store as raw msg
      push({
        ts: Date.now(),
        level: 30,
        levelName: 'info',
        msg: line,
      });
      return;
    }

    const level = typeof parsed.level === 'number' ? parsed.level : 30;
    const ts = typeof parsed.time === 'number' ? parsed.time : Date.now();
    const msg =
      typeof parsed.msg === 'string'
        ? parsed.msg
        : typeof parsed.message === 'string'
          ? (parsed.message as string)
          : '';
    const catRaw = parsed.cat;
    const cat = typeof catRaw === 'string' ? catRaw : undefined;

    // Strip well-known top-level fields from `extra`
    const extra: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (
        k === 'level' ||
        k === 'time' ||
        k === 'msg' ||
        k === 'message' ||
        k === 'pid' ||
        k === 'hostname' ||
        k === 'v' ||
        k === 'cat'
      )
        continue;
      extra[k] = v;
    }

    const entry: LogEntry = {
      ts,
      level,
      levelName: LEVEL_NAMES[level] ?? 'unknown',
      msg,
      cat,
      extra: Object.keys(extra).length > 0 ? extra : undefined,
    };
    // Backfill category from Pino's HTTP shape if not explicit
    entry.cat = autoCategory(entry);
    push(entry);
  }

  const stream = new Writable({
    write(chunk: Buffer | string, _enc, cb) {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
      if (teeStdout) {
        process.stdout.write(text);
      }

      // NDJSON: split on newlines, carry partial line forward
      pending += text;
      let nlIdx: number;
      while ((nlIdx = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, nlIdx).trim();
        pending = pending.slice(nlIdx + 1);
        if (line) ingestLine(line);
      }

      cb();
    },
  });

  return {
    stream,
    getRecent(opts: GetRecentOptions = {}): LogEntry[] {
      const { limit = 200, sinceTs, minLevel, cat } = opts;
      let result = ring;
      if (sinceTs !== undefined) result = result.filter((e) => e.ts > sinceTs);
      if (minLevel !== undefined) result = result.filter((e) => e.level >= minLevel);
      if (cat) result = result.filter((e) => e.cat === cat);
      const start = Math.max(0, result.length - limit);
      return result.slice(start).reverse();
    },
    getErrors(limit = 100): LogEntry[] {
      const start = Math.max(0, errorRing.length - limit);
      return errorRing.slice(start).reverse();
    },
    getSlow(limit = 50): SlowRequestEntry[] {
      const start = Math.max(0, slowRing.length - limit);
      return slowRing.slice(start).reverse();
    },
    recordSlow(entry: SlowRequestEntry) {
      slowRing.push(entry);
      if (slowRing.length > maxSlowEntries) slowRing.shift();
    },
    categories() {
      const set = new Set<string>();
      for (const e of ring) if (e.cat) set.add(e.cat);
      return [...set].sort();
    },
    subscribe(cb) {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
    size() {
      return ring.length;
    },
    errorSize() {
      return errorRing.length;
    },
    slowSize() {
      return slowRing.length;
    },
  };
}

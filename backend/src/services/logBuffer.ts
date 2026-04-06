/**
 * In-memory ring buffer for backend log lines.
 *
 * Plugged into Fastify's Pino logger via a tee `Writable` that forwards each
 * NDJSON chunk to both stdout (so normal logging is preserved) and the
 * buffer (so the admin panel can tail and replay recent activity).
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
  /** Any other fields from the Pino record */
  extra?: Record<string, unknown>;
}

const LEVEL_NAMES: Record<number, LogEntry['levelName']> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

export interface GetRecentOptions {
  limit?: number;
  /** Only return entries strictly newer than this epoch ms */
  sinceTs?: number;
  /** Filter to entries at this Pino level or higher (e.g. 40 = warn+) */
  minLevel?: number;
}

export interface LogBuffer {
  /** Tee `Writable` to be passed as Fastify's `logger.stream`. */
  stream: Writable;
  /** Returns recent entries newest-first. */
  getRecent(opts?: GetRecentOptions): LogEntry[];
  /** Subscribe to new entries. Returns an unsubscribe function. */
  subscribe(cb: (entry: LogEntry) => void): () => void;
  /** Current buffer size, for diagnostics. */
  size(): number;
}

/**
 * Create a new log buffer with the given capacity.
 *
 * @param maxEntries - ring-buffer capacity (default 1000)
 * @param teeStdout  - if true (default), also forward each chunk to process.stdout
 */
export function createLogBuffer(maxEntries = 1000, teeStdout = true): LogBuffer {
  const ring: LogEntry[] = [];
  const subscribers = new Set<(entry: LogEntry) => void>();
  let pending = '';

  function push(entry: LogEntry) {
    ring.push(entry);
    if (ring.length > maxEntries) ring.shift();
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

    // Strip well-known top-level fields from `extra`
    const extra: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (k === 'level' || k === 'time' || k === 'msg' || k === 'message' || k === 'pid' || k === 'hostname' || k === 'v') continue;
      extra[k] = v;
    }

    push({
      ts,
      level,
      levelName: LEVEL_NAMES[level] ?? 'unknown',
      msg,
      extra: Object.keys(extra).length > 0 ? extra : undefined,
    });
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
      const { limit = 200, sinceTs, minLevel } = opts;
      let result = ring;
      if (sinceTs !== undefined) result = result.filter((e) => e.ts > sinceTs);
      if (minLevel !== undefined) result = result.filter((e) => e.level >= minLevel);
      // Newest first, capped
      const start = Math.max(0, result.length - limit);
      return result.slice(start).reverse();
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
  };
}

/**
 * Type definitions for admin REST responses (frontend mirror of backend
 * `/admin/*` shapes). Hand-maintained — kept narrow to what the panel
 * actually consumes.
 */

export interface LogEntry {
  ts: number;
  level: number;
  levelName: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'unknown';
  msg: string;
  /** Category tag auto-derived on the backend (http, crawler, collector, …) */
  cat?: string;
  extra?: Record<string, unknown>;
}

export interface DatabaseHealth {
  reachable: boolean;
  latencyMs?: number;
  error?: string;
  status?: string;
}

export interface FilesystemEntry {
  mount: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  pctUsed: number;
  error?: string;
}

export interface OsInfo {
  hostname: string;
  platform: string;
  release: string;
  arch: string;
  cpus: number;
  totalMemMb: number;
  freeMemMb: number;
  usedMemPct: number;
  loadAvg: number[];
}

export interface HealthReport {
  backend: {
    uptimeSec: number;
    nodeVersion: string;
    pid: number;
    memoryMb: { rss: number; heapTotal: number; heapUsed: number };
  };
  database: DatabaseHealth;
  staticData: Record<string, number>;
  env: Record<string, string>;
  logBuffer: { size: number; errorSize: number; slowSize: number };
  os: OsInfo;
  filesystem: FilesystemEntry[];
}

// ── Metrics ────────────────────────────────────────────────
export interface RouteMetric {
  key: string;
  method: string;
  route: string;
  total: number;
  count2xx: number;
  count3xx: number;
  count4xx: number;
  count5xx: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  maxDurationMs: number;
  lastStatus: number;
  lastDurationMs: number;
  lastAt: number;
}

export interface RoutesResponse {
  routes: RouteMetric[];
  slowThresholdMs: number;
}

export interface OutboundCategoryMetric {
  category: string;
  calls: number;
  errors: number;
  errorRate: number;
  avgDurationMs: number;
  maxDurationMs: number;
  lastStatus: number;
  lastDurationMs: number;
  lastError: string | null;
  lastAt: number;
  lastErrorAt: number | null;
}

export interface OutboundResponse {
  categories: OutboundCategoryMetric[];
}

export interface GraphqlOperationMetric {
  name: string;
  calls: number;
  errors: number;
  errorRate: number;
  avgDurationMs: number;
  maxDurationMs: number;
  lastAt: number;
  lastErrorAt: number | null;
  lastError: string | null;
}

export interface GraphqlResponse {
  operations: GraphqlOperationMetric[];
}

export interface SlowRequestEntry {
  ts: number;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  reqId?: string;
}

export interface SlowRequestsResponse {
  entries: SlowRequestEntry[];
  thresholdMs: number;
}

export interface LogsResponse {
  entries: LogEntry[];
  categories: string[];
  size: number;
  errorSize: number;
  slowSize: number;
}

export interface LogErrorsResponse {
  entries: LogEntry[];
}

export interface LogLevelResponse {
  ok: true;
  previous: string;
  current: string;
}

export interface TableSummary {
  table_name: string;
  column_count: number;
  row_count: number | null;
}

export interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
  character_maximum_length: number | null;
}

export interface TableIndex {
  indexname: string;
  indexdef: string;
}

export interface TableDetail {
  name: string;
  columns: TableColumn[];
  rowCount: number;
  indexes: TableIndex[];
}

export interface TableRowsResponse {
  name: string;
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
}

export interface CrawlerStatusOk {
  available: true;
  state: {
    scanFloor: number;
    scanCeiling: number;
    scanPosition: number;
    initialCollectionDone: boolean;
    updatedAt: string | null;
  };
}

export interface CrawlerStatusUnavailable {
  available: false;
  message: string;
  error?: string;
}

export type CrawlerStatus = CrawlerStatusOk | CrawlerStatusUnavailable;

export interface CrawlerSummaryStats {
  total: number;
  ranked: number;
  unranked: number;
  last_hour: number;
  last_day: number;
  last_week: number;
  last_processed: string | null;
  first_processed: string | null;
  min_fight: number | null;
  max_fight: number | null;
}

export interface CrawlerRecentMatch {
  fight_id: number;
  map_name: string | null;
  is_ranked: boolean;
  winner_team: number | null;
  player_count: number;
  // postgres bigint is serialized as a string in JSON
  end_time: number | string | null;
  processed_at: string;
}

export interface CollectResult {
  playerFights: number;
  rangeScan: number;
  newMatches: number;
}

export interface CrawlerConfig {
  batchSize: number;
  playerCount: number;
  chunkSize: number;
  batchDelayMs: number;
  saveInterval: number;
  errorBudget: number;
  lastRunAt: number | null;
  lastRunDurationMs: number | null;
  lastRunResult: CollectResult | null;
  lastRunError: string | null;
}

export interface CrawlerSummaryOk {
  available: true;
  stats: CrawlerSummaryStats;
  recent: CrawlerRecentMatch[];
  state: CrawlerStatusOk['state'] | null;
  config: CrawlerConfig;
  busy: boolean;
}

export interface CrawlerSummaryUnavailable extends CrawlerStatusUnavailable {
  config: CrawlerConfig;
  busy: boolean;
}

export type CrawlerSummary = CrawlerSummaryOk | CrawlerSummaryUnavailable;

export interface CrawlerRunStarted {
  ok: true;
  started: true;
}

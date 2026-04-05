#!/usr/bin/env npx tsx
/**
 * Standalone pre-seed script for the match crawler.
 *
 * Usage:
 *   npx tsx scripts/crawler-seed.ts [--discover-only] [--chunk-size=N] [--target=URL]
 *
 * Env vars (overridden by CLI flags):
 *   DATABASE_SERVICE_URL  (default: http://localhost:3002)
 *   STATS_API_URL         (default: https://api.brokenarrowgame.tech)
 *   STATS_PARTNER_TOKEN   (default: '')
 *
 * Examples:
 *   # Local dev (default)
 *   npx tsx scripts/crawler-seed.ts
 *
 *   # Against a remote / prod database service
 *   npx tsx scripts/crawler-seed.ts --target=https://db.ba-hub.net
 *
 *   # Discovery only against remote, custom chunk size
 *   npx tsx scripts/crawler-seed.ts --target=https://db.ba-hub.net --discover-only --chunk-size=2000
 *
 * Requires:
 *   - Target database service running and reachable
 *   - Migration 0006 applied (new columns on match tables)
 *
 * This script reuses the same MatchCrawler class used at runtime,
 * but runs outside the backend server process. It:
 *   1. Loads static game data (units, countries, specializations)
 *   2. Runs initial discovery: leaderboard → fight IDs → binary search for S3 floor
 *   3. Sets up crawler state in the database
 *   4. Optionally runs a first range-scan chunk
 *
 * After the seed completes, the backend's normal crawler loop takes over.
 */

import { loadStaticData } from '../backend/src/data/loader.js';
import { buildIndexes } from '../backend/src/data/indexes.js';
import { DatabaseClient } from '../backend/src/services/databaseClient.js';
import { MatchCrawler } from '../backend/src/services/matchCrawler.js';

const TARGET_ARG = process.argv.find((a) => a.startsWith('--target='));
const DATABASE_SERVICE_URL = TARGET_ARG
  ? TARGET_ARG.split('=').slice(1).join('=')   // allow URLs with '=' in query strings
  : process.env.DATABASE_SERVICE_URL || 'http://localhost:3002';

const DISCOVER_ONLY = process.argv.includes('--discover-only');
const CHUNK_SIZE_ARG = process.argv.find((a) => a.startsWith('--chunk-size='));
const CHUNK_SIZE = CHUNK_SIZE_ARG ? parseInt(CHUNK_SIZE_ARG.split('=')[1], 10) : 5000;

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║         BA Hub — Crawler Pre-Seed            ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log();
  console.log(`Database service: ${DATABASE_SERVICE_URL}`);
  console.log(`Chunk size:       ${CHUNK_SIZE}`);
  console.log(`Mode:             ${DISCOVER_ONLY ? 'discover-only' : 'discover + first chunk'}`);
  console.log();

  // ── Step 1: Verify database service is reachable ──────────
  console.log('[1/4] Checking database service...');
  try {
    const healthRes = await fetch(`${DATABASE_SERVICE_URL}/api/crawler/state`);
    if (!healthRes.ok) {
      console.error(`Database service returned ${healthRes.status}. Is it running?`);
      process.exit(1);
    }
    const state = (await healthRes.json()) as {
      scanFloor: number;
      scanCeiling: number;
      scanPosition: number;
      initialCollectionDone: boolean;
    };
    console.log(`  Current state: floor=${state.scanFloor} ceiling=${state.scanCeiling} pos=${state.scanPosition} initial=${state.initialCollectionDone}`);

    if (state.initialCollectionDone) {
      console.log();
      console.log('⚠  Initial collection is already marked as done.');
      console.log('   The crawler will just continue range scanning from its current position.');
      console.log('   If you want to re-seed, reset the crawler state first:');
      console.log(`   curl -X PUT ${DATABASE_SERVICE_URL}/api/crawler/state -H "Content-Type: application/json" -d '{"initialCollectionDone":false,"scanPosition":0,"scanFloor":0,"scanCeiling":0}'`);
      console.log();
      if (DISCOVER_ONLY) {
        console.log('Exiting (discover-only mode, already seeded).');
        process.exit(0);
      }
    }
  } catch (err) {
    console.error(`Cannot reach database service at ${DATABASE_SERVICE_URL}:`, err);
    process.exit(1);
  }

  // ── Step 2: Load static data ──────────────────────────────
  console.log('[2/4] Loading static game data...');
  const data = await loadStaticData();
  const indexes = buildIndexes(data);
  console.log(`  Loaded: ${data.units?.length ?? 0} units, ${data.countries?.length ?? 0} countries, ${data.specializations?.length ?? 0} specs`);

  // ── Step 3: Create crawler and run initial discovery ──────
  console.log('[3/4] Running initial discovery (leaderboard → fight IDs → binary search)...');
  const dbClient = new DatabaseClient(DATABASE_SERVICE_URL);

  const crawler = new MatchCrawler({
    dbClient,
    databaseServiceUrl: DATABASE_SERVICE_URL,
    indexes,
    data,
    batchSize: 10,
    playerCount: 30,
    chunkSize: CHUNK_SIZE,
  });

  const result = await crawler.collectMatches();
  console.log(`  Discovery result: ${result.playerFights} player fights, ${result.rangeScan} range scan, ${result.newMatches} total new matches`);

  // ── Step 4: Optionally run range scan chunks ──────────────
  if (!DISCOVER_ONLY) {
    console.log('[4/4] Running range scan chunks...');
    const progress = await crawler.getProgress();
    const totalRange = progress.ceiling - progress.floor;
    console.log(`  Range to scan: ${progress.floor} → ${progress.ceiling} (${totalRange.toLocaleString()} IDs)`);
    console.log(`  Current position: ${progress.position} (${progress.percentDone}% done)`);

    if (!progress.initialDone) {
      console.log('  Initial collection not done yet — skipping range scan.');
    } else {
      let chunkCount = 0;
      const MAX_CHUNKS = 50; // Safety limit — don't run forever

      while (chunkCount < MAX_CHUNKS) {
        const chunkResult = await crawler.scanRangeChunk();
        chunkCount++;
        const newProgress = await crawler.getProgress();
        console.log(
          `  Chunk ${chunkCount}: scanned=${chunkResult.scanned}, found=${chunkResult.found}, ` +
          `progress=${newProgress.percentDone}%`,
        );

        if (chunkResult.done) {
          console.log('  Range scan complete!');
          break;
        }

        // Brief pause between chunks
        await new Promise((r) => setTimeout(r, 500));
      }

      if (chunkCount >= MAX_CHUNKS) {
        console.log(`  Stopped after ${MAX_CHUNKS} chunks. Run the script again to continue.`);
      }
    }
  } else {
    console.log('[4/4] Skipped (discover-only mode).');
  }

  // ── Summary ───────────────────────────────────────────────
  const finalProgress = await crawler.getProgress();
  console.log();
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║               Seed Complete                  ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  Floor:    ${finalProgress.floor}`);
  console.log(`  Ceiling:  ${finalProgress.ceiling}`);
  console.log(`  Position: ${finalProgress.position}`);
  console.log(`  Progress: ${finalProgress.percentDone}%`);
  console.log(`  Initial:  ${finalProgress.initialDone}`);
  console.log();
  console.log('The backend crawler loop will continue scanning from here automatically.');
}

main().catch((err) => {
  console.error('Pre-seed failed:', err);
  process.exit(1);
});

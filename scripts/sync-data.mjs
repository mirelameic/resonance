import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

import { DECADES } from './lib/coverage.mjs';
import { mergeWorks } from './lib/mergeWorks.mjs';
import { isExcludedContent } from './lib/contentFilter.mjs';
import { applyEnrichment } from './lib/applyEnrichment.mjs';
import { mapWikidataFilmToWork } from './lib/mapWikidata.mjs';
import { loadSyncState, saveSyncState, getBucketProgress, recordBucketResult } from './lib/syncState.mjs';
import * as wikidata from './sources/wikidata.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REAL_DATA_FILE = join(__dirname, '..', 'js', 'data.js');
const REAL_ENRICHMENT_FILE = join(__dirname, '..', 'data', 'enrichment.json');
const REAL_SYNC_STATE_FILE = join(__dirname, '..', 'data', 'sync-state.json');

const TARGET_PER_DECADE_MOVIE = 50;
const RECENT_TARGET = 100;

export async function loadExistingWorks(dataFile) {
  if (!existsSync(dataFile)) return [];
  const mod = await import(`${pathToFileURL(dataFile).href}?t=${Date.now()}`);
  return mod.works || [];
}

export function loadEnrichment(enrichmentFile) {
  if (!existsSync(enrichmentFile)) return {};
  return JSON.parse(readFileSync(enrichmentFile, 'utf8'));
}

export function writeDataFile(dataFile, works) {
  writeFileSync(dataFile, `export const works = ${JSON.stringify(works, null, 2)};\n`, 'utf8');
}

export async function runBucket({ label, bucketKey, state, limit, query }) {
  const progress = getBucketProgress(state, bucketKey);
  if (progress.exhausted) {
    console.log(`[wikidata] ${label}: exhausted, skipping`);
    return { fresh: [], state };
  }
  try {
    const rows = await query(progress.offset);
    const nextState = recordBucketResult(state, bucketKey, rows.length, limit);
    const updated = nextState[bucketKey];
    console.log(`[wikidata] ${label}: +${rows.length} (offset now ${updated.offset}${updated.exhausted ? ', exhausted' : ''})`);
    return { fresh: rows, state: nextState };
  } catch (err) {
    console.warn(`[wikidata] ${label} failed at offset ${progress.offset}: ${err.message}`);
    return { fresh: [], state };
  }
}

async function fetchWikidataFull(enrichmentMap) {
  const fresh = [];
  let state = loadSyncState(REAL_SYNC_STATE_FILE);

  for (const { start, end } of DECADES) {
    const filmResult = await runBucket({
      label: `film ${start}-${end}`,
      bucketKey: `wikidata:film:${start}-${end}`,
      state,
      limit: TARGET_PER_DECADE_MOVIE,
      query: (offset) => wikidata.queryFilms({ startYear: start, endYear: end, limit: TARGET_PER_DECADE_MOVIE, offset }),
    });
    state = filmResult.state;
    for (const row of filmResult.fresh) {
      fresh.push(applyEnrichment(mapWikidataFilmToWork(row), enrichmentMap));
    }
    saveSyncState(REAL_SYNC_STATE_FILE, state);
  }
  return fresh;
}

async function fetchWikidataRecent(enrichmentMap) {
  const fresh = [];
  try {
    const filmRows = await wikidata.queryRecentFilms({ limit: RECENT_TARGET });
    for (const row of filmRows) {
      fresh.push(applyEnrichment(mapWikidataFilmToWork(row), enrichmentMap));
    }
  } catch (err) {
    console.warn(`[wikidata] recent films failed: ${err.message}`);
  }

  return fresh;
}

export async function runSync({ dataFile, enrichmentFile, fetchFresh, incremental }) {
  const existing = await loadExistingWorks(dataFile);
  const enrichmentMap = loadEnrichment(enrichmentFile);
  const fresh = await fetchFresh(enrichmentMap, incremental);
  const merged = mergeWorks(existing, fresh).filter((work) => !isExcludedContent(work));
  writeDataFile(dataFile, merged);
  return { existingCount: existing.length, freshCount: fresh.length, totalCount: merged.length };
}

async function main() {
  const incremental = process.argv.includes('--new');
  const result = await runSync({
    dataFile: REAL_DATA_FILE,
    enrichmentFile: REAL_ENRICHMENT_FILE,
    fetchFresh: incremental ? fetchWikidataRecent : fetchWikidataFull,
    incremental,
  });
  console.log(`Sync complete: ${result.freshCount} fetched, ${result.totalCount} total works in js/data.js (was ${result.existingCount}).`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

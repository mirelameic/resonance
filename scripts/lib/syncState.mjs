import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// Tracks pagination progress per "bucket" (a source+medium+filter combination,
// e.g. "wikidata:film:1990-1999" or "wikidata:film:brazil:1990-1999") so a sync
// run always asks for the NEXT slice of results instead of re-fetching the same
// top-N items every time, and never re-queries a bucket that's already known to
// have no more results. Bucket key naming is deliberately generic (source:medium:...)
// so future sources (music, literature, visual arts) can share this same file
// under their own key prefixes without colliding with existing entries.

export function loadSyncState(stateFile) {
  if (!existsSync(stateFile)) return {};
  return JSON.parse(readFileSync(stateFile, 'utf8'));
}

export function saveSyncState(stateFile, state) {
  writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

const DEFAULT_PROGRESS = Object.freeze({ offset: 0, exhausted: false });

export function getBucketProgress(state, bucketKey) {
  return state[bucketKey] || DEFAULT_PROGRESS;
}

// Pure: returns a NEW state object, never mutates the one passed in.
// A bucket is exhausted the moment a successful query returns fewer results
// than requested — that's WDQS's own signal that there's nothing more to page
// into for that filter. A failed query never reaches this function at all (the
// caller only calls it after a successful response), so a transient network/
// server error never advances or exhausts a bucket — the same offset is simply
// retried on the next run.
export function recordBucketResult(state, bucketKey, resultCount, limit) {
  const previous = getBucketProgress(state, bucketKey);
  return {
    ...state,
    [bucketKey]: {
      offset: previous.offset + resultCount,
      exhausted: resultCount < limit,
    },
  };
}

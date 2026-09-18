import { existsSync, readFileSync, writeFileSync } from 'node:fs';

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

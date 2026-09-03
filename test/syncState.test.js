import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSyncState, saveSyncState, getBucketProgress, recordBucketResult } from '../scripts/lib/syncState.mjs';

test('getBucketProgress returns offset 0, not exhausted, for a bucket never seen before', () => {
  const progress = getBucketProgress({}, 'wikidata:film:1990-1999');
  assert.deepEqual(progress, { offset: 0, exhausted: false });
});

test('recordBucketResult advances the offset and stays not-exhausted when a full page comes back', () => {
  const state = recordBucketResult({}, 'wikidata:film:1990-1999', 40, 40);
  assert.deepEqual(state['wikidata:film:1990-1999'], { offset: 40, exhausted: false });
});

test('recordBucketResult marks the bucket exhausted when fewer results than the limit come back', () => {
  const state = recordBucketResult({}, 'wikidata:film:1900-1909', 12, 40);
  assert.deepEqual(state['wikidata:film:1900-1909'], { offset: 12, exhausted: true });
});

test('recordBucketResult accumulates offset across repeated calls for the same bucket', () => {
  let state = recordBucketResult({}, 'wikidata:film:2000-2009', 40, 40);
  state = recordBucketResult(state, 'wikidata:film:2000-2009', 40, 40);
  state = recordBucketResult(state, 'wikidata:film:2000-2009', 15, 40);
  assert.deepEqual(state['wikidata:film:2000-2009'], { offset: 95, exhausted: true });
});

test('recordBucketResult does not touch other buckets in the state', () => {
  const before = { 'wikidata:film:1980-1989': { offset: 40, exhausted: false } };
  const after = recordBucketResult(before, 'wikidata:film:1990-1999', 40, 40);
  assert.deepEqual(after['wikidata:film:1980-1989'], { offset: 40, exhausted: false });
  assert.deepEqual(after['wikidata:film:1990-1999'], { offset: 40, exhausted: false });
});

test('recordBucketResult does not mutate the state object passed in', () => {
  const before = { 'wikidata:film:1990-1999': { offset: 40, exhausted: false } };
  const beforeSnapshot = JSON.parse(JSON.stringify(before));
  recordBucketResult(before, 'wikidata:film:1990-1999', 40, 40);
  assert.deepEqual(before, beforeSnapshot, 'the input state object must not be mutated');
});

test('loadSyncState returns an empty object when the file does not exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'resonance-syncstate-'));
  const stateFile = join(dir, 'sync-state.json');
  assert.deepEqual(loadSyncState(stateFile), {});
  rmSync(dir, { recursive: true, force: true });
});

test('saveSyncState then loadSyncState round-trips the state correctly', () => {
  const dir = mkdtempSync(join(tmpdir(), 'resonance-syncstate-'));
  const stateFile = join(dir, 'sync-state.json');
  const state = {
    'wikidata:film:1990-1999': { offset: 40, exhausted: false },
    'wikidata:film:brazil:1990-1999': { offset: 10, exhausted: true },
  };
  saveSyncState(stateFile, state);
  assert.deepEqual(loadSyncState(stateFile), state);
  rmSync(dir, { recursive: true, force: true });
});

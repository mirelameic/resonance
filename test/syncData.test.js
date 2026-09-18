import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSync, runBucket } from '../scripts/sync-data.mjs';

test('runSync writes a fresh js/data.js and reports accurate counts when nothing existed before', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'resonance-sync-'));
  const dataFile = join(dir, 'data.js');
  const enrichmentFile = join(dir, 'enrichment.json');
  writeFileSync(enrichmentFile, '{}');

  const fakeFresh = [
    { id: 'a', title: 'A', source: { type: 'wikidata', sourceId: '1' } },
    { id: 'b', title: 'B', source: { type: 'wikidata', sourceId: '2' } },
  ];
  const fetchFresh = async () => fakeFresh;

  const result = await runSync({ dataFile, enrichmentFile, fetchFresh, incremental: false });

  assert.equal(result.existingCount, 0);
  assert.equal(result.freshCount, 2);
  assert.equal(result.totalCount, 2);

  const written = await import(`file://${dataFile}?t=${Date.now()}`);
  assert.equal(written.works.length, 2);

  rmSync(dir, { recursive: true, force: true });
});

test('runSync merges fresh works into an existing generated data.js without duplicating', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'resonance-sync-'));
  const dataFile = join(dir, 'data.js');
  const enrichmentFile = join(dir, 'enrichment.json');
  writeFileSync(enrichmentFile, '{}');
  writeFileSync(dataFile, `export const works = ${JSON.stringify([
    { id: 'a', title: 'Old A', source: { type: 'wikidata', sourceId: '1' } },
  ])};\n`);

  const fetchFresh = async () => [{ id: 'a', title: 'New A', source: { type: 'wikidata', sourceId: '1' } }];
  const result = await runSync({ dataFile, enrichmentFile, fetchFresh, incremental: false });

  assert.equal(result.totalCount, 1);
  const written = await import(`file://${dataFile}?t=${Date.now()}`);
  assert.equal(written.works[0].title, 'New A');

  rmSync(dir, { recursive: true, force: true });
});

test('runSync passes the enrichment map and incremental flag through to fetchFresh', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'resonance-sync-'));
  const dataFile = join(dir, 'data.js');
  const enrichmentFile = join(dir, 'enrichment.json');
  writeFileSync(enrichmentFile, JSON.stringify({ 'wikidata:1': { movement: 'Curated' } }));

  let capturedEnrichment;
  let capturedIncremental;
  const fetchFresh = async (enrichmentMap, incremental) => {
    capturedEnrichment = enrichmentMap;
    capturedIncremental = incremental;
    return [];
  };

  await runSync({ dataFile, enrichmentFile, fetchFresh, incremental: true });

  assert.deepEqual(capturedEnrichment, { 'wikidata:1': { movement: 'Curated' } });
  assert.equal(capturedIncremental, true);

  rmSync(dir, { recursive: true, force: true });
});

test('runBucket skips the query entirely when the bucket is already exhausted', async () => {
  let queryCalled = false;
  const state = { 'wikidata:film:1900-1909': { offset: 12, exhausted: true } };
  const query = async () => { queryCalled = true; return []; };

  const result = await runBucket({ label: 'film 1900-1909', bucketKey: 'wikidata:film:1900-1909', state, limit: 40, query });

  assert.equal(queryCalled, false, 'an exhausted bucket must never make a query call');
  assert.deepEqual(result.fresh, []);
  assert.deepEqual(result.state, state, 'state is returned unchanged when skipped');
});

test('runBucket queries at the saved offset and advances the checkpoint on success', async () => {
  let capturedOffset;
  const state = { 'wikidata:film:2000-2009': { offset: 40, exhausted: false } };
  const rows = Array.from({ length: 40 }, (_, i) => ({ id: `r${i}` }));
  const query = async (offset) => { capturedOffset = offset; return rows; };

  const result = await runBucket({ label: 'film 2000-2009', bucketKey: 'wikidata:film:2000-2009', state, limit: 40, query });

  assert.equal(capturedOffset, 40, 'must query starting at the saved offset, not from 0');
  assert.equal(result.fresh.length, 40);
  assert.deepEqual(result.state['wikidata:film:2000-2009'], { offset: 80, exhausted: false });
});

test('runBucket marks the bucket exhausted when a query returns fewer results than the limit', async () => {
  const state = {};
  const query = async () => Array.from({ length: 7 }, (_, i) => ({ id: `r${i}` }));

  const result = await runBucket({ label: 'film 1900-1909', bucketKey: 'wikidata:film:1900-1909', state, limit: 40, query });

  assert.deepEqual(result.state['wikidata:film:1900-1909'], { offset: 7, exhausted: true });
});

test('runBucket leaves the checkpoint untouched when the query throws (a failure never advances or exhausts)', async () => {
  const state = { 'wikidata:film:1970-1979': { offset: 40, exhausted: false } };
  const query = async () => { throw new Error('Wikidata request failed: 504 Gateway Timeout'); };

  const result = await runBucket({ label: 'film 1970-1979', bucketKey: 'wikidata:film:1970-1979', state, limit: 40, query });

  assert.deepEqual(result.fresh, []);
  assert.deepEqual(result.state, state, 'a failed query must not change the checkpoint, so the same offset is retried next run');
});

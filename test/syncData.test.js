import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSync } from '../scripts/sync-data.mjs';

test('runSync writes a fresh js/data.js and reports accurate counts when nothing existed before', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'resonance-sync-'));
  const dataFile = join(dir, 'data.js');
  const enrichmentFile = join(dir, 'enrichment.json');
  writeFileSync(enrichmentFile, '{}');

  const fakeFresh = [
    { id: 'a', title: 'A', source: { type: 'tmdb', sourceId: '1' } },
    { id: 'b', title: 'B', source: { type: 'tmdb', sourceId: '2' } },
  ];
  const fetchFresh = async () => fakeFresh;

  const result = await runSync({ dataFile, enrichmentFile, fetchFresh, apiKey: 'fake', incremental: false });

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
    { id: 'a', title: 'Old A', source: { type: 'tmdb', sourceId: '1' } },
  ])};\n`);

  const fetchFresh = async () => [{ id: 'a', title: 'New A', source: { type: 'tmdb', sourceId: '1' } }];
  const result = await runSync({ dataFile, enrichmentFile, fetchFresh, apiKey: 'fake', incremental: false });

  assert.equal(result.totalCount, 1);
  const written = await import(`file://${dataFile}?t=${Date.now()}`);
  assert.equal(written.works[0].title, 'New A');

  rmSync(dir, { recursive: true, force: true });
});

test('runSync passes the enrichment map and incremental flag through to fetchFresh', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'resonance-sync-'));
  const dataFile = join(dir, 'data.js');
  const enrichmentFile = join(dir, 'enrichment.json');
  writeFileSync(enrichmentFile, JSON.stringify({ 'tmdb:1': { movement: 'Curated' } }));

  let capturedEnrichment;
  let capturedIncremental;
  const fetchFresh = async (apiKey, enrichmentMap, incremental) => {
    capturedEnrichment = enrichmentMap;
    capturedIncremental = incremental;
    return [];
  };

  await runSync({ dataFile, enrichmentFile, fetchFresh, apiKey: 'fake', incremental: true });

  assert.deepEqual(capturedEnrichment, { 'tmdb:1': { movement: 'Curated' } });
  assert.equal(capturedIncremental, true);

  rmSync(dir, { recursive: true, force: true });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEnrichment } from '../scripts/lib/applyEnrichment.mjs';

const work = {
  id: 'cidade-de-deus-2002',
  source: { type: 'tmdb', sourceId: '598' },
  movement: 'Brazil drama, 2000s',
  themes: ['Crime'],
  mood: ['Evocative'],
  context: 'Released in 2002 in Brazil.',
};

test('applyEnrichment overlays matching fields when a curated entry exists', () => {
  const enrichmentMap = {
    'tmdb:598': { movement: 'Cinema de favela', mood: ['Frenetic', 'Unflinching'] },
  };
  const result = applyEnrichment(work, enrichmentMap);
  assert.equal(result.movement, 'Cinema de favela');
  assert.deepEqual(result.mood, ['Frenetic', 'Unflinching']);
  assert.deepEqual(result.themes, ['Crime'], 'fields not present in the overlay should be untouched');
});

test('applyEnrichment returns the work unchanged (by value) when no matching entry exists', () => {
  const result = applyEnrichment(work, {});
  assert.deepEqual(result, work);
});

test('applyEnrichment does not mutate the original work object', () => {
  const enrichmentMap = { 'tmdb:598': { movement: 'Cinema de favela' } };
  applyEnrichment(work, enrichmentMap);
  assert.equal(work.movement, 'Brazil drama, 2000s');
});

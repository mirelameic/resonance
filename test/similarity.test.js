import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeConnections, pickUnexpectedConnection } from '../js/similarity.js';

const cinemaNovo = { id: 'a', title: 'A', medium: 'film', year: 1964, country: 'Brazil', movement: 'Cinema Novo', genre: 'Drama', themes: ['Poverty', 'Hunger'], mood: ['Stark'] };
const cinemaNovoSibling = { id: 'b', title: 'B', medium: 'film', year: 1963, country: 'Brazil', movement: 'Cinema Novo', genre: 'Drama', themes: ['Poverty', 'Land'], mood: ['Stark'] };
const unrelated = { id: 'c', title: 'C', medium: 'music', year: 1998, country: 'Japan', movement: 'City Pop', genre: 'Pop', themes: ['Nightlife'], mood: ['Euphoric'] };
const sameEraDifferentEverything = { id: 'd', title: 'D', medium: 'photography', year: 1965, country: 'USA', movement: 'Documentary photography', genre: 'Documentary', themes: ['Displacement'], mood: ['Somber'] };

test('computeConnections ranks a strong shared-movement match highest', () => {
  const results = computeConnections(cinemaNovo, [cinemaNovoSibling, unrelated, sameEraDifferentEverything]);
  assert.equal(results[0].work.id, 'b');
  assert.ok(results[0].reasons.some((r) => r.includes('Cinema Novo')));
});

test('computeConnections excludes the work itself even if present in the candidate list', () => {
  const results = computeConnections(cinemaNovo, [cinemaNovo, cinemaNovoSibling]);
  assert.ok(!results.some((r) => r.work.id === 'a'));
});

test('computeConnections excludes works below the minimum score threshold', () => {
  const results = computeConnections(cinemaNovo, [unrelated], { minScore: 1 });
  assert.deepEqual(results, []);
});

test('computeConnections still surfaces a weak period-only connection above threshold', () => {
  const results = computeConnections(cinemaNovo, [sameEraDifferentEverything], { minScore: 1 });
  assert.equal(results.length, 1);
  assert.ok(results[0].reasons.some((r) => r.includes('era')));
});

test('computeConnections respects the limit option', () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ ...cinemaNovoSibling, id: `sib-${i}` }));
  const results = computeConnections(cinemaNovo, many, { limit: 3 });
  assert.equal(results.length, 3);
});

test('pickUnexpectedConnection prefers a cross-medium match over a same-medium one', () => {
  const source = { id: 'x', medium: 'film' };
  const sameMedium = { work: { id: 'y', medium: 'film' }, score: 5, reasons: ['same movement: X'] };
  const crossMedium = { work: { id: 'z', medium: 'music' }, score: 2, reasons: ['shared theme: memory'] };
  const result = pickUnexpectedConnection(source, [sameMedium, crossMedium]);
  assert.equal(result.work.id, 'z');
});

test('pickUnexpectedConnection falls back to the same-medium pool when nothing crosses mediums', () => {
  const source = { id: 'x', medium: 'film' };
  const onlySameMedium = { work: { id: 'y', medium: 'film' }, score: 5, reasons: ['same movement: X'] };
  const result = pickUnexpectedConnection(source, [onlySameMedium]);
  assert.equal(result.work.id, 'y');
});

test('pickUnexpectedConnection returns null when there are no connections', () => {
  assert.equal(pickUnexpectedConnection({ id: 'x', medium: 'film' }, []), null);
});

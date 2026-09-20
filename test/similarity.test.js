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

test('pickUnexpectedConnection prefers a substantive cross-medium match over a period-only cross-medium match', () => {
  const source = { id: 'x', medium: 'film' };
  const periodOnlyCrossMedium = { work: { id: 'y', medium: 'music' }, score: 1.5, reasons: ['same era, 1 year apart'] };
  const substantiveCrossMedium = { work: { id: 'z', medium: 'photography' }, score: 2, reasons: ['shared theme: memory', 'shared mood: somber'] };
  const result = pickUnexpectedConnection(source, [periodOnlyCrossMedium, substantiveCrossMedium]);
  assert.equal(result.work.id, 'z');
});

test('pickUnexpectedConnection falls back to a period-only connection when nothing in the pool is substantive', () => {
  const source = { id: 'x', medium: 'film' };
  const periodOnlyCrossMedium = { work: { id: 'y', medium: 'music' }, score: 1.5, reasons: ['same era, 1 year apart'] };
  const anotherPeriodOnly = { work: { id: 'z', medium: 'photography' }, score: 1.2, reasons: ['same era, 5 years apart'] };
  const result = pickUnexpectedConnection(source, [periodOnlyCrossMedium, anotherPeriodOnly]);
  assert.equal(result.work.id, 'y');
});

test('two works that both have creator "Unknown" do not score a creator match', () => {
  const workA = { id: 'a', medium: 'film', year: 1970, country: 'unknown', movement: 'drama, 1970s', genre: 'Uncategorized', creator: 'Unknown', themes: ['Storytelling'], mood: ['Evocative'] };
  const workB = { id: 'b', medium: 'tv', year: 2015, country: 'unknown', movement: 'comedy, 2010s', genre: 'Uncategorized', creator: 'Unknown', themes: ['Storytelling'], mood: ['Evocative'] };
  const results = computeConnections(workA, [workB], { minScore: 0 });
  assert.equal(results.length, 1);
  assert.ok(!results[0].reasons.some((r) => r.startsWith('same creator')), `expected no creator match, got reasons: ${results[0].reasons}`);
  assert.ok(!results[0].reasons.some((r) => r.startsWith('same genre')), `expected no genre match, got reasons: ${results[0].reasons}`);
  assert.ok(!results[0].reasons.some((r) => r.startsWith('same country')), `expected no country match, got reasons: ${results[0].reasons}`);
});

test('two works that both have themes: ["Storytelling"] do not score that as a shared theme', () => {
  const workA = { id: 'a', medium: 'film', year: 1970, themes: ['Storytelling'], mood: ['Evocative'] };
  const workB = { id: 'b', medium: 'tv', year: 2015, themes: ['Storytelling'], mood: ['Evocative'] };
  const results = computeConnections(workA, [workB], { minScore: 0 });
  assert.equal(results.length, 1);
  assert.ok(!results[0].reasons.some((r) => r.startsWith('shared theme')), `expected no shared theme, got reasons: ${results[0].reasons}`);
  assert.ok(!results[0].reasons.some((r) => r.startsWith('shared mood')), `expected no shared mood, got reasons: ${results[0].reasons}`);
});

test('a real, non-sentinel shared creator still scores a match (sentinel guard does not break real matches)', () => {
  const workA = { id: 'a', medium: 'film', year: 1970, creator: 'Glauber Rocha', themes: [], mood: [] };
  const workB = { id: 'b', medium: 'tv', year: 2015, creator: 'Glauber Rocha', themes: [], mood: [] };
  const results = computeConnections(workA, [workB], { minScore: 0 });
  assert.equal(results.length, 1);
  assert.ok(results[0].reasons.some((r) => r === 'same creator: Glauber Rocha'));
});

test('a real, non-sentinel shared theme still scores a match (sentinel guard does not break real matches)', () => {
  const workA = { id: 'a', medium: 'film', year: 1970, themes: ['Memory'], mood: [] };
  const workB = { id: 'b', medium: 'tv', year: 2015, themes: ['Memory'], mood: [] };
  const results = computeConnections(workA, [workB], { minScore: 0 });
  assert.equal(results.length, 1);
  assert.ok(results[0].reasons.some((r) => r.startsWith('shared theme') && r.includes('Memory')));
});

test('multiple shared themes are pluralized and each one adds to the score', () => {
  const workA = { id: 'a', medium: 'film', themes: ['Memory', 'Exile'], mood: [] };
  const workB = { id: 'b', medium: 'film', themes: ['Memory', 'Exile'], mood: [] };
  const solo = { id: 'c', medium: 'film', themes: ['Memory'], mood: [] };
  const results = computeConnections(workA, [workB, solo], { minScore: 0 });
  const twoThemes = results.find((r) => r.work.id === 'b');
  const oneTheme = results.find((r) => r.work.id === 'c');
  assert.ok(twoThemes.reasons.some((r) => r === 'shared themes: Memory, Exile'));
  assert.ok(twoThemes.score > oneTheme.score, 'two shared themes must score higher than one');
});

test('period reason: exactly the same year is called out distinctly from "years apart"', () => {
  const results = computeConnections({ id: 'a', year: 2000 }, [{ id: 'b', year: 2000 }], { minScore: 0 });
  assert.ok(results[0].reasons.some((r) => r === 'same era, released the same year'));
});

test('period reason: 1 year apart is singular, not "1 years"', () => {
  const results = computeConnections({ id: 'a', year: 2000 }, [{ id: 'b', year: 2001 }], { minScore: 0 });
  assert.ok(results[0].reasons.some((r) => r === 'same era, 1 year apart'));
});

test('period reason: at or beyond the decay window it reads "loosely"', () => {
  const results = computeConnections({ id: 'a', year: 2000 }, [{ id: 'b', year: 2010 }], { minScore: 0 });
  assert.ok(results[0].reasons.some((r) => r.startsWith('same era (loosely), 10 years apart')));
});

test('missing year on either work skips the period score entirely, with no era reason', () => {
  const results = computeConnections({ id: 'a', year: null, creator: 'X' }, [{ id: 'b', year: 2001, creator: 'X' }], { minScore: 0 });
  assert.ok(!results[0].reasons.some((r) => r.includes('era')));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, buildHash } from '../js/router.js';

test('parseRoute: empty hash is home', () => {
  assert.deepEqual(parseRoute(''), { view: 'home', params: {}, query: {} });
});

test('parseRoute: bare "#/" is home', () => {
  assert.deepEqual(parseRoute('#/'), { view: 'home', params: {}, query: {} });
});

test('parseRoute: explore with query params splits comma lists', () => {
  const result = parseRoute('#/explore?medium=film,music&decade=1960s');
  assert.equal(result.view, 'explore');
  assert.deepEqual(result.query.medium, ['film', 'music']);
  assert.deepEqual(result.query.decade, ['1960s']);
});

test('parseRoute: work detail captures the id param', () => {
  const result = parseRoute('#/work/cidade-de-deus');
  assert.equal(result.view, 'work');
  assert.equal(result.params.id, 'cidade-de-deus');
});

test('parseRoute: unknown view falls back to home', () => {
  assert.equal(parseRoute('#/nonsense').view, 'home');
});

test('buildHash: explore query roundtrips through parseRoute', () => {
  const hash = buildHash('explore', {}, { medium: ['film', 'music'], decade: ['1960s'] });
  const parsed = parseRoute(hash);
  assert.equal(parsed.view, 'explore');
  assert.deepEqual(parsed.query.medium, ['film', 'music']);
});

test('buildHash: work detail includes the id in the path', () => {
  assert.equal(buildHash('work', { id: 'cidade-de-deus' }), '#/work/cidade-de-deus');
});

test('buildHash: home has no trailing segment', () => {
  assert.equal(buildHash('home'), '#/');
});

test('roundtrip: a filter value containing a literal comma survives buildHash -> parseRoute intact', () => {
  const original = ['Are-bure-boke (rough, blurred, out-of-focus)'];
  const hash = buildHash('explore', {}, { movement: original });
  const parsed = parseRoute(hash);
  assert.deepEqual(parsed.query.movement, original);
});

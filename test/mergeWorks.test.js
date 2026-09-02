import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeWorks, sourceKey } from '../scripts/lib/mergeWorks.mjs';

const existingA = { id: 'a', title: 'Old Title A', source: { type: 'wikidata', sourceId: '1' } };
const existingB = { id: 'b', title: 'B', source: { type: 'wikidata', sourceId: '2' } };
const freshA = { id: 'a', title: 'Refreshed Title A', source: { type: 'wikidata', sourceId: '1' } };
const freshC = { id: 'c', title: 'C', source: { type: 'wikidata', sourceId: '3' } };

test('sourceKey combines source type and sourceId', () => {
  assert.equal(sourceKey(existingA), 'wikidata:1');
});

test('mergeWorks updates an existing work in place by source key, preserving position', () => {
  const result = mergeWorks([existingA, existingB], [freshA]);
  assert.equal(result.length, 2);
  assert.equal(result[0].title, 'Refreshed Title A');
  assert.equal(result[1].title, 'B');
});

test('mergeWorks appends a brand-new work not present in existing', () => {
  const result = mergeWorks([existingA, existingB], [freshC]);
  assert.equal(result.length, 3);
  assert.equal(result[2].id, 'c');
});

test('mergeWorks with no fresh works returns existing unchanged', () => {
  const result = mergeWorks([existingA, existingB], []);
  assert.deepEqual(result, [existingA, existingB]);
});

test('mergeWorks with no existing works returns fresh works as-is', () => {
  const result = mergeWorks([], [freshA, freshC]);
  assert.equal(result.length, 2);
});

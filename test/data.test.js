import { test } from 'node:test';
import assert from 'node:assert/strict';
import { works } from '../js/data.js';

const VALID_MEDIA = new Set(['music', 'film', 'tv', 'literature', 'photography', 'visual-arts']);
const REQUIRED_STRING_FIELDS = ['id', 'title', 'creator', 'medium', 'country', 'language', 'movement', 'genre', 'context', 'description'];
const REQUIRED_ARRAY_FIELDS = ['style', 'themes', 'mood'];

test('data.js exports at least 70 works', () => {
  assert.ok(Array.isArray(works));
  assert.ok(works.length >= 70, `expected >= 70 works, got ${works.length}`);
});

test('every work has all required string fields non-empty', () => {
  for (const work of works) {
    for (const field of REQUIRED_STRING_FIELDS) {
      assert.equal(typeof work[field], 'string', `${work.id || '?'}.${field} should be a string`);
      assert.ok(work[field].trim().length > 0, `${work.id || '?'}.${field} should not be empty`);
    }
  }
});

test('every work has non-empty array fields', () => {
  for (const work of works) {
    for (const field of REQUIRED_ARRAY_FIELDS) {
      assert.ok(Array.isArray(work[field]), `${work.id}.${field} should be an array`);
      assert.ok(work[field].length > 0, `${work.id}.${field} should not be empty`);
    }
  }
});

test('every work has a valid medium', () => {
  for (const work of works) {
    assert.ok(VALID_MEDIA.has(work.medium), `${work.id} has invalid medium "${work.medium}"`);
  }
});

test('every work has a plausible 4-digit year and matching decade', () => {
  for (const work of works) {
    assert.ok(Number.isInteger(work.year) && work.year > 1000 && work.year <= 2026, `${work.id} has invalid year ${work.year}`);
    assert.equal(work.decade, `${Math.floor(work.year / 10) * 10}s`, `${work.id} decade should match its year`);
  }
});

test('every work id is unique', () => {
  const ids = works.map((w) => w.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids found');
});

test('every id is a kebab-case slug', () => {
  for (const work of works) {
    assert.match(work.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${work.id} is not kebab-case`);
  }
});

test('the collection spans every medium and includes Brazilian works', () => {
  const mediaPresent = new Set(works.map((w) => w.medium));
  for (const medium of VALID_MEDIA) {
    assert.ok(mediaPresent.has(medium), `no work found for medium "${medium}"`);
  }
  assert.ok(works.some((w) => w.country === 'Brazil'), 'expected at least one Brazilian work');
});

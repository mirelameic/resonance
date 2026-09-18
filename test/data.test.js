import { test } from 'node:test';
import assert from 'node:assert/strict';
import { works } from '../js/data.js';

const VALID_MEDIA = new Set(['music', 'film', 'literature', 'photography', 'visual-arts']);
const REQUIRED_STRING_FIELDS = ['id', 'title', 'creator', 'medium', 'country', 'language', 'movement', 'genre', 'context', 'description'];
const REQUIRED_ARRAY_FIELDS = ['style', 'themes', 'mood'];
const VALID_SOURCE_TYPES = new Set(['wikidata', 'musicbrainz', 'openlibrary', 'met']);

const SOURCED_MEDIA = ['film'];

test('data.js exports at least one work', () => {
  assert.ok(Array.isArray(works));
  assert.ok(works.length >= 1, `expected at least 1 work, got ${works.length}`);
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

test('every work has a plausible 4-digit year and matching decade, or an honest "unknown" pair', () => {
  for (const work of works) {
    if (work.year === null) {
      assert.equal(work.decade, 'unknown', `${work.id} has a null year but decade is not "unknown"`);
      continue;
    }
    const maxPlausibleYear = new Date().getFullYear() + 1;
    assert.ok(Number.isInteger(work.year) && work.year > 1000 && work.year <= maxPlausibleYear, `${work.id} has invalid year ${work.year}`);
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

test('the collection spans every currently-integrated medium', () => {
  const mediaPresent = new Set(works.map((w) => w.medium));
  for (const medium of SOURCED_MEDIA) {
    assert.ok(mediaPresent.has(medium), `no work found for medium "${medium}"`);
  }
});

test('every work has an image URL or an explicit null, with a matching credit rule', () => {
  for (const work of works) {
    assert.ok(work.image === null || typeof work.image === 'string', `${work.id}.image should be a string URL or null`);
    if (work.image === null) {
      assert.equal(work.imageCredit, null, `${work.id}.imageCredit should be null when there is no image`);
    } else {
      assert.ok(work.image.startsWith('https://'), `${work.id}.image should be a real https URL`);
      assert.ok(typeof work.imageCredit === 'string' && work.imageCredit.length > 0, `${work.id}.imageCredit should be a non-empty string when an image exists`);
    }
  }
});

test('every work has a valid source object', () => {
  for (const work of works) {
    assert.ok(work.source && typeof work.source === 'object', `${work.id} is missing a source object`);
    assert.ok(VALID_SOURCE_TYPES.has(work.source.type), `${work.id} has invalid source.type "${work.source && work.source.type}"`);
    assert.ok(typeof work.source.sourceId === 'string' && work.source.sourceId.length > 0, `${work.id} is missing a non-empty source.sourceId`);
  }
});

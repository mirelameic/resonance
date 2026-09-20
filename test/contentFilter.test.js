import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isExcludedContent } from '../scripts/lib/contentFilter.mjs';

test('excludes a work whose genre is pornographic', () => {
  const work = { genre: 'pornographic film', movement: 'Brazil pornographic film, 1980s', style: ['pornographic film'], themes: [], description: '', context: '' };
  assert.equal(isExcludedContent(work), true);
});

test('excludes a work whose style array contains an erotic classification, even if genre does not', () => {
  const work = { genre: 'Drama', movement: 'France drama, 1920s', style: ['drama film', 'erotic film'], themes: [], description: '', context: '' };
  assert.equal(isExcludedContent(work), true);
});

test('excludes sexploitation and fetish genres too', () => {
  assert.equal(isExcludedContent({ genre: 'sexploitation film', style: [], themes: [], movement: '', description: '', context: '' }), true);
  assert.equal(isExcludedContent({ genre: 'fetish film', style: [], themes: [], movement: '', description: '', context: '' }), true);
});

test('matching is case-insensitive', () => {
  const work = { genre: 'PORNOGRAPHIC FILM', style: [], themes: [], movement: '', description: '', context: '' };
  assert.equal(isExcludedContent(work), true);
});

test('does not exclude an ordinary drama with no matching field', () => {
  const work = { genre: 'Drama', movement: 'Brazil drama film, 1970s', style: ['drama film'], themes: ['Family'], description: 'A drama film from Brazil (1970).', context: 'Released in 1970 in Brazil.' };
  assert.equal(isExcludedContent(work), false);
});

test('does not false-positive on unrelated words', () => {
  const work = { genre: 'Sports film', movement: 'sport, 1990s', style: ['sports film'], themes: ['Competition'], description: '', context: '' };
  assert.equal(isExcludedContent(work), false);
});

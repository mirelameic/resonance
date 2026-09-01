import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFacets, filterWorks } from '../js/filters.js';

const sample = [
  { id: 'a', title: 'Black Orpheus', creator: 'Marcel Camus', medium: 'film', decade: '1950s', country: 'Brazil', movement: 'Cinema Novo precursor', genre: 'Drama', style: ['Location shooting'], themes: ['Myth', 'Love'], mood: ['Vibrant'], language: 'Portuguese' },
  { id: 'b', title: 'Tropicalia', creator: 'Various', medium: 'music', decade: '1960s', country: 'Brazil', movement: 'Tropicalia', genre: 'Psychedelic', style: ['Collage'], themes: ['Identity', 'Modernity'], mood: ['Playful'], language: 'Portuguese' },
  { id: 'c', title: 'Seven Samurai', creator: 'Akira Kurosawa', medium: 'film', decade: '1950s', country: 'Japan', movement: 'Golden Age Japanese cinema', genre: 'Drama', style: ['Ensemble'], themes: ['Honor', 'Sacrifice'], mood: ['Epic'], language: 'Japanese' },
];

test('extractFacets collects unique sorted values per facet', () => {
  const facets = extractFacets(sample);
  assert.deepEqual(facets.medium, ['film', 'music']);
  assert.deepEqual(facets.country, ['Brazil', 'Japan']);
});

test('filterWorks: a single facet filters by OR within the category', () => {
  const result = filterWorks(sample, { country: ['Brazil'] });
  assert.deepEqual(result.map((w) => w.id).sort(), ['a', 'b']);
});

test('filterWorks: multiple facets combine with AND across categories', () => {
  const result = filterWorks(sample, { medium: ['film'], country: ['Japan'] });
  assert.deepEqual(result.map((w) => w.id), ['c']);
});

test('filterWorks: array-valued facet (themes) matches if any selected value is present', () => {
  const result = filterWorks(sample, { themes: ['Myth'] });
  assert.deepEqual(result.map((w) => w.id), ['a']);
});

test('filterWorks: search text matches title or creator, case-insensitively', () => {
  const result = filterWorks(sample, {}, 'kurosawa');
  assert.deepEqual(result.map((w) => w.id), ['c']);
});

test('filterWorks: no filters or search returns everything', () => {
  assert.equal(filterWorks(sample, {}, '').length, 3);
});

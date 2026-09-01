import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateArtworkSVG } from '../js/artwork.js';

const work = { id: 'cidade-de-deus', title: 'Cidade de Deus', medium: 'film' };

test('generateArtworkSVG is deterministic for the same work id', () => {
  assert.equal(generateArtworkSVG(work), generateArtworkSVG(work));
});

test('generateArtworkSVG produces different output for a different id', () => {
  const other = { ...work, id: 'ilha-das-flores' };
  assert.notEqual(generateArtworkSVG(work), generateArtworkSVG(other));
});

test('generateArtworkSVG returns a well-formed svg root with the requested viewBox', () => {
  const svg = generateArtworkSVG(work, 200);
  assert.match(svg, /^<svg viewBox="0 0 200 200"/);
  assert.match(svg, /<\/svg>$/);
});

test('generateArtworkSVG escapes the title in the aria-label', () => {
  const svg = generateArtworkSVG({ ...work, title: 'A & B' });
  assert.match(svg, /aria-label="A &amp; B"/);
});

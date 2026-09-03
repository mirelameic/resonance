import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapWikidataFilmToWork } from '../scripts/lib/mapWikidata.mjs';

function binding(fields) {
  const row = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    // Wikidata's SPARQL endpoint types ?item as a uri, and a commonsMedia
    // property like ?image (P18) also resolves to a uri (a full, pre-encoded
    // Special:FilePath URL) — everything else comes back as a literal.
    row[key] = { type: key === 'item' || key === 'image' ? 'uri' : 'literal', value };
  }
  return row;
}

// wd:Q220741 — verified live against https://query.wikidata.org/sparql:
// "City of God", 2002 film directed by Fernando Meirelles and Kátia Lund.
// (wd:Q186358, the QID originally assumed for this fixture, actually
// resolves to "1860 Atlantic hurricane season" — substituted here.)
const filmBinding = binding({
  item: 'http://www.wikidata.org/entity/Q220741',
  itemLabel: 'City of God',
  directors: 'Fernando Meirelles',
  country: 'Brazil',
  language: 'Portuguese',
  genres: 'crime film|drama film',
  firstDate: '2002-01-01T00:00:00Z',
  image: 'http://commons.wikimedia.org/wiki/Special:FilePath/City%20of%20God%20poster.jpg',
});

const sparseBinding = binding({
  item: 'http://www.wikidata.org/entity/Q1',
  itemLabel: 'Unknown Film',
  // no directors, country, language, genres, date, image
});

test('mapWikidataFilmToWork maps core factual fields correctly', () => {
  const work = mapWikidataFilmToWork(filmBinding);
  assert.equal(work.title, 'City of God');
  assert.equal(work.medium, 'film');
  assert.equal(work.year, 2002);
  assert.equal(work.decade, '2000s');
  assert.equal(work.country, 'Brazil');
  assert.equal(work.language, 'Portuguese');
  assert.equal(work.creator, 'Fernando Meirelles');
  assert.deepEqual(work.source, { type: 'wikidata', sourceId: 'Q220741' });
});

test('mapWikidataFilmToWork builds a Commons image URL and credit when an image exists', () => {
  const work = mapWikidataFilmToWork(filmBinding);
  assert.equal(work.image, 'https://commons.wikimedia.org/wiki/Special:FilePath/City%20of%20God%20poster.jpg');
  assert.match(work.imageCredit, /Wikimedia Commons/);
});

test('mapWikidataFilmToWork splits the pipe-separated genres into themes', () => {
  const work = mapWikidataFilmToWork(filmBinding);
  assert.ok(work.themes.includes('crime film'));
  assert.ok(work.themes.includes('drama film'));
});

test('mapWikidataFilmToWork falls back gracefully when almost everything is missing', () => {
  const work = mapWikidataFilmToWork(sparseBinding);
  assert.equal(work.year, null);
  assert.equal(work.decade, 'unknown');
  assert.equal(work.country, 'unknown');
  assert.equal(work.language, 'unknown');
  assert.equal(work.creator, 'Unknown');
  assert.ok(work.themes.length > 0, 'themes must never be empty');
  assert.ok(work.mood.length > 0, 'mood must never be empty');
  assert.ok(work.description.length > 0, 'description must never be empty');
  assert.ok(work.context.length > 0, 'context must never be empty');
  assert.equal(work.image, null);
  assert.equal(work.imageCredit, null);
});

test('generated ids are kebab-case', () => {
  const work = mapWikidataFilmToWork(filmBinding);
  assert.match(work.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

// Regression test for finding #3 of the final review: the Brazil-guarantee query
// restricts results to items with P495 including Brazil, but a co-production has
// MULTIPLE P495 values — SAMPLE(?countryLabel) over ALL of them can arbitrarily
// pick a different co-production partner instead of Brazil. buildQuery now also
// projects a deterministic ?filteredCountry bound directly to the filtered QID's
// label; the mapper must prefer it over the sampled ?country.
const coProductionBinding = binding({
  item: 'http://www.wikidata.org/entity/Q282761',
  itemLabel: 'La Playa DC',
  directors: 'Juan Andrés Arango',
  country: 'France', // what SAMPLE(?countryLabel) arbitrarily picked in the live shipped bug
  filteredCountry: 'Brazil', // the deterministic label for the Brazil QID the query was filtered on
  language: 'Spanish',
  genres: 'drama film',
  firstDate: '2012-01-01T00:00:00Z',
});

test('mapWikidataFilmToWork prefers the deterministic filteredCountry over the sampled country when both are present', () => {
  const work = mapWikidataFilmToWork(coProductionBinding);
  assert.equal(work.country, 'Brazil');
});

test('mapWikidataFilmToWork falls back to the sampled country when filteredCountry is absent (unfiltered query)', () => {
  const work = mapWikidataFilmToWork(filmBinding);
  assert.equal(work.country, 'Brazil');
});

// Regression test for the duplicate-id fix (see the "The QID is appended..." comment
// in mapWikidata.mjs): two different real items that happen to share a title and
// release date (remakes, common titles) must never collide on id.
test('two bindings with the same itemLabel and date but different QIDs produce different ids', () => {
  const bindingA = binding({
    item: 'http://www.wikidata.org/entity/Q11111',
    itemLabel: 'The Grudge',
    firstDate: '2004-01-01T00:00:00Z',
  });
  const bindingB = binding({
    item: 'http://www.wikidata.org/entity/Q22222',
    itemLabel: 'The Grudge',
    firstDate: '2004-01-01T00:00:00Z',
  });
  const workA = mapWikidataFilmToWork(bindingA);
  const workB = mapWikidataFilmToWork(bindingB);
  assert.notEqual(workA.id, workB.id);
});

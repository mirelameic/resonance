import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapWikidataFilmToWork, mapWikidataTvToWork } from '../scripts/lib/mapWikidata.mjs';

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
  date: '2002-01-01T00:00:00Z',
  image: 'http://commons.wikimedia.org/wiki/Special:FilePath/City%20of%20God%20poster.jpg',
});

// wd:Q1079 — verified live: "Breaking Bad" television series.
// (wd:Q886971, the QID originally assumed for this fixture, actually
// resolves to a German chamber-orchestra ensemble — substituted here.)
const tvBinding = binding({
  item: 'http://www.wikidata.org/entity/Q1079',
  itemLabel: 'Breaking Bad',
  directors: 'Vince Gilligan',
  country: 'United States of America',
  language: 'English',
  genres: 'crime drama',
  date: '2008-01-20T00:00:00Z',
  // no image field at all
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

test('mapWikidataTvToWork maps core fields and has no image when P18 is absent', () => {
  const work = mapWikidataTvToWork(tvBinding);
  assert.equal(work.title, 'Breaking Bad');
  assert.equal(work.medium, 'tv');
  assert.equal(work.year, 2008);
  assert.equal(work.country, 'United States of America');
  assert.equal(work.creator, 'Vince Gilligan');
  assert.equal(work.image, null);
  assert.equal(work.imageCredit, null);
  assert.deepEqual(work.source, { type: 'wikidata', sourceId: 'Q1079' });
});

test('mapWikidataFilmToWork falls back gracefully when almost everything is missing', () => {
  const work = mapWikidataFilmToWork(sparseBinding);
  assert.equal(work.year, null);
  assert.equal(work.decade, 'unknown');
  assert.equal(work.country, 'Unknown');
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

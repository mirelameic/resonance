import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapTmdbMovieToWork, mapTmdbTvToWork } from '../scripts/lib/mapTmdb.mjs';

const movieFixture = {
  id: 598,
  title: 'City of God',
  overview: 'Told mostly in flashback, the film depicts the growth of organized crime in the Cidade de Deus suburb of Rio de Janeiro.',
  release_date: '2002-01-01',
  original_language: 'pt',
  poster_path: '/k7eYdWvhYQyRQoU2TB2A2Xu2TfD.jpg',
  genres: [{ id: 80, name: 'Crime' }, { id: 18, name: 'Drama' }],
  production_countries: [{ iso_3166_1: 'BR', name: 'Brazil' }],
  keywords: { keywords: [{ id: 1721, name: 'poverty' }, { id: 9714, name: 'gang' }] },
  credits: { crew: [{ job: 'Director', name: 'Fernando Meirelles' }, { job: 'Producer', name: 'Someone Else' }] },
};

const tvFixture = {
  id: 1396,
  name: 'Breaking Bad',
  overview: 'A high school chemistry teacher diagnosed with cancer turns to manufacturing crystal meth.',
  first_air_date: '2008-01-20',
  original_language: 'en',
  poster_path: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
  genres: [{ id: 18, name: 'Drama' }],
  origin_country: ['US'],
  created_by: [{ id: 66633, name: 'Vince Gilligan' }],
  keywords: { results: [{ id: 6152, name: 'drug' }] },
};

const minimalMovieFixture = {
  id: 1,
  title: 'Unknown Film',
  overview: '',
  release_date: '',
  original_language: 'xx',
  poster_path: null,
  genres: [],
  production_countries: [],
  keywords: { keywords: [] },
  credits: { crew: [] },
};

test('mapTmdbMovieToWork maps core factual fields correctly', () => {
  const work = mapTmdbMovieToWork(movieFixture);
  assert.equal(work.title, 'City of God');
  assert.equal(work.medium, 'film');
  assert.equal(work.year, 2002);
  assert.equal(work.decade, '2000s');
  assert.equal(work.country, 'Brazil');
  assert.equal(work.language, 'pt');
  assert.equal(work.creator, 'Fernando Meirelles');
  assert.deepEqual(work.source, { type: 'tmdb', sourceId: '598' });
});

test('mapTmdbMovieToWork builds a real image URL and credit when a poster exists', () => {
  const work = mapTmdbMovieToWork(movieFixture);
  assert.equal(work.image, 'https://image.tmdb.org/t/p/w500/k7eYdWvhYQyRQoU2TB2A2Xu2TfD.jpg');
  assert.match(work.imageCredit, /TMDB/);
});

test('mapTmdbMovieToWork derives themes from genres and keywords', () => {
  const work = mapTmdbMovieToWork(movieFixture);
  assert.ok(work.themes.includes('Crime'));
  assert.ok(work.themes.includes('poverty'));
});

test('mapTmdbMovieToWork uses the real overview as description', () => {
  const work = mapTmdbMovieToWork(movieFixture);
  assert.match(work.description, /Cidade de Deus/);
});

test('mapTmdbMovieToWork falls back gracefully when data is sparse', () => {
  const work = mapTmdbMovieToWork(minimalMovieFixture);
  assert.equal(work.image, null);
  assert.equal(work.imageCredit, null);
  assert.equal(work.year, null);
  assert.equal(work.decade, 'unknown');
  assert.equal(work.country, 'Unknown');
  assert.equal(work.creator, 'Unknown');
  assert.ok(work.themes.length > 0, 'themes must never be empty even with no genres/keywords');
  assert.ok(work.mood.length > 0, 'mood must never be empty even with no signal');
  assert.ok(work.description.length > 0, 'description must never be empty even with no overview');
  assert.ok(work.context.length > 0, 'context must never be empty');
});

test('mapTmdbTvToWork maps core factual fields correctly, including created_by as creator', () => {
  const work = mapTmdbTvToWork(tvFixture);
  assert.equal(work.title, 'Breaking Bad');
  assert.equal(work.medium, 'tv');
  assert.equal(work.year, 2008);
  assert.equal(work.decade, '2000s');
  assert.equal(work.country, 'United States');
  assert.equal(work.creator, 'Vince Gilligan');
  assert.deepEqual(work.source, { type: 'tmdb', sourceId: '1396' });
});

test('generated ids are kebab-case and unique per title+year', () => {
  const movieWork = mapTmdbMovieToWork(movieFixture);
  const tvWork = mapTmdbTvToWork(tvFixture);
  assert.match(movieWork.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.match(tvWork.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

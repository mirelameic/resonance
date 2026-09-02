# RESONANCE Data Sourcing — Shared Infrastructure + TMDB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Task 7 is explicitly controller-executed, not delegated to an implementer subagent — see its notes.**

**Goal:** Replace RESONANCE's hand-curated 79-work dataset with one populated exclusively from real public APIs. This plan builds the shared sync infrastructure (rate limiting, decade/country sampling, merge/enrichment logic) plus the first source integration — TMDB (film + TV) — end to end, including actually running it against the real API. Music, literature, and visual-arts/photography sources are separate follow-up plans built on this same infrastructure.

**Architecture:** A Node script (`scripts/sync-data.mjs`, zero new dependencies — Node 18+'s built-in `fetch` and Node 20+'s built-in `node:test` `mock` are sufficient) queries TMDB across a deliberately broad sample of languages/countries and decades, maps each raw record through a pure mapper into RESONANCE's existing work schema (plus two new fields: `image`, `imageCredit`, `source`), optionally overlays hand-curated fields from `data/enrichment.json`, and writes the result to `js/data.js` — the exact same file every other module already imports, in the exact same shape. Nothing downstream (`js/filters.js`, `js/similarity.js`, `js/render.js`'s data consumption) changes. The procedural artwork generator (`js/artwork.js`) is removed and replaced with real-image-or-clean-typography rendering in `js/render.js`.

**Tech Stack:** Node.js (built-in `fetch`, built-in `node:test` including its `mock` API), vanilla JS ES modules, zero npm dependencies — consistent with the rest of the project.

**Spec:** `docs/superpowers/specs/2026-09-02-resonance-data-sourcing-design.md` (and the original `docs/superpowers/specs/2026-08-31-resonance-design.md` for the parts of the schema/architecture this plan doesn't change)

## Global Constraints

- Zero new npm dependencies. Node's built-in `fetch` and `node:test` (including its `mock` module, available Node 20+) cover every need in this plan.
- The deployed app makes zero runtime API calls and ships zero API keys — all TMDB access happens in the offline `scripts/sync-data.mjs` script, never in `js/*` browser code.
- `TMDB_API_KEY` is read from an environment variable only, never hardcoded, never written to a committed file.
- `js/data.js` stays a plain ES module exporting `works` — never `fetch`-ed by the browser app, so it keeps working identically whether opened via a local server or as a `file://` URL.
- Every pure function (mapping, merging, enrichment application, decade/country helpers) is unit-tested with `node --test`. The sync script's network orchestration is verified by dependency-injecting a fake fetcher in tests (no real network calls in the automated suite) and by actually running it for real in Task 7.
- TMDB API details (exact endpoint paths, parameter names, response field names — e.g. `append_to_response`, the `keywords` vs `results` field name asymmetry between movie and TV keyword responses, `production_countries` vs `origin_country`) are written here from well-established, stable, heavily-documented TMDB v3 API conventions. **Each implementer must verify the exact current contract against `https://developer.themoviedb.org/reference/` for the specific endpoints they touch before finalizing that task**, and adjust field names in this plan's code if live docs disagree — note any such correction in that task's report.
- No copyrighted images are embedded or regenerated — `image` is always a URL pointing at TMDB's own image CDN, never downloaded/re-hosted.
- Attribution: every work with a `image` sourced from TMDB carries a non-null `imageCredit` string ("Poster and data courtesy of TMDB... not endorsed or certified by TMDB"), per TMDB's terms of use.

---

## Task 1: Shared sync infrastructure — rate limiting and coverage sampling

**Files:**
- Create: `scripts/lib/rateLimit.mjs`
- Create: `scripts/lib/coverage.mjs`
- Create: `data/enrichment.json`
- Test: `test/rateLimit.test.js`
- Test: `test/coverage.test.js`

**Interfaces:**
- Produces: `createThrottle(minIntervalMs) -> () => Promise<void>` and `sleep(ms) -> Promise<void>` from `scripts/lib/rateLimit.mjs`. Consumed by every source client (this plan's `scripts/sources/tmdb.mjs`, and future Music/Literature/Visual-arts source modules).
- Produces: `LANGUAGE_SAMPLES: {code: string, displayCountry: string}[]`, `DECADES: {start: number, end: number, label: string}[]`, `ISO2_TO_COUNTRY_NAME: Record<string,string>`, `decadeLabel(year: number) -> string` from `scripts/lib/coverage.mjs`. Consumed by this plan's `scripts/sources/tmdb.mjs`, `scripts/lib/mapTmdb.mjs`, and `scripts/sync-data.mjs`, and by every future source integration for consistent, deliberate breadth sampling.

- [ ] **Step 1: Write the failing tests**

Create `test/rateLimit.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createThrottle, sleep } from '../scripts/lib/rateLimit.mjs';

test('createThrottle enforces minimum spacing between resolved calls', async () => {
  const throttle = createThrottle(50);
  const start = Date.now();
  await Promise.all([throttle(), throttle(), throttle()]);
  const elapsed = Date.now() - start;
  assert.ok(elapsed >= 100, `expected at least 100ms of spacing across 3 calls, got ${elapsed}ms`);
});

test('createThrottle does not delay a single call', async () => {
  const throttle = createThrottle(200);
  const start = Date.now();
  await throttle();
  assert.ok(Date.now() - start < 50, 'a single call should resolve immediately');
});

test('sleep resolves after roughly the requested delay', async () => {
  const start = Date.now();
  await sleep(30);
  assert.ok(Date.now() - start >= 30);
});
```

Create `test/coverage.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGE_SAMPLES, DECADES, ISO2_TO_COUNTRY_NAME, decadeLabel } from '../scripts/lib/coverage.mjs';

test('LANGUAGE_SAMPLES includes Brazil explicitly', () => {
  assert.ok(LANGUAGE_SAMPLES.some((l) => l.displayCountry === 'Brazil'));
});

test('LANGUAGE_SAMPLES spans a broad set of countries, not just English-speaking ones', () => {
  const countries = new Set(LANGUAGE_SAMPLES.map((l) => l.displayCountry));
  assert.ok(countries.size >= 10, 'expected broad country/language sampling');
});

test('DECADES spans from 1900s through 2020s with no gaps', () => {
  assert.equal(DECADES[0].label, '1900s');
  assert.equal(DECADES[DECADES.length - 1].label, '2020s');
  for (let i = 1; i < DECADES.length; i++) {
    assert.equal(DECADES[i].start, DECADES[i - 1].end + 1, `gap between ${DECADES[i - 1].label} and ${DECADES[i].label}`);
  }
});

test('decadeLabel matches the DECADES list convention', () => {
  assert.equal(decadeLabel(2002), '2000s');
  assert.equal(decadeLabel(1968), '1960s');
  assert.equal(decadeLabel(1899), '1890s');
});

test('ISO2_TO_COUNTRY_NAME covers every LANGUAGE_SAMPLES country', () => {
  const names = new Set(Object.values(ISO2_TO_COUNTRY_NAME));
  for (const { displayCountry } of LANGUAGE_SAMPLES) {
    assert.ok(names.has(displayCountry), `${displayCountry} missing from ISO2_TO_COUNTRY_NAME`);
  }
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '.../scripts/lib/rateLimit.mjs'` and `'.../scripts/lib/coverage.mjs'`.

- [ ] **Step 3: Implement `scripts/lib/rateLimit.mjs`**

```js
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createThrottle(minIntervalMs) {
  let lastCallAt = 0;
  let chain = Promise.resolve();

  return function throttle() {
    const runNext = chain.then(async () => {
      const elapsed = Date.now() - lastCallAt;
      const wait = Math.max(0, minIntervalMs - elapsed);
      if (wait > 0) await sleep(wait);
      lastCallAt = Date.now();
    });
    chain = runNext;
    return runNext;
  };
}
```

- [ ] **Step 4: Implement `scripts/lib/coverage.mjs`**

```js
export const LANGUAGE_SAMPLES = [
  { code: 'en', displayCountry: 'United States' },
  { code: 'pt', displayCountry: 'Brazil' },
  { code: 'es', displayCountry: 'Mexico' },
  { code: 'fr', displayCountry: 'France' },
  { code: 'ja', displayCountry: 'Japan' },
  { code: 'ko', displayCountry: 'South Korea' },
  { code: 'de', displayCountry: 'Germany' },
  { code: 'it', displayCountry: 'Italy' },
  { code: 'hi', displayCountry: 'India' },
  { code: 'zh', displayCountry: 'China' },
  { code: 'ar', displayCountry: 'Egypt' },
  { code: 'ru', displayCountry: 'Russia' },
  { code: 'sv', displayCountry: 'Sweden' },
  { code: 'nl', displayCountry: 'Netherlands' },
  { code: 'tr', displayCountry: 'Turkey' },
];

export const DECADES = [
  { start: 1900, end: 1909, label: '1900s' },
  { start: 1910, end: 1919, label: '1910s' },
  { start: 1920, end: 1929, label: '1920s' },
  { start: 1930, end: 1939, label: '1930s' },
  { start: 1940, end: 1949, label: '1940s' },
  { start: 1950, end: 1959, label: '1950s' },
  { start: 1960, end: 1969, label: '1960s' },
  { start: 1970, end: 1979, label: '1970s' },
  { start: 1980, end: 1989, label: '1980s' },
  { start: 1990, end: 1999, label: '1990s' },
  { start: 2000, end: 2009, label: '2000s' },
  { start: 2010, end: 2019, label: '2010s' },
  { start: 2020, end: 2029, label: '2020s' },
];

export const ISO2_TO_COUNTRY_NAME = {
  US: 'United States', BR: 'Brazil', MX: 'Mexico', FR: 'France', JP: 'Japan',
  KR: 'South Korea', DE: 'Germany', IT: 'Italy', IN: 'India', CN: 'China',
  EG: 'Egypt', RU: 'Russia', SE: 'Sweden', NL: 'Netherlands', TR: 'Turkey',
  GB: 'United Kingdom', CA: 'Canada', AR: 'Argentina', NG: 'Nigeria', ZA: 'South Africa',
};

export function decadeLabel(year) {
  return `${Math.floor(year / 10) * 10}s`;
}
```

- [ ] **Step 5: Create the empty enrichment overlay**

Create `data/enrichment.json`:

```json
{}
```

- [ ] **Step 6: Run the tests and verify they pass**

```bash
npm test
```

Expected: PASS — all `rateLimit.test.js` and `coverage.test.js` tests pass, plus every prior test file (router, data, filters, similarity — 37 tests from the previous plan) still passes.

- [ ] **Step 7: Commit**

```bash
cd ~/Desktop/resonance
git add scripts/lib/rateLimit.mjs scripts/lib/coverage.mjs data/enrichment.json test/rateLimit.test.js test/coverage.test.js
git commit -m "Add shared rate-limiting and decade/country coverage sampling for data sync"
```

---

## Task 2: Pure merge and enrichment-overlay logic

**Files:**
- Create: `scripts/lib/mergeWorks.mjs`
- Create: `scripts/lib/applyEnrichment.mjs`
- Test: `test/mergeWorks.test.js`
- Test: `test/applyEnrichment.test.js`

**Interfaces:**
- Consumes: nothing new (operates on plain work objects shaped like the existing schema plus the new `source: {type, sourceId}` field).
- Produces: `mergeWorks(existingWorks, freshWorks) -> works[]` and `sourceKey(work) -> string` from `scripts/lib/mergeWorks.mjs`; `applyEnrichment(work, enrichmentMap) -> work` from `scripts/lib/applyEnrichment.mjs`. Both consumed by `scripts/sync-data.mjs` in Task 5.

- [ ] **Step 1: Write the failing tests**

Create `test/mergeWorks.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeWorks, sourceKey } from '../scripts/lib/mergeWorks.mjs';

const existingA = { id: 'a', title: 'Old Title A', source: { type: 'tmdb', sourceId: '1' } };
const existingB = { id: 'b', title: 'B', source: { type: 'tmdb', sourceId: '2' } };
const freshA = { id: 'a', title: 'Refreshed Title A', source: { type: 'tmdb', sourceId: '1' } };
const freshC = { id: 'c', title: 'C', source: { type: 'tmdb', sourceId: '3' } };

test('sourceKey combines source type and sourceId', () => {
  assert.equal(sourceKey(existingA), 'tmdb:1');
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
```

Create `test/applyEnrichment.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEnrichment } from '../scripts/lib/applyEnrichment.mjs';

const work = {
  id: 'cidade-de-deus-2002',
  source: { type: 'tmdb', sourceId: '598' },
  movement: 'Brazil drama, 2000s',
  themes: ['Crime'],
  mood: ['Evocative'],
  context: 'Released in 2002 in Brazil.',
};

test('applyEnrichment overlays matching fields when a curated entry exists', () => {
  const enrichmentMap = {
    'tmdb:598': { movement: 'Cinema de favela', mood: ['Frenetic', 'Unflinching'] },
  };
  const result = applyEnrichment(work, enrichmentMap);
  assert.equal(result.movement, 'Cinema de favela');
  assert.deepEqual(result.mood, ['Frenetic', 'Unflinching']);
  assert.deepEqual(result.themes, ['Crime'], 'fields not present in the overlay should be untouched');
});

test('applyEnrichment returns the work unchanged (by value) when no matching entry exists', () => {
  const result = applyEnrichment(work, {});
  assert.deepEqual(result, work);
});

test('applyEnrichment does not mutate the original work object', () => {
  const enrichmentMap = { 'tmdb:598': { movement: 'Cinema de favela' } };
  applyEnrichment(work, enrichmentMap);
  assert.equal(work.movement, 'Brazil drama, 2000s');
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '.../scripts/lib/mergeWorks.mjs'` and `'.../scripts/lib/applyEnrichment.mjs'`.

- [ ] **Step 3: Implement `scripts/lib/mergeWorks.mjs`**

```js
export function sourceKey(work) {
  return `${work.source.type}:${work.source.sourceId}`;
}

export function mergeWorks(existingWorks, freshWorks) {
  const bySourceKey = new Map();
  for (const work of existingWorks) {
    bySourceKey.set(sourceKey(work), work);
  }
  for (const work of freshWorks) {
    bySourceKey.set(sourceKey(work), work);
  }
  return [...bySourceKey.values()];
}
```

- [ ] **Step 4: Implement `scripts/lib/applyEnrichment.mjs`**

```js
import { sourceKey } from './mergeWorks.mjs';

export function applyEnrichment(work, enrichmentMap) {
  const overlay = enrichmentMap[sourceKey(work)];
  if (!overlay) return work;
  return { ...work, ...overlay };
}
```

- [ ] **Step 5: Run the tests and verify they pass**

```bash
npm test
```

Expected: PASS — all `mergeWorks.test.js` and `applyEnrichment.test.js` tests pass, plus every prior test still passes.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/resonance
git add scripts/lib/mergeWorks.mjs scripts/lib/applyEnrichment.mjs test/mergeWorks.test.js test/applyEnrichment.test.js
git commit -m "Add pure work-merging and enrichment-overlay logic"
```

---

## Task 3: TMDB → work-schema mapper

**Files:**
- Create: `scripts/lib/mapTmdb.mjs`
- Test: `test/mapTmdb.test.js`

**Interfaces:**
- Consumes: `decadeLabel`, `ISO2_TO_COUNTRY_NAME` from `./coverage.mjs` (Task 1).
- Produces: `mapTmdbMovieToWork(raw) -> work` and `mapTmdbTvToWork(raw) -> work` from `scripts/lib/mapTmdb.mjs`, where `raw` is a TMDB `/movie/{id}?append_to_response=keywords,credits` or `/tv/{id}?append_to_response=keywords` detail response respectively. Consumed by `scripts/sync-data.mjs` in Task 5.

**Before writing code:** verify the exact shape of a real TMDB movie/TV detail response (particularly: does the TV keywords append still nest under `results` rather than `keywords`? does `credits.crew` entries use `job: "Director"` exactly?) against `https://developer.themoviedb.org/reference/movie-details` and `https://developer.themoviedb.org/reference/tv-series-details` before finalizing the fixtures below. If anything differs, adjust the fixtures AND the mapper together, and note the correction in your report.

- [ ] **Step 1: Write the failing tests**

Create `test/mapTmdb.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '.../scripts/lib/mapTmdb.mjs'`.

- [ ] **Step 3: Implement `scripts/lib/mapTmdb.mjs`**

```js
import { decadeLabel, ISO2_TO_COUNTRY_NAME } from './coverage.mjs';

const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_CREDIT = 'Poster and data courtesy of TMDB (themoviedb.org). This product uses the TMDB API but is not endorsed or certified by TMDB.';

const MOOD_KEYWORD_RULES = [
  { match: /noir|murder|serial killer|dark|crime|revenge|gang/i, mood: 'Tense' },
  { match: /comedy|satire|parody/i, mood: 'Playful' },
  { match: /romance|love/i, mood: 'Tender' },
  { match: /war|violence|dystopia|poverty/i, mood: 'Unflinching' },
  { match: /nostalgia|coming of age|memory/i, mood: 'Wistful' },
  { match: /horror|supernatural|ghost/i, mood: 'Unsettling' },
];

function slugify(title, yearOrLabel) {
  const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');
  const base = `${title}-${yearOrLabel}`
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `work-${yearOrLabel}`;
}

function deriveThemes(genres, keywords) {
  const genreNames = genres.map((g) => g.name);
  const keywordNames = keywords.slice(0, 6).map((k) => k.name);
  const themes = [...new Set([...genreNames, ...keywordNames])];
  return themes.length ? themes : ['Storytelling'];
}

function deriveMood(genres, keywords) {
  const haystack = [...genres.map((g) => g.name), ...keywords.map((k) => k.name)].join(' ');
  const matched = [...new Set(MOOD_KEYWORD_RULES.filter((rule) => rule.match.test(haystack)).map((rule) => rule.mood))];
  return matched.length ? matched : ['Evocative'];
}

function deriveMovement(genres, year, countryName) {
  const primaryGenre = genres[0] ? genres[0].name.toLowerCase() : 'work';
  const decade = year ? decadeLabel(year) : 'an unknown period';
  return countryName && countryName !== 'Unknown' ? `${countryName} ${primaryGenre}, ${decade}` : `${primaryGenre}, ${decade}`;
}

function resolveCountryName(productionCountries, originCountry) {
  if (productionCountries && productionCountries.length) return productionCountries[0].name;
  if (originCountry && originCountry.length) {
    return ISO2_TO_COUNTRY_NAME[originCountry[0]] || originCountry[0];
  }
  return 'Unknown';
}

function parseYear(dateString) {
  const year = Number((dateString || '').slice(0, 4));
  return Number.isInteger(year) && year > 0 ? year : null;
}

function buildImage(posterPath) {
  return posterPath ? `${IMAGE_BASE}${posterPath}` : null;
}

function buildCommonFields(raw, { medium, title, year, genres, keywords, country, language, creator }) {
  return {
    id: slugify(title, year ?? 'unknown'),
    title,
    creator,
    medium,
    year,
    decade: year ? decadeLabel(year) : 'unknown',
    country,
    language: language || 'unknown',
    movement: deriveMovement(genres, year, country),
    genre: genres[0] ? genres[0].name : 'Uncategorized',
    style: genres.length ? genres.map((g) => g.name) : ['Uncategorized'],
    themes: deriveThemes(genres, keywords),
    mood: deriveMood(genres, keywords),
    context: `Released in ${year ?? 'an unknown year'} in ${country}.`,
    description: raw.overview && raw.overview.trim() ? raw.overview.trim() : `${title} (${year ?? 'n.d.'}).`,
    image: buildImage(raw.poster_path),
    imageCredit: raw.poster_path ? TMDB_CREDIT : null,
    source: { type: 'tmdb', sourceId: String(raw.id) },
  };
}

export function mapTmdbMovieToWork(raw) {
  const year = parseYear(raw.release_date);
  const genres = raw.genres || [];
  const keywords = (raw.keywords && raw.keywords.keywords) || [];
  const country = resolveCountryName(raw.production_countries, null);
  const director = ((raw.credits && raw.credits.crew) || []).find((person) => person.job === 'Director');

  return buildCommonFields(raw, {
    medium: 'film',
    title: raw.title,
    year,
    genres,
    keywords,
    country,
    language: raw.original_language,
    creator: director ? director.name : 'Unknown',
  });
}

export function mapTmdbTvToWork(raw) {
  const year = parseYear(raw.first_air_date);
  const genres = raw.genres || [];
  const keywords = (raw.keywords && raw.keywords.results) || [];
  const country = resolveCountryName(null, raw.origin_country);
  const creators = raw.created_by || [];

  return buildCommonFields(raw, {
    medium: 'tv',
    title: raw.name,
    year,
    genres,
    keywords,
    country,
    language: raw.original_language,
    creator: creators.length ? creators.map((c) => c.name).join(', ') : 'Unknown',
  });
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
npm test
```

Expected: PASS — all `mapTmdb.test.js` tests pass, plus every prior test still passes.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/resonance
git add scripts/lib/mapTmdb.mjs test/mapTmdb.test.js
git commit -m "Add TMDB movie/TV to work-schema mapper"
```

---

## Task 4: TMDB API client

**Files:**
- Create: `scripts/sources/tmdb.mjs`
- Test: `test/tmdbSource.test.js`

**Interfaces:**
- Consumes: `createThrottle` from `../lib/rateLimit.mjs` (Task 1).
- Produces: `discoverMovieIds`, `discoverTvIds`, `fetchMovieDetail`, `fetchTvDetail`, `fetchRecentMovieIds`, `fetchRecentTvIds` from `scripts/sources/tmdb.mjs`. Consumed by `scripts/sync-data.mjs` in Task 5.

**Before writing code:** verify the exact discover/detail endpoint paths and parameter names (`primary_release_date.gte`/`.lte` for movies, `first_air_date.gte`/`.lte` for TV, `with_original_language`, `append_to_response`) against `https://developer.themoviedb.org/reference/discover-movie`, `https://developer.themoviedb.org/reference/discover-tv`, `https://developer.themoviedb.org/reference/movie-now-playing-list`, and `https://developer.themoviedb.org/reference/tv-series-on-the-air-list` before finalizing. Note any correction in your report.

- [ ] **Step 1: Write the failing tests**

Create `test/tmdbSource.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverMovieIds, fetchMovieDetail } from '../scripts/sources/tmdb.mjs';

test('discoverMovieIds passes the right query params and returns ids from the first page', async (t) => {
  let capturedUrl;
  t.mock.method(globalThis, 'fetch', async (url) => {
    capturedUrl = url.toString();
    return { ok: true, json: async () => ({ results: [{ id: 1 }, { id: 2 }, { id: 3 }], total_pages: 1 }) };
  });

  const ids = await discoverMovieIds('FAKE_KEY', { languageCode: 'pt', startYear: 2000, endYear: 2009, targetCount: 3 });

  assert.deepEqual(ids, [1, 2, 3]);
  assert.ok(capturedUrl.includes('with_original_language=pt'));
  assert.ok(capturedUrl.includes('primary_release_date.gte=2000-01-01') || capturedUrl.includes('primary_release_date.gte=2000-01-01'.replace(/\./g, '%2E')));
  assert.ok(capturedUrl.includes('2009-12-31'));
  assert.ok(capturedUrl.includes('api_key=FAKE_KEY'));
});

test('discoverMovieIds truncates to targetCount when more results are available than needed', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ results: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], total_pages: 1 }),
  }));

  const ids = await discoverMovieIds('FAKE_KEY', { languageCode: 'en', startYear: 2010, endYear: 2019, targetCount: 2 });

  assert.deepEqual(ids, [1, 2]);
});

test('discoverMovieIds throws a clear error on a failed response', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 401, statusText: 'Unauthorized' }));

  await assert.rejects(
    () => discoverMovieIds('BAD_KEY', { languageCode: 'en', startYear: 2000, endYear: 2009, targetCount: 5 }),
    /TMDB request failed: 401/
  );
});

test('fetchMovieDetail requests keywords and credits via append_to_response', async (t) => {
  let capturedUrl;
  t.mock.method(globalThis, 'fetch', async (url) => {
    capturedUrl = url.toString();
    return { ok: true, json: async () => ({ id: 598, title: 'City of God' }) };
  });

  const detail = await fetchMovieDetail('FAKE_KEY', 598);

  assert.equal(detail.title, 'City of God');
  assert.ok(capturedUrl.includes('/movie/598'));
  assert.ok(capturedUrl.includes('append_to_response=keywords') && capturedUrl.includes('credits'));
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '.../scripts/sources/tmdb.mjs'`.

- [ ] **Step 3: Implement `scripts/sources/tmdb.mjs`**

```js
import { createThrottle } from '../lib/rateLimit.mjs';

const BASE_URL = 'https://api.themoviedb.org/3';
const throttle = createThrottle(300); // comfortably under TMDB's documented free-tier limits

async function tmdbFetch(path, params, apiKey) {
  await throttle();
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('api_key', apiKey);
  for (const [key, value] of Object.entries(params || {})) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status} ${response.statusText} — ${url.pathname}${url.search}`);
  }
  return response.json();
}

async function discoverIds(path, dateFromParam, dateToParam, apiKey, { languageCode, startYear, endYear, targetCount }) {
  const ids = [];
  let page = 1;
  while (ids.length < targetCount && page <= 500) {
    const data = await tmdbFetch(path, {
      with_original_language: languageCode,
      [dateFromParam]: `${startYear}-01-01`,
      [dateToParam]: `${endYear}-12-31`,
      sort_by: 'popularity.desc',
      page,
    }, apiKey);
    if (!data.results || !data.results.length) break;
    ids.push(...data.results.map((r) => r.id));
    if (page >= (data.total_pages || 1)) break;
    page += 1;
  }
  return ids.slice(0, targetCount);
}

export async function discoverMovieIds(apiKey, options) {
  return discoverIds('/discover/movie', 'primary_release_date.gte', 'primary_release_date.lte', apiKey, options);
}

export async function discoverTvIds(apiKey, options) {
  return discoverIds('/discover/tv', 'first_air_date.gte', 'first_air_date.lte', apiKey, options);
}

export async function fetchMovieDetail(apiKey, id) {
  return tmdbFetch(`/movie/${id}`, { append_to_response: 'keywords,credits' }, apiKey);
}

export async function fetchTvDetail(apiKey, id) {
  return tmdbFetch(`/tv/${id}`, { append_to_response: 'keywords' }, apiKey);
}

export async function fetchRecentMovieIds(apiKey, { targetCount }) {
  const data = await tmdbFetch('/movie/now_playing', { page: 1 }, apiKey);
  return (data.results || []).slice(0, targetCount).map((r) => r.id);
}

export async function fetchRecentTvIds(apiKey, { targetCount }) {
  const data = await tmdbFetch('/tv/on_the_air', { page: 1 }, apiKey);
  return (data.results || []).slice(0, targetCount).map((r) => r.id);
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
npm test
```

Expected: PASS — all `tmdbSource.test.js` tests pass (no real network calls — `fetch` is mocked), plus every prior test still passes.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/resonance
git add scripts/sources/tmdb.mjs test/tmdbSource.test.js
git commit -m "Add TMDB API client with mocked-fetch tests"
```

---

## Task 5: Sync orchestrator

**Files:**
- Create: `scripts/sync-data.mjs`
- Modify: `package.json` — add a `sync-data` script
- Test: `test/syncData.test.js`

**Interfaces:**
- Consumes: `LANGUAGE_SAMPLES`, `DECADES` from `./lib/coverage.mjs`; `mergeWorks` from `./lib/mergeWorks.mjs`; `applyEnrichment` from `./lib/applyEnrichment.mjs`; `mapTmdbMovieToWork`, `mapTmdbTvToWork` from `./lib/mapTmdb.mjs`; the six functions from `./sources/tmdb.mjs`.
- Produces: `runSync({dataFile, enrichmentFile, fetchFresh, apiKey, incremental}) -> {existingCount, freshCount, totalCount}`, exported for testing. `main()` is the real CLI entry point, not exported/tested directly — it wires `runSync` to the real file paths and the real TMDB-calling `fetchFresh` implementations.

- [ ] **Step 1: Write the failing tests**

Create `test/syncData.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSync } from '../scripts/sync-data.mjs';

test('runSync writes a fresh js/data.js and reports accurate counts when nothing existed before', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'resonance-sync-'));
  const dataFile = join(dir, 'data.js');
  const enrichmentFile = join(dir, 'enrichment.json');
  writeFileSync(enrichmentFile, '{}');

  const fakeFresh = [
    { id: 'a', title: 'A', source: { type: 'tmdb', sourceId: '1' } },
    { id: 'b', title: 'B', source: { type: 'tmdb', sourceId: '2' } },
  ];
  const fetchFresh = async () => fakeFresh;

  const result = await runSync({ dataFile, enrichmentFile, fetchFresh, apiKey: 'fake', incremental: false });

  assert.equal(result.existingCount, 0);
  assert.equal(result.freshCount, 2);
  assert.equal(result.totalCount, 2);

  const written = await import(`file://${dataFile}?t=${Date.now()}`);
  assert.equal(written.works.length, 2);

  rmSync(dir, { recursive: true, force: true });
});

test('runSync merges fresh works into an existing generated data.js without duplicating', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'resonance-sync-'));
  const dataFile = join(dir, 'data.js');
  const enrichmentFile = join(dir, 'enrichment.json');
  writeFileSync(enrichmentFile, '{}');
  writeFileSync(dataFile, `export const works = ${JSON.stringify([
    { id: 'a', title: 'Old A', source: { type: 'tmdb', sourceId: '1' } },
  ])};\n`);

  const fetchFresh = async () => [{ id: 'a', title: 'New A', source: { type: 'tmdb', sourceId: '1' } }];
  const result = await runSync({ dataFile, enrichmentFile, fetchFresh, apiKey: 'fake', incremental: false });

  assert.equal(result.totalCount, 1);
  const written = await import(`file://${dataFile}?t=${Date.now()}`);
  assert.equal(written.works[0].title, 'New A');

  rmSync(dir, { recursive: true, force: true });
});

test('runSync passes the enrichment map and incremental flag through to fetchFresh', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'resonance-sync-'));
  const dataFile = join(dir, 'data.js');
  const enrichmentFile = join(dir, 'enrichment.json');
  writeFileSync(enrichmentFile, JSON.stringify({ 'tmdb:1': { movement: 'Curated' } }));

  let capturedEnrichment;
  let capturedIncremental;
  const fetchFresh = async (apiKey, enrichmentMap, incremental) => {
    capturedEnrichment = enrichmentMap;
    capturedIncremental = incremental;
    return [];
  };

  await runSync({ dataFile, enrichmentFile, fetchFresh, apiKey: 'fake', incremental: true });

  assert.deepEqual(capturedEnrichment, { 'tmdb:1': { movement: 'Curated' } });
  assert.equal(capturedIncremental, true);

  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '.../scripts/sync-data.mjs'`.

- [ ] **Step 3: Implement `scripts/sync-data.mjs`**

```js
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

import { LANGUAGE_SAMPLES, DECADES } from './lib/coverage.mjs';
import { mergeWorks } from './lib/mergeWorks.mjs';
import { applyEnrichment } from './lib/applyEnrichment.mjs';
import { mapTmdbMovieToWork, mapTmdbTvToWork } from './lib/mapTmdb.mjs';
import * as tmdb from './sources/tmdb.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REAL_DATA_FILE = join(__dirname, '..', 'js', 'data.js');
const REAL_ENRICHMENT_FILE = join(__dirname, '..', 'data', 'enrichment.json');

const TARGET_PER_LANGUAGE_MOVIE = 40; // ~40 x 15 languages ≈ 600 movies per full run
const TARGET_PER_LANGUAGE_TV = 30;    // ~30 x 15 languages ≈ 450 TV shows per full run
const RECENT_TARGET = 100;

export async function loadExistingWorks(dataFile) {
  if (!existsSync(dataFile)) return [];
  const mod = await import(`${pathToFileURL(dataFile).href}?t=${Date.now()}`);
  return mod.works || [];
}

export function loadEnrichment(enrichmentFile) {
  if (!existsSync(enrichmentFile)) return {};
  return JSON.parse(readFileSync(enrichmentFile, 'utf8'));
}

export function writeDataFile(dataFile, works) {
  const header = [
    '// AUTO-GENERATED by scripts/sync-data.mjs — do not hand-edit.',
    '// Run `npm run sync-data` to refresh, or `npm run sync-data -- --new` for an incremental update.',
    '// Optional hand-curation lives in data/enrichment.json, keyed by "<source.type>:<source.sourceId>".',
    '',
    '',
  ].join('\n');
  writeFileSync(dataFile, `${header}export const works = ${JSON.stringify(works, null, 2)};\n`, 'utf8');
}

async function fetchTmdbFull(apiKey, enrichmentMap) {
  const fresh = [];
  for (const { code } of LANGUAGE_SAMPLES) {
    for (const { start, end } of DECADES) {
      try {
        const movieIds = await tmdb.discoverMovieIds(apiKey, {
          languageCode: code, startYear: start, endYear: end,
          targetCount: Math.max(1, Math.ceil(TARGET_PER_LANGUAGE_MOVIE / DECADES.length)),
        });
        for (const id of movieIds) {
          const detail = await tmdb.fetchMovieDetail(apiKey, id);
          fresh.push(applyEnrichment(mapTmdbMovieToWork(detail), enrichmentMap));
        }
      } catch (err) {
        console.warn(`[tmdb] movie discover failed for ${code} ${start}-${end}: ${err.message}`);
      }

      try {
        const tvIds = await tmdb.discoverTvIds(apiKey, {
          languageCode: code, startYear: start, endYear: end,
          targetCount: Math.max(1, Math.ceil(TARGET_PER_LANGUAGE_TV / DECADES.length)),
        });
        for (const id of tvIds) {
          const detail = await tmdb.fetchTvDetail(apiKey, id);
          fresh.push(applyEnrichment(mapTmdbTvToWork(detail), enrichmentMap));
        }
      } catch (err) {
        console.warn(`[tmdb] tv discover failed for ${code} ${start}-${end}: ${err.message}`);
      }
    }
  }
  return fresh;
}

async function fetchTmdbRecent(apiKey, enrichmentMap) {
  const fresh = [];
  try {
    const movieIds = await tmdb.fetchRecentMovieIds(apiKey, { targetCount: RECENT_TARGET });
    for (const id of movieIds) {
      const detail = await tmdb.fetchMovieDetail(apiKey, id);
      fresh.push(applyEnrichment(mapTmdbMovieToWork(detail), enrichmentMap));
    }
  } catch (err) {
    console.warn(`[tmdb] recent movies failed: ${err.message}`);
  }
  try {
    const tvIds = await tmdb.fetchRecentTvIds(apiKey, { targetCount: RECENT_TARGET });
    for (const id of tvIds) {
      const detail = await tmdb.fetchTvDetail(apiKey, id);
      fresh.push(applyEnrichment(mapTmdbTvToWork(detail), enrichmentMap));
    }
  } catch (err) {
    console.warn(`[tmdb] recent tv failed: ${err.message}`);
  }
  return fresh;
}

export async function runSync({ dataFile, enrichmentFile, fetchFresh, apiKey, incremental }) {
  const existing = await loadExistingWorks(dataFile);
  const enrichmentMap = loadEnrichment(enrichmentFile);
  const fresh = await fetchFresh(apiKey, enrichmentMap, incremental);
  const merged = mergeWorks(existing, fresh);
  writeDataFile(dataFile, merged);
  return { existingCount: existing.length, freshCount: fresh.length, totalCount: merged.length };
}

async function main() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error(
      'Missing TMDB_API_KEY environment variable.\n' +
      'Get a free key at https://www.themoviedb.org/settings/api and run:\n' +
      '  TMDB_API_KEY=your-key npm run sync-data'
    );
    process.exit(1);
  }
  const incremental = process.argv.includes('--new');
  const result = await runSync({
    dataFile: REAL_DATA_FILE,
    enrichmentFile: REAL_ENRICHMENT_FILE,
    fetchFresh: incremental ? fetchTmdbRecent : fetchTmdbFull,
    apiKey,
    incremental,
  });
  console.log(`Sync complete: ${result.freshCount} fetched, ${result.totalCount} total works in js/data.js (was ${result.existingCount}).`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
```

Note the final `if (import.meta.url === ...)` guard: it makes `main()` run only when the file is executed directly (`node scripts/sync-data.mjs`), not when `runSync`/`loadExistingWorks`/etc. are imported by the test file — this is what makes the module safely testable without triggering a real sync.

- [ ] **Step 4: Add the npm script**

In `package.json`, add a `sync-data` entry to `"scripts"`:

```json
{
  "scripts": {
    "test": "node --test",
    "serve": "python3 -m http.server 8000",
    "sync-data": "node scripts/sync-data.mjs"
  }
}
```

- [ ] **Step 5: Run the tests and verify they pass**

```bash
npm test
```

Expected: PASS — all `syncData.test.js` tests pass (no real network calls — `fetchFresh` is injected), plus every prior test still passes.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/resonance
git add scripts/sync-data.mjs package.json test/syncData.test.js
git commit -m "Add sync-data orchestrator wiring TMDB into js/data.js"
```

---

## Task 6: Real-image-or-typography rendering, remove procedural artwork, update schema tests

**Files:**
- Modify: `js/render.js`
- Modify: `css/style.css`
- Modify: `test/data.test.js`
- Modify: `js/data.js` — replace with a small placeholder dataset in the new schema shape
- Delete: `js/artwork.js`
- Delete: `test/artwork.test.js`

**Interfaces:**
- Consumes: nothing new — `work.image`, `work.imageCredit` are read directly from work objects already flowing through `render.js`.
- Produces: nothing new consumed by later tasks — this is the last code task before the real sync run.

- [ ] **Step 1: Remove the procedural artwork import from `js/render.js`**

Delete this line near the top of `js/render.js`:

```js
import { generateArtworkSVG } from './artwork.js';
```

- [ ] **Step 2: Add the `renderWorkArt` helper to `js/render.js`**

Add this function directly after the existing `escapeHtml` function:

```js
function renderWorkArt(work) {
  if (work.image) {
    const credit = work.imageCredit
      ? `<span class="work-art__credit tag">${escapeHtml(work.imageCredit)}</span>`
      : '';
    return `<img class="work-art__image" src="${escapeHtml(work.image)}" alt="${escapeHtml(work.title)}" loading="lazy">${credit}`;
  }
  return `
    <div class="work-art__fallback">
      <span class="work-art__fallback-title">${escapeHtml(work.title)}</span>
      <span class="tag work-art__fallback-medium">${escapeHtml(work.medium)}</span>
    </div>
  `;
}
```

- [ ] **Step 3: Replace every `generateArtworkSVG` call site in `js/render.js`**

There are 5 call sites. Replace each exactly as follows (the surrounding markup/classes stay identical — only the inner expression changes):

1. In `renderExplore`'s card template: replace `${generateArtworkSVG(work, 200)}` with `${renderWorkArt(work)}`
2. In `renderWorkDetail`'s detail layout: replace `${generateArtworkSVG(work, 420)}` with `${renderWorkArt(work)}`
3. In `renderWorkDetail`'s connections grid: replace `${generateArtworkSVG(c.work, 100)}` with `${renderWorkArt(c.work)}`
4. In `renderSurprise`'s featured work: replace `${generateArtworkSVG(work, 320)}` with `${renderWorkArt(work)}`
5. In `renderSurprise`'s hook connection card: replace `${generateArtworkSVG(hook.work, 100)}` with `${renderWorkArt(hook.work)}`

- [ ] **Step 4: Update `css/style.css` for the new art rendering**

Replace these existing rules:

```css
.work-card__art { line-height: 0; }
.work-card__art svg { width: 100%; height: auto; display: block; }
```

with:

```css
.work-card__art { line-height: 0; aspect-ratio: 1 / 1; overflow: hidden; }
```

Replace:

```css
.detail__art svg { width: 100%; height: auto; display: block; border: 1px solid var(--line); }
```

with:

```css
.detail__art { aspect-ratio: 1 / 1; overflow: hidden; border: 1px solid var(--line); }
```

Replace:

```css
.connection-card__art { width: 60px; height: 60px; flex-shrink: 0; line-height: 0; }
.connection-card__art svg { width: 100%; height: 100%; display: block; }
```

with:

```css
.connection-card__art { width: 60px; height: 60px; flex-shrink: 0; line-height: 0; overflow: hidden; }
```

Replace:

```css
.surprise__art svg { width: 100%; height: auto; display: block; border: 1px solid var(--line); }
```

with:

```css
.surprise__art { aspect-ratio: 1 / 1; overflow: hidden; border: 1px solid var(--line); }
```

Then append this new block at the end of the file (after the existing `/* ===== Mobile adjustments ===== */` block from the prior plan):

```css
/* ===== Work art: real image or typography fallback ===== */
.work-art__image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.work-art__credit {
  display: block;
  margin-top: 4px;
  opacity: 0.6;
  font-size: 10px;
}
.work-art__fallback {
  width: 100%;
  height: 100%;
  min-height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: linear-gradient(135deg, var(--line) 0%, transparent 100%);
  padding: 10px;
  text-align: center;
}
.work-art__fallback-title {
  font-family: var(--f-display);
  font-weight: 600;
  font-size: 0.85rem;
  line-height: 1.2;
  color: var(--ink);
}
.work-art__fallback-medium { text-transform: uppercase; }
```

- [ ] **Step 5: Delete the procedural artwork module and its test**

```bash
cd ~/Desktop/resonance
rm js/artwork.js test/artwork.test.js
```

- [ ] **Step 6: Replace `js/data.js` with a small placeholder in the new schema**

Every work needs the two new fields (`image`, `imageCredit`) and a `source` object. This placeholder deliberately sets every `image` to `null` (demonstrating only the typography-fallback treatment — the real image treatment gets its first genuine visual check in Task 7 against real TMDB poster URLs, rather than guessing at a placeholder image URL here) and includes both `film` and `tv` works with at least one Brazilian entry, so the updated schema tests (Step 7) pass:

```js
// AUTO-GENERATED by scripts/sync-data.mjs — do not hand-edit.
// Run `npm run sync-data` to refresh, or `npm run sync-data -- --new` for an incremental update.
// Optional hand-curation lives in data/enrichment.json, keyed by "<source.type>:<source.sourceId>".
// This is a placeholder committed before the first real sync — see Task 7 of
// docs/superpowers/plans/2026-09-02-resonance-data-sourcing-tmdb.md.

export const works = [
  {
    id: 'placeholder-city-of-god-2002', title: 'City of God', creator: 'Fernando Meirelles',
    medium: 'film', year: 2002, decade: '2000s', country: 'Brazil', language: 'pt',
    movement: 'Brazil crime, 2000s', genre: 'Crime', style: ['Crime', 'Drama'],
    themes: ['Crime', 'poverty'], mood: ['Tense'],
    context: 'Released in 2002 in Brazil.',
    description: 'Placeholder entry pending the first real sync run.',
    image: null, imageCredit: null, source: { type: 'tmdb', sourceId: 'placeholder-1' },
  },
  {
    id: 'placeholder-city-of-men-2002', title: 'City of Men', creator: 'Unknown',
    medium: 'tv', year: 2002, decade: '2000s', country: 'Brazil', language: 'pt',
    movement: 'Brazil drama, 2000s', genre: 'Drama', style: ['Drama'],
    themes: ['Drama'], mood: ['Evocative'],
    context: 'Released in 2002 in Brazil.',
    description: 'Placeholder entry pending the first real sync run.',
    image: null, imageCredit: null, source: { type: 'tmdb', sourceId: 'placeholder-2' },
  },
  {
    id: 'placeholder-seven-samurai-1954', title: 'Seven Samurai', creator: 'Akira Kurosawa',
    medium: 'film', year: 1954, decade: '1950s', country: 'Japan', language: 'ja',
    movement: 'Japan drama, 1950s', genre: 'Drama', style: ['Drama', 'Action'],
    themes: ['Honor', 'Sacrifice'], mood: ['Epic'],
    context: 'Released in 1954 in Japan.',
    description: 'Placeholder entry pending the first real sync run.',
    image: null, imageCredit: null, source: { type: 'tmdb', sourceId: 'placeholder-3' },
  },
  {
    id: 'placeholder-breaking-bad-2008', title: 'Breaking Bad', creator: 'Vince Gilligan',
    medium: 'tv', year: 2008, decade: '2000s', country: 'United States', language: 'en',
    movement: 'United States drama, 2000s', genre: 'Drama', style: ['Drama', 'Crime'],
    themes: ['Crime', 'drug'], mood: ['Tense'],
    context: 'Released in 2008 in United States.',
    description: 'Placeholder entry pending the first real sync run.',
    image: null, imageCredit: null, source: { type: 'tmdb', sourceId: 'placeholder-4' },
  },
  {
    id: 'placeholder-amelie-2001', title: 'Amélie', creator: 'Jean-Pierre Jeunet',
    medium: 'film', year: 2001, decade: '2000s', country: 'France', language: 'fr',
    movement: 'France romance, 2000s', genre: 'Romance', style: ['Romance', 'Comedy'],
    themes: ['Whimsy'], mood: ['Playful'],
    context: 'Released in 2001 in France.',
    description: 'Placeholder entry pending the first real sync run.',
    image: null, imageCredit: null, source: { type: 'tmdb', sourceId: 'placeholder-5' },
  },
  {
    id: 'placeholder-dark-2017', title: 'Dark', creator: 'Baran bo Odar, Jantje Friese',
    medium: 'tv', year: 2017, decade: '2010s', country: 'Germany', language: 'de',
    movement: 'Germany mystery, 2010s', genre: 'Mystery', style: ['Mystery', 'Drama'],
    themes: ['Time travel'], mood: ['Unsettling'],
    context: 'Released in 2017 in Germany.',
    description: 'Placeholder entry pending the first real sync run.',
    image: null, imageCredit: null, source: { type: 'tmdb', sourceId: 'placeholder-6' },
  },
];
```

- [ ] **Step 7: Update `test/data.test.js` for the new schema and scale**

Replace the file's contents entirely with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { works } from '../js/data.js';

const VALID_MEDIA = new Set(['music', 'film', 'tv', 'literature', 'photography', 'visual-arts']);
const REQUIRED_STRING_FIELDS = ['id', 'title', 'creator', 'medium', 'country', 'language', 'movement', 'genre', 'context', 'description'];
const REQUIRED_ARRAY_FIELDS = ['style', 'themes', 'mood'];
const VALID_SOURCE_TYPES = new Set(['tmdb', 'musicbrainz', 'openlibrary', 'met']);

// Grows as more source integrations land — see
// docs/superpowers/specs/2026-09-02-resonance-data-sourcing-design.md.
const SOURCED_MEDIA = ['film', 'tv'];

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

test('the collection spans every currently-integrated medium', () => {
  const mediaPresent = new Set(works.map((w) => w.medium));
  for (const medium of SOURCED_MEDIA) {
    assert.ok(mediaPresent.has(medium), `no work found for medium "${medium}"`);
  }
});

test('the collection includes at least one Brazilian work', () => {
  assert.ok(works.some((w) => w.country === 'Brazil'), 'expected at least one Brazilian work');
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
```

- [ ] **Step 8: Run the tests and verify they pass**

```bash
npm test
```

Expected: PASS — the full suite (router, filters, similarity, rateLimit, coverage, mergeWorks, applyEnrichment, mapTmdb, tmdbSource, syncData, data) passes with no reference to the deleted `artwork.test.js`.

- [ ] **Step 9: Verify in the browser**

Reload `http://localhost:8000/` (start the server first if it isn't running: `python3 -m http.server 8000`). Confirm: every card/detail/connection view shows the clean typography-only fallback treatment (no broken-looking gap, no leftover procedural art) since every placeholder work has `image: null`. Confirm no console errors.

- [ ] **Step 10: Commit**

```bash
cd ~/Desktop/resonance
git add js/render.js css/style.css js/data.js test/data.test.js
git rm js/artwork.js test/artwork.test.js
git commit -m "Replace procedural artwork with real-image-or-typography rendering; update schema tests"
```

---

## Task 7: Run the real TMDB sync (controller-executed, not delegated)

**This task is not dispatched to an implementer subagent.** It requires a live secret (a TMDB API key) that only the project owner can obtain and that should not be typed into an autonomous subagent's dispatch prompt or transcript. Whoever is driving this plan's execution (the controller, in an SDD run) performs this task directly, with the user, in the session.

- [ ] **Step 1: Get a TMDB API key**

If you don't already have one: sign up for a free account at https://www.themoviedb.org/signup, then go to Settings → API and request a developer API key (approval is typically immediate). Provide the key either by pasting it in chat, or by running `export TMDB_API_KEY=your-key-here` yourself in a terminal you control (via the `!` prefix if working through the assistant) so it never needs to be typed into the shared conversation.

- [ ] **Step 2: Run the full sync**

```bash
cd ~/Desktop/resonance
TMDB_API_KEY=<key> npm run sync-data
```

This will take a while — roughly 15 × 13 = 195 language/decade buckets, each fetching up to ~3 movie IDs and ~2 TV IDs plus a detail call per ID (rate-limited to ~3 req/sec). Expect somewhere in the range of 10-30 minutes depending on how many buckets have enough real matches. Run this with `run_in_background: true` if driving it through the assistant, and check in periodically rather than blocking on it.

- [ ] **Step 3: Verify the result**

```bash
npm test
```

Expected: PASS — the schema tests in `test/data.test.js` validate whatever real dataset the sync produced.

Then inspect the real numbers:

```bash
node -e "
import('./js/data.js').then(({ works }) => {
  console.log('Total:', works.length);
  console.log('Film:', works.filter(w => w.medium === 'film').length);
  console.log('TV:', works.filter(w => w.medium === 'tv').length);
  console.log('Countries:', new Set(works.map(w => w.country)).size);
  console.log('Decades:', [...new Set(works.map(w => w.decade))].sort());
  console.log('Brazilian works:', works.filter(w => w.country === 'Brazil').length);
  console.log('With images:', works.filter(w => w.image).length, '/', works.length);
});
"
```

- [ ] **Step 4: Verify in the browser**

Reload `http://localhost:8000/#/explore`. Confirm: real posters appear on cards that have them (with a small credit caption), a clean typography treatment appears where TMDB had no poster, filters show real breadth of countries/decades/genres, and clicking through to a work detail page shows real data with real connections.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/resonance
git add js/data.js
git commit -m "Run first real TMDB sync: populate js/data.js from the live API"
```

- [ ] **Step 6: Report real numbers to the user**

Summarize what was achieved: total work count, film/TV split, country/decade breadth, how many works got real images vs. the typography fallback, and how long the sync took — this informs whether `TARGET_PER_LANGUAGE_MOVIE`/`TARGET_PER_LANGUAGE_TV` in `scripts/sync-data.mjs` should be adjusted before the next source (Music, via MusicBrainz) is planned.

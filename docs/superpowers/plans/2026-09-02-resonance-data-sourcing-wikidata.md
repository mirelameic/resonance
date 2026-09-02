# RESONANCE Data Sourcing — Replace TMDB with Wikidata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Task 4 is explicitly controller-executed, not delegated to an implementer subagent — see its notes.**

**Goal:** Replace the TMDB film/TV source (built in `docs/superpowers/plans/2026-09-02-resonance-data-sourcing-tmdb.md`, Tasks 1-6, all complete and committed) with Wikidata's public SPARQL endpoint — CC0-licensed, no API key, no signup, and explicitly free for commercial use (unlike TMDB, whose free tier excludes commercial use and would cost $149/mo once RESONANCE is monetized). Tasks 1-2 from the prior plan (rate limiting, coverage sampling, merge/enrichment logic) are source-agnostic and untouched. This plan deletes the TMDB-specific mapper and client, replaces them with Wikidata equivalents, rewires the orchestrator, and runs the real sync — this time with zero credentials required.

**Architecture:** `scripts/sources/wikidata.mjs` queries `https://query.wikidata.org/sparql` with hand-built SPARQL, aggregating each film/TV item's multi-valued properties (genre, director) into single rows via `GROUP_CONCAT`/`SAMPLE` so one query returns fully-detailed results directly — no separate "discover IDs then fetch detail per ID" round trip like TMDB needed. `scripts/lib/mapWikidata.mjs` maps each result row to RESONANCE's existing work schema. Everything downstream (`js/filters.js`, `js/similarity.js`, `js/render.js`) is completely unaffected — the schema shape hasn't changed, only which `source.type` value appears and where `image`/`imageCredit`/factual fields come from.

**Tech Stack:** Node.js (built-in `fetch`, built-in `node:test` including `mock`), vanilla JS ES modules, zero npm dependencies, zero API keys.

**Spec:** `docs/superpowers/specs/2026-09-02-resonance-data-sourcing-design.md` (Sources table row for Film/TV, updated 2026-09-02 to reflect this swap)

## Global Constraints

- Zero new npm dependencies.
- No API key, no `.env` file, no credential of any kind — Wikidata's SPARQL endpoint requires none. The only header needed is a descriptive `User-Agent` per Wikidata's etiquette (contact info, not a secret).
- The deployed app makes zero runtime API calls — all Wikidata access happens in the offline `scripts/sync-data.mjs` script, exactly as TMDB access did.
- Wikidata's query service is rate-limited to 5 parallel queries per IP; this project only ever issues sequential queries (one at a time, throttled), well under that ceiling — but a `429 Too Many Requests` response must be caught and logged, not crash the run, exactly like a failed TMDB request was handled.
- Wikidata property/item IDs used in this plan (`P31` instance-of, `Q11424` film, `Q5398426` television series, `P577` publication date, `P136` genre, `P57` director, `P495` country of origin, `P364` original language, `P18` image, `Q155` Brazil) are written from well-established, extremely commonly-referenced Wikidata identifiers. **Each implementer must verify the exact IDs they use by running a small test query against the live endpoint** (e.g., confirm `wd:Q155 rdfs:label "Brazil"@en` resolves, confirm a known film like City of God — `wd:Q186358` — actually has `wdt:P31 wd:Q11424`) before finalizing that task, and correct any that don't match, noting the correction in their report.
- Image URLs are built from Wikidata's `P18` (image) property, which points to a Wikimedia Commons filename — converted to a fetchable URL via Commons' `Special:FilePath` redirect (`https://commons.wikimedia.org/wiki/Special:FilePath/{filename}`), a standard, well-documented Commons URL pattern. `imageCredit` uses a neutral "Image via Wikimedia Commons" line rather than asserting a specific license, since individual Commons files carry their own license (which varies file-to-file) distinct from Wikidata's own CC0 data license — this project does not claim a specific per-image license it hasn't verified.
- Every pure function (mapping, SPARQL query-string construction) is unit-tested with `node --test`. Network calls are verified via mocked `fetch` (`t.mock.method`), no real network calls in the automated suite.

---

## Task 1: Delete the TMDB-specific mapper and client

**Files:**
- Delete: `scripts/lib/mapTmdb.mjs`
- Delete: `test/mapTmdb.test.js`
- Delete: `scripts/sources/tmdb.mjs`
- Delete: `test/tmdbSource.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing — this is a pure deletion, clearing the way for Tasks 2-3 to build the Wikidata equivalents without any leftover dead code or naming confusion.

- [ ] **Step 1: Delete the four files**

```bash
cd ~/Desktop/resonance
git rm scripts/lib/mapTmdb.mjs test/mapTmdb.test.js scripts/sources/tmdb.mjs test/tmdbSource.test.js
```

- [ ] **Step 2: Run the tests and confirm the expected failure**

```bash
npm test
```

Expected: FAIL — `scripts/sync-data.mjs` still imports `./lib/mapTmdb.mjs` and `./sources/tmdb.mjs`, both now missing. This failure is expected and will be resolved by Task 3 (which rewires the orchestrator); do not attempt to fix it in this task.

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/resonance
git commit -m "Remove TMDB-specific mapper and client, superseded by Wikidata"
```

Note in your commit: this leaves the test suite red until Task 3 lands — that's expected and documented here, not a mistake to fix.

---

## Task 2: Wikidata → work-schema mapper

**Files:**
- Create: `scripts/lib/mapWikidata.mjs`
- Test: `test/mapWikidata.test.js`

**Interfaces:**
- Consumes: `decadeLabel` from `./coverage.mjs` (already exists, from the prior plan's Task 1).
- Produces: `mapWikidataFilmToWork(binding)` and `mapWikidataTvToWork(binding)` from `scripts/lib/mapWikidata.mjs`, where `binding` is one row of a Wikidata SPARQL JSON result's `results.bindings` array (shape documented below). Consumed by `scripts/sources/wikidata.mjs` (Task 3's test fixtures) and `scripts/sync-data.mjs` (Task 4).

**Before writing code:** verify the assumed SPARQL result shape against a real query. Run this exact query (URL-encode the `query` parameter) against `https://query.wikidata.org/sparql?format=json&query=...` with a `User-Agent` header like `RESONANCE-sync/1.0 (contact: <your email or the project's github repo URL>)`:

```sparql
SELECT ?item ?itemLabel
       (GROUP_CONCAT(DISTINCT ?directorLabel; separator=", ") AS ?directors)
       (SAMPLE(?countryLabel) AS ?country)
       (SAMPLE(?langLabel) AS ?language)
       (GROUP_CONCAT(DISTINCT ?genreLabel; separator="|") AS ?genres)
       (SAMPLE(?date) AS ?date)
       (SAMPLE(?image) AS ?image)
WHERE {
  VALUES ?item { wd:Q186358 }
  ?item wdt:P31 wd:Q11424 .
  ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en")
  OPTIONAL { ?item wdt:P577 ?date. }
  OPTIONAL { ?item wdt:P57 ?director. ?director rdfs:label ?directorLabel. FILTER(LANG(?directorLabel) = "en") }
  OPTIONAL { ?item wdt:P495 ?country. ?country rdfs:label ?countryLabel. FILTER(LANG(?countryLabel) = "en") }
  OPTIONAL { ?item wdt:P364 ?lang. ?lang rdfs:label ?langLabel. FILTER(LANG(?langLabel) = "en") }
  OPTIONAL { ?item wdt:P136 ?genre. ?genre rdfs:label ?genreLabel. FILTER(LANG(?genreLabel) = "en") }
  OPTIONAL { ?item wdt:P18 ?image. }
}
GROUP BY ?item ?itemLabel
```

(`wd:Q186358` is assumed here to be *City of God* — verify this specific QID resolves to that film; if it doesn't, substitute any well-known real film's QID you can confirm, and note the substitution.) Confirm: the JSON response's `results.bindings[0]` has fields named exactly `item`, `itemLabel`, `directors`, `country`, `language`, `genres`, `date`, `image` (matching the `AS ?alias` names above), each shaped `{type, value}` (and `{type:'uri', value:'http://www.wikidata.org/entity/Q...'}` specifically for `item`), and that `date` is an ISO-8601-like string (e.g. `2002-01-01T00:00:00Z`), `genres` is a `|`-separated string, `directors` is a `, `-separated string. Adjust the fixtures below and the mapper together if reality differs, and note it in your report.

- [ ] **Step 1: Write the failing tests**

Create `test/mapWikidata.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapWikidataFilmToWork, mapWikidataTvToWork } from '../scripts/lib/mapWikidata.mjs';

function binding(fields) {
  const row = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    row[key] = { type: key === 'item' ? 'uri' : 'literal', value };
  }
  return row;
}

const filmBinding = binding({
  item: 'http://www.wikidata.org/entity/Q186358',
  itemLabel: 'City of God',
  directors: 'Fernando Meirelles',
  country: 'Brazil',
  language: 'Portuguese',
  genres: 'crime film|drama film',
  date: '2002-01-01T00:00:00Z',
  image: 'City of God poster.jpg',
});

const tvBinding = binding({
  item: 'http://www.wikidata.org/entity/Q886971',
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
  assert.deepEqual(work.source, { type: 'wikidata', sourceId: 'Q186358' });
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
  assert.deepEqual(work.source, { type: 'wikidata', sourceId: 'Q886971' });
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
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '.../scripts/lib/mapWikidata.mjs'` (in addition to the still-expected Task-1 failure from the deleted TMDB files, which Task 3 resolves).

- [ ] **Step 3: Implement `scripts/lib/mapWikidata.mjs`**

```js
import { decadeLabel } from './coverage.mjs';

const COMMONS_CREDIT = 'Image via Wikimedia Commons.';

const MOOD_KEYWORD_RULES = [
  { match: /crime|noir|thriller/i, mood: 'Tense' },
  { match: /comedy/i, mood: 'Playful' },
  { match: /romance/i, mood: 'Tender' },
  { match: /war|drama/i, mood: 'Unflinching' },
  { match: /horror/i, mood: 'Unsettling' },
];

function value(binding, key) {
  return binding[key] && binding[key].value ? binding[key].value : null;
}

function qidFromUri(uri) {
  const match = /Q\d+$/.exec(uri || '');
  return match ? match[0] : 'unknown';
}

function slugify(title, yearOrLabel) {
  const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');
  const base = `${title}-${yearOrLabel}`
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `work-${yearOrLabel}`;
}

function parseYear(dateString) {
  const year = Number((dateString || '').slice(0, 4));
  return Number.isInteger(year) && year > 0 ? year : null;
}

function splitList(raw, separator) {
  return raw ? raw.split(separator).map((s) => s.trim()).filter(Boolean) : [];
}

function deriveThemes(genres) {
  return genres.length ? genres : ['Storytelling'];
}

function deriveMood(genres) {
  const haystack = genres.join(' ');
  const matched = [...new Set(MOOD_KEYWORD_RULES.filter((rule) => rule.match.test(haystack)).map((rule) => rule.mood))];
  return matched.length ? matched : ['Evocative'];
}

function deriveMovement(genres, year, country) {
  const primaryGenre = genres[0] ? genres[0].toLowerCase() : 'work';
  const decade = year ? decadeLabel(year) : 'an unknown period';
  return country && country !== 'Unknown' ? `${country} ${primaryGenre}, ${decade}` : `${primaryGenre}, ${decade}`;
}

function buildImage(filename) {
  if (!filename) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}`;
}

function mapWikidataToWork(binding, medium) {
  const title = value(binding, 'itemLabel') || 'Untitled';
  const year = parseYear(value(binding, 'date'));
  const country = value(binding, 'country') || 'Unknown';
  const language = value(binding, 'language') || 'unknown';
  const creator = value(binding, 'directors') || 'Unknown';
  const genres = splitList(value(binding, 'genres'), '|');
  const imageFile = value(binding, 'image');
  const qid = qidFromUri(value(binding, 'item'));

  return {
    id: slugify(title, year ?? 'unknown'),
    title,
    creator,
    medium,
    year,
    decade: year ? decadeLabel(year) : 'unknown',
    country,
    language,
    movement: deriveMovement(genres, year, country),
    genre: genres[0] || 'Uncategorized',
    style: genres.length ? genres : ['Uncategorized'],
    themes: deriveThemes(genres),
    mood: deriveMood(genres),
    context: `Released in ${year ?? 'an unknown year'} in ${country}.`,
    description: `${title}, a ${genres[0] ? genres[0].toLowerCase() : 'work'} from ${country} (${year ?? 'n.d.'}).`,
    image: buildImage(imageFile),
    imageCredit: imageFile ? COMMONS_CREDIT : null,
    source: { type: 'wikidata', sourceId: qid },
  };
}

export function mapWikidataFilmToWork(binding) {
  return mapWikidataToWork(binding, 'film');
}

export function mapWikidataTvToWork(binding) {
  return mapWikidataToWork(binding, 'tv');
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
npm test
```

Expected: the 8 `mapWikidata.test.js` tests pass. The overall suite is still red because of Task 1's expected, documented failure (missing `./sources/tmdb.mjs` import in `scripts/sync-data.mjs`) — confirm specifically that running just this file passes: `node --test test/mapWikidata.test.js`.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/resonance
git add scripts/lib/mapWikidata.mjs test/mapWikidata.test.js
git commit -m "Add Wikidata film/TV to work-schema mapper"
```

---

## Task 3: Wikidata SPARQL client, rewired orchestrator, and schema updates

**Files:**
- Create: `scripts/sources/wikidata.mjs`
- Test: `test/wikidataSource.test.js`
- Modify: `scripts/sync-data.mjs`
- Modify: `js/data.js` (placeholder dataset — swap `source.type` from `'tmdb'` to `'wikidata'`)
- Modify: `test/data.test.js` (`VALID_SOURCE_TYPES` — swap `'tmdb'` for `'wikidata'`)

**Interfaces:**
- Consumes: `createThrottle` from `../lib/rateLimit.mjs`; `mapWikidataFilmToWork`, `mapWikidataTvToWork` from `./lib/mapWikidata.mjs` (Task 2); `mergeWorks` from `./lib/mergeWorks.mjs`; `applyEnrichment` from `./lib/applyEnrichment.mjs`; `DECADES` from `./lib/coverage.mjs`.
- Produces: `queryFilms(options)`, `queryTv(options)`, `queryRecentFilms(options)`, `queryRecentTv(options)` from `scripts/sources/wikidata.mjs`, each returning an array of raw SPARQL binding objects (the shape Task 2's mappers consume). `runSync` (from `scripts/sync-data.mjs`, unchanged signature from the prior plan) now calls these instead of the deleted TMDB functions.

**Before writing code:** verify `wd:Q155` really is Brazil (`wd:Q155 rdfs:label "Brazil"@en`) against the live endpoint, and confirm the query template from Task 2 (already verified there) also works correctly with a `FILTER(YEAR(?date) >= ... && YEAR(?date) <= ...)` decade clause and a `?item wdt:P495 wd:Q155` Brazil-only clause added. Note any correction needed in your report.

- [ ] **Step 1: Write the failing tests**

Create `test/wikidataSource.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { queryFilms, queryTv } from '../scripts/sources/wikidata.mjs';

test('queryFilms sends a SPARQL query with the right date range and a User-Agent header, returning parsed bindings', async (t) => {
  let capturedUrl;
  let capturedHeaders;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    capturedUrl = url.toString();
    capturedHeaders = init && init.headers;
    return {
      ok: true,
      json: async () => ({ results: { bindings: [{ item: { type: 'uri', value: 'http://www.wikidata.org/entity/Q186358' } }] } }),
    };
  });

  const rows = await queryFilms({ startYear: 2000, endYear: 2009, limit: 10 });

  assert.equal(rows.length, 1);
  assert.ok(capturedUrl.includes('query.wikidata.org/sparql'));
  assert.ok(decodeURIComponent(capturedUrl).includes('YEAR(?date) >= 2000'));
  assert.ok(decodeURIComponent(capturedUrl).includes('YEAR(?date) <= 2009'));
  assert.ok(capturedHeaders && typeof capturedHeaders['User-Agent'] === 'string' && capturedHeaders['User-Agent'].length > 0);
});

test('queryFilms with a countryQid adds a country-of-origin filter to the query', async (t) => {
  let capturedUrl;
  t.mock.method(globalThis, 'fetch', async (url) => {
    capturedUrl = url.toString();
    return { ok: true, json: async () => ({ results: { bindings: [] } }) };
  });

  await queryFilms({ startYear: 2000, endYear: 2009, limit: 10, countryQid: 'Q155' });

  assert.ok(decodeURIComponent(capturedUrl).includes('wd:Q155'));
});

test('queryTv uses the TV series item type, not the film item type', async (t) => {
  let capturedUrl;
  t.mock.method(globalThis, 'fetch', async (url) => {
    capturedUrl = url.toString();
    return { ok: true, json: async () => ({ results: { bindings: [] } }) };
  });

  await queryTv({ startYear: 2000, endYear: 2009, limit: 10 });

  const decoded = decodeURIComponent(capturedUrl);
  assert.ok(decoded.includes('wd:Q5398426'));
  assert.ok(!decoded.includes('wd:Q11424'));
});

test('queryFilms throws a clear error on a failed response', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 429, statusText: 'Too Many Requests' }));

  await assert.rejects(
    () => queryFilms({ startYear: 2000, endYear: 2009, limit: 10 }),
    /Wikidata request failed: 429/
  );
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '.../scripts/sources/wikidata.mjs'`.

- [ ] **Step 3: Implement `scripts/sources/wikidata.mjs`**

```js
import { createThrottle } from '../lib/rateLimit.mjs';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'RESONANCE-sync/1.0 (personal art-discovery project; https://github.com/ — contact via project owner)';
const throttle = createThrottle(1000); // conservative pacing per Wikidata's etiquette for unauthenticated clients

function buildQuery({ itemType, startYear, endYear, countryQid, limit }) {
  const countryClause = countryQid ? `?item wdt:P495 wd:${countryQid} .` : '';
  return `
SELECT ?item ?itemLabel
       (GROUP_CONCAT(DISTINCT ?directorLabel; separator=", ") AS ?directors)
       (SAMPLE(?countryLabel) AS ?country)
       (SAMPLE(?langLabel) AS ?language)
       (GROUP_CONCAT(DISTINCT ?genreLabel; separator="|") AS ?genres)
       (SAMPLE(?date) AS ?date)
       (SAMPLE(?image) AS ?image)
WHERE {
  ?item wdt:P31 wd:${itemType} .
  ${countryClause}
  ?item wdt:P577 ?date .
  FILTER(YEAR(?date) >= ${startYear} && YEAR(?date) <= ${endYear})
  ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en")
  OPTIONAL { ?item wdt:P57 ?director. ?director rdfs:label ?directorLabel. FILTER(LANG(?directorLabel) = "en") }
  OPTIONAL { ?item wdt:P495 ?country. ?country rdfs:label ?countryLabel. FILTER(LANG(?countryLabel) = "en") }
  OPTIONAL { ?item wdt:P364 ?lang. ?lang rdfs:label ?langLabel. FILTER(LANG(?langLabel) = "en") }
  OPTIONAL { ?item wdt:P136 ?genre. ?genre rdfs:label ?genreLabel. FILTER(LANG(?genreLabel) = "en") }
  OPTIONAL { ?item wdt:P18 ?image. }
}
GROUP BY ?item ?itemLabel
LIMIT ${limit}
`.trim();
}

async function runQuery(sparql) {
  await throttle();
  const url = new URL(ENDPOINT);
  url.searchParams.set('format', 'json');
  url.searchParams.set('query', sparql);
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json' } });
  if (!response.ok) {
    throw new Error(`Wikidata request failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return (data.results && data.results.bindings) || [];
}

export async function queryFilms({ startYear, endYear, limit, countryQid }) {
  return runQuery(buildQuery({ itemType: 'Q11424', startYear, endYear, countryQid, limit }));
}

export async function queryTv({ startYear, endYear, limit, countryQid }) {
  return runQuery(buildQuery({ itemType: 'Q5398426', startYear, endYear, countryQid, limit }));
}

export async function queryRecentFilms({ limit }) {
  const now = new Date();
  const startYear = now.getFullYear() - (now.getMonth() < 6 ? 2 : 1); // roughly the last ~18 months
  return runQuery(buildQuery({ itemType: 'Q11424', startYear, endYear: now.getFullYear() + 1, limit }));
}

export async function queryRecentTv({ limit }) {
  const now = new Date();
  const startYear = now.getFullYear() - (now.getMonth() < 6 ? 2 : 1);
  return runQuery(buildQuery({ itemType: 'Q5398426', startYear, endYear: now.getFullYear() + 1, limit }));
}
```

- [ ] **Step 4: Run this file's tests and verify they pass**

```bash
node --test test/wikidataSource.test.js
```

Expected: PASS — all 4 tests (no real network calls — `fetch` is mocked).

- [ ] **Step 5: Rewire `scripts/sync-data.mjs`**

Replace the `import * as tmdb from './sources/tmdb.mjs';` line with:

```js
import { mapWikidataFilmToWork, mapWikidataTvToWork } from './lib/mapWikidata.mjs';
import * as wikidata from './sources/wikidata.mjs';
```

Replace `mapTmdbMovieToWork, mapTmdbTvToWork` import (from `./lib/mapTmdb.mjs`) — remove that whole import line, since it's now covered by the line above.

Replace `import { LANGUAGE_SAMPLES, DECADES } from './lib/coverage.mjs';` with `import { DECADES } from './lib/coverage.mjs';` — the new Wikidata sampling loop (below) iterates only by decade, not by language, so `LANGUAGE_SAMPLES` becomes an unused import and must be dropped, not left dangling.

Replace the constants block:

```js
const TARGET_PER_LANGUAGE_MOVIE = 40; // ~40 x 15 languages ≈ 600 movies per full run
const TARGET_PER_LANGUAGE_TV = 30;    // ~30 x 15 languages ≈ 450 TV shows per full run
const RECENT_TARGET = 100;
```

with:

```js
const TARGET_PER_DECADE_MOVIE = 40;  // ~40 x 13 decades ≈ 520 movies per full run
const TARGET_PER_DECADE_TV = 25;     // ~25 x 13 decades ≈ 325 TV shows per full run
const BRAZIL_QID = 'Q155';
const RECENT_TARGET = 100;
```

Replace the whole `fetchTmdbFull` function with:

```js
async function fetchWikidataFull(apiKey, enrichmentMap) {
  const fresh = [];
  for (const { start, end } of DECADES) {
    try {
      const filmRows = await wikidata.queryFilms({ startYear: start, endYear: end, limit: TARGET_PER_DECADE_MOVIE });
      for (const row of filmRows) {
        fresh.push(applyEnrichment(mapWikidataFilmToWork(row), enrichmentMap));
      }
    } catch (err) {
      console.warn(`[wikidata] film query failed for ${start}-${end}: ${err.message}`);
    }

    try {
      const tvRows = await wikidata.queryTv({ startYear: start, endYear: end, limit: TARGET_PER_DECADE_TV });
      for (const row of tvRows) {
        fresh.push(applyEnrichment(mapWikidataTvToWork(row), enrichmentMap));
      }
    } catch (err) {
      console.warn(`[wikidata] tv query failed for ${start}-${end}: ${err.message}`);
    }

    // Guarantee Brazilian representation explicitly per decade, rather than leaving it to chance —
    // this is a first-principles requirement of the product (Brazilian + international works),
    // not an incidental nice-to-have.
    try {
      const brazilFilmRows = await wikidata.queryFilms({ startYear: start, endYear: end, limit: 10, countryQid: BRAZIL_QID });
      for (const row of brazilFilmRows) {
        fresh.push(applyEnrichment(mapWikidataFilmToWork(row), enrichmentMap));
      }
    } catch (err) {
      console.warn(`[wikidata] Brazil film query failed for ${start}-${end}: ${err.message}`);
    }
  }
  return fresh;
}
```

Replace the whole `fetchTmdbRecent` function with:

```js
async function fetchWikidataRecent(apiKey, enrichmentMap) {
  const fresh = [];
  try {
    const filmRows = await wikidata.queryRecentFilms({ limit: RECENT_TARGET });
    for (const row of filmRows) {
      fresh.push(applyEnrichment(mapWikidataFilmToWork(row), enrichmentMap));
    }
  } catch (err) {
    console.warn(`[wikidata] recent films failed: ${err.message}`);
  }
  try {
    const tvRows = await wikidata.queryRecentTv({ limit: RECENT_TARGET });
    for (const row of tvRows) {
      fresh.push(applyEnrichment(mapWikidataTvToWork(row), enrichmentMap));
    }
  } catch (err) {
    console.warn(`[wikidata] recent tv failed: ${err.message}`);
  }
  return fresh;
}
```

In `main()`, replace:

```js
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
```

with:

```js
async function main() {
  const incremental = process.argv.includes('--new');
  const result = await runSync({
    dataFile: REAL_DATA_FILE,
    enrichmentFile: REAL_ENRICHMENT_FILE,
    fetchFresh: incremental ? fetchWikidataRecent : fetchWikidataFull,
    apiKey: null, // Wikidata needs no credential — kept as a parameter only because runSync's signature (Task 5 of the prior plan) still passes it through to fetchFresh
    incremental,
  });
  console.log(`Sync complete: ${result.freshCount} fetched, ${result.totalCount} total works in js/data.js (was ${result.existingCount}).`);
}
```

`runSync` itself (its signature, its body) does not change — it already treats `fetchFresh` as an opaque injected function and doesn't care what source it calls internally.

- [ ] **Step 6: Update the placeholder `js/data.js`**

In each of the 6 placeholder works, change `source: { type: 'tmdb', sourceId: 'placeholder-N' }` to `source: { type: 'wikidata', sourceId: 'placeholder-N' }` (only the `type` value changes, `sourceId` stays as-is). Also update the file's header comment to reference this plan instead of the TMDB one:

Change:
```js
// This is a placeholder committed before the first real sync — see Task 7 of
// docs/superpowers/plans/2026-09-02-resonance-data-sourcing-tmdb.md.
```
to:
```js
// This is a placeholder committed before the first real sync — see Task 4 of
// docs/superpowers/plans/2026-09-02-resonance-data-sourcing-wikidata.md.
```

- [ ] **Step 7: Update `test/data.test.js`**

Change:
```js
const VALID_SOURCE_TYPES = new Set(['tmdb', 'musicbrainz', 'openlibrary', 'met']);
```
to:
```js
const VALID_SOURCE_TYPES = new Set(['wikidata', 'musicbrainz', 'openlibrary', 'met']);
```

- [ ] **Step 8: Run the full suite and verify everything passes**

```bash
npm test
```

Expected: PASS — the full suite (router, filters, similarity, rateLimit, coverage, mergeWorks, applyEnrichment, mapWikidata, wikidataSource, syncData, data) passes with zero references to the deleted TMDB files anywhere.

- [ ] **Step 9: Verify no TMDB references remain**

```bash
cd ~/Desktop/resonance
grep -rn "tmdb\|TMDB" scripts/ js/ test/ package.json 2>/dev/null || echo "clean"
```

Expected: no output (or only comments/strings that are intentionally historical, if any — there should be none in the active code paths). If anything unexpected shows up, resolve it before committing.

- [ ] **Step 10: Commit**

```bash
cd ~/Desktop/resonance
git add scripts/sources/wikidata.mjs test/wikidataSource.test.js scripts/sync-data.mjs js/data.js test/data.test.js
git commit -m "Replace TMDB with Wikidata in the sync orchestrator; update schema tests"
```

---

## Task 4: Run the real Wikidata sync (controller-executed, not delegated)

**This task is not dispatched to an implementer subagent** — not because it needs a secret this time (it doesn't, that's the whole point of this swap), but because it's a long-running, real, unattended network job worth watching together with the user, exactly as the TMDB version of this task would have been. Whoever is driving this plan's execution performs this task directly.

- [ ] **Step 1: Clear the placeholder dataset before syncing**

`js/data.js` currently holds Task 3's placeholder (6 works with fake `source.sourceId` values like `"placeholder-1"`, now tagged `source.type: 'wikidata'`). Exactly as with the TMDB plan, `mergeWorks` only replaces an existing entry when a fresh entry shares its exact `source.type` + `source.sourceId` — the placeholders' fake ids will never match a real Wikidata QID, so if left in place they would sit alongside the real synced works forever. Reset the file to an empty dataset first:

```bash
cd ~/Desktop/resonance
cat > js/data.js << 'EOF'
// AUTO-GENERATED by scripts/sync-data.mjs — do not hand-edit.
// Run `npm run sync-data` to refresh, or `npm run sync-data -- --new` for an incremental update.
// Optional hand-curation lives in data/enrichment.json, keyed by "<source.type>:<source.sourceId>".

export const works = [];
EOF
```

- [ ] **Step 2: Run the full sync**

```bash
cd ~/Desktop/resonance
npm run sync-data
```

No environment variable needed. This queries Wikidata across 13 decades × (films + TV + a Brazil-specific film query per decade) = ~39 SPARQL queries, throttled to ~1/second, so expect roughly 1-2 minutes for the network calls themselves (much faster than TMDB's per-title detail-fetch pattern, since each Wikidata query returns many fully-detailed rows at once). Run with `run_in_background: true` if driving it through the assistant.

- [ ] **Step 3: Verify the result**

```bash
npm test
```

Expected: PASS.

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

Reload `http://localhost:8000/#/explore`. Confirm: real works appear with real titles/creators/countries/decades; some cards show real Commons images (with a short truncated credit caption), most show the clean typography fallback (expected — Commons image coverage for film/TV is much thinner than TMDB's would have been, per the spec's documented trade-off); filters show real breadth; clicking through to a work detail page shows real data with real connections.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/resonance
git add js/data.js
git commit -m "Run first real Wikidata sync: populate js/data.js from the live SPARQL endpoint"
```

- [ ] **Step 6: Report real numbers to the user**

Summarize: total work count, film/TV split, country/decade breadth, confirmed Brazilian representation, how many works got real Commons images vs. the typography fallback, and how long the sync actually took — this informs whether `TARGET_PER_DECADE_MOVIE`/`TARGET_PER_DECADE_TV` should be adjusted before the next source (Music, via MusicBrainz) is planned.

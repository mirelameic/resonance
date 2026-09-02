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

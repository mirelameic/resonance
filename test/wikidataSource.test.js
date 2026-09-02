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
  // Guards against the exact bug the controller found and fixed during the real sync:
  // a non-Latin1 character (an em dash) in this header broke every single fetch call,
  // because fetch headers are ByteStrings and cannot carry arbitrary Unicode.
  assert.match(capturedHeaders['User-Agent'], /^[\x20-\x7E]+$/, 'User-Agent must be pure ASCII (fetch headers are ByteStrings)');
});

test('queryFilms only excludes non-earliest publication dates from the SPARQL query text (FILTER NOT EXISTS present)', async (t) => {
  let capturedUrl;
  t.mock.method(globalThis, 'fetch', async (url) => {
    capturedUrl = url.toString();
    return { ok: true, json: async () => ({ results: { bindings: [] } }) };
  });

  await queryFilms({ startYear: 2000, endYear: 2009, limit: 10 });

  const decoded = decodeURIComponent(capturedUrl);
  assert.ok(decoded.includes('FILTER NOT EXISTS'), 'query must exclude non-earliest P577 dates before the decade filter applies');
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

test('queryFilms with a countryQid also projects a deterministic ?filteredCountry bound to that QID (not sampled)', async (t) => {
  let capturedUrl;
  t.mock.method(globalThis, 'fetch', async (url) => {
    capturedUrl = url.toString();
    return { ok: true, json: async () => ({ results: { bindings: [] } }) };
  });

  await queryFilms({ startYear: 2000, endYear: 2009, limit: 10, countryQid: 'Q155' });

  const decoded = decodeURIComponent(capturedUrl);
  assert.ok(decoded.includes('?filteredCountry'), 'query must project a ?filteredCountry variable when countryQid is supplied');
  assert.ok(decoded.includes('wd:Q155 rdfs:label'), 'the filtered country label must be bound directly to the filter QID, not sampled from ?item');
});

test('queryFilms without a countryQid does not project a ?filteredCountry variable', async (t) => {
  let capturedUrl;
  t.mock.method(globalThis, 'fetch', async (url) => {
    capturedUrl = url.toString();
    return { ok: true, json: async () => ({ results: { bindings: [] } }) };
  });

  await queryFilms({ startYear: 2000, endYear: 2009, limit: 10 });

  assert.ok(!decodeURIComponent(capturedUrl).includes('?filteredCountry'));
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

test('queryFilms retries on transient errors (429/502/503/504) and eventually throws once retries are exhausted', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 429, statusText: 'Too Many Requests' }));

  await assert.rejects(
    () => queryFilms({ startYear: 2000, endYear: 2009, limit: 10 }),
    /Wikidata request failed: 429/
  );
  // 1 initial attempt + 2 retries = 3 total fetch calls.
  assert.equal(globalThis.fetch.mock.callCount(), 3);
});

test('queryFilms does not retry on a non-transient error (e.g. a malformed query returning 400)', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 400, statusText: 'Bad Request' }));

  await assert.rejects(
    () => queryFilms({ startYear: 2000, endYear: 2009, limit: 10 }),
    /Wikidata request failed: 400/
  );
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('queryFilms retries a transient 502 and returns the eventual successful result (not the error)', async (t) => {
  let callCount = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    callCount += 1;
    if (callCount === 1) {
      return { ok: false, status: 502, statusText: 'Bad Gateway' };
    }
    return {
      ok: true,
      json: async () => ({ results: { bindings: [{ item: { type: 'uri', value: 'http://www.wikidata.org/entity/Q220741' } }] } }),
    };
  });

  const rows = await queryFilms({ startYear: 2000, endYear: 2009, limit: 10 });

  assert.equal(callCount, 2, 'expected exactly one retry after the initial 502');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].item.value, 'http://www.wikidata.org/entity/Q220741');
});

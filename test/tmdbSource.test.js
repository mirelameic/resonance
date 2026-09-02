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

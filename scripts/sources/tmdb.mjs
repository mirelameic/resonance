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

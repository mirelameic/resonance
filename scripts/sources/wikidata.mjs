import { createThrottle, sleep } from '../lib/rateLimit.mjs';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'RESONANCE-sync/1.0 (personal art-discovery project, non-commercial data sync script)';
const throttle = createThrottle(1000); // conservative pacing per Wikidata's etiquette for unauthenticated clients

// Transient errors observed against Wikidata's shared public endpoint during a real sync
// run (502/503/504 from the endpoint itself, 429 from rate limiting). Retrying these (and
// only these — a malformed query returning e.g. 400 would just fail again) recovers most
// of what would otherwise be a silently-dropped bucket.
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

function buildQuery({ itemType, startYear, endYear, countryQid, limit }) {
  const countryClause = countryQid ? `?item wdt:P495 wd:${countryQid} .` : '';
  // When a countryQid filter is supplied, also bind a dedicated label for THAT specific
  // country so the mapper can report it deterministically — SAMPLE(?countryLabel) below
  // still aggregates over every P495 value on the item (co-productions can have several),
  // so it can arbitrarily pick a country other than the one actually being filtered for.
  const filteredCountryClause = countryQid
    ? `OPTIONAL { wd:${countryQid} rdfs:label ?filteredCountryLabel . FILTER(LANG(?filteredCountryLabel) = "en") }`
    : '';
  const filteredCountrySelect = countryQid ? '(SAMPLE(?filteredCountryLabel) AS ?filteredCountry)' : '';
  return `
SELECT ?item ?itemLabel
       (GROUP_CONCAT(DISTINCT ?directorLabel; separator=", ") AS ?directors)
       (SAMPLE(?countryLabel) AS ?country)
       ${filteredCountrySelect}
       (SAMPLE(?langLabel) AS ?language)
       (GROUP_CONCAT(DISTINCT ?genreLabel; separator="|") AS ?genres)
       (MIN(?date) AS ?firstDate)
       (SAMPLE(?image) AS ?image)
WHERE {
  ?item wdt:P31 wd:${itemType} .
  ${countryClause}
  ${filteredCountryClause}
  ?item wdt:P577 ?date .
  FILTER(YEAR(?date) <= ${endYear})
  ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en")
  OPTIONAL { ?item wdt:P57 ?director. ?director rdfs:label ?directorLabel. FILTER(LANG(?directorLabel) = "en") }
  OPTIONAL { ?item wdt:P495 ?country. ?country rdfs:label ?countryLabel. FILTER(LANG(?countryLabel) = "en") }
  OPTIONAL { ?item wdt:P364 ?lang. ?lang rdfs:label ?langLabel. FILTER(LANG(?langLabel) = "en") }
  OPTIONAL { ?item wdt:P136 ?genre. ?genre rdfs:label ?genreLabel. FILTER(LANG(?genreLabel) = "en") }
  OPTIONAL { ?item wdt:P18 ?image. }
}
GROUP BY ?item ?itemLabel
HAVING(YEAR(MIN(?date)) >= ${startYear} && YEAR(MIN(?date)) <= ${endYear})
LIMIT ${limit}
`.trim();
}

async function runQuery(sparql) {
  await throttle();
  // Built manually with encodeURIComponent (not URLSearchParams) so that spaces are
  // encoded as %20 rather than '+' — decodeURIComponent doesn't turn '+' back into a
  // space, which broke plain-text substring assertions against the decoded query.
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json' } });
    if (response.ok) {
      const data = await response.json();
      return (data.results && data.results.bindings) || [];
    }
    const isRetryable = RETRYABLE_STATUS_CODES.has(response.status);
    const isLastAttempt = attempt === MAX_RETRIES;
    if (!isRetryable || isLastAttempt) {
      throw new Error(`Wikidata request failed: ${response.status} ${response.statusText}`);
    }
    await sleep(RETRY_DELAY_MS);
  }
  // Unreachable: the loop above always either returns or throws.
  throw new Error('Wikidata request failed: retries exhausted');
}

export async function queryFilms({ startYear, endYear, limit, countryQid }) {
  return runQuery(buildQuery({ itemType: 'Q11424', startYear, endYear, countryQid, limit }));
}

export async function queryTv({ startYear, endYear, limit, countryQid }) {
  return runQuery(buildQuery({ itemType: 'Q5398426', startYear, endYear, countryQid, limit }));
}

export async function queryRecentFilms({ limit, countryQid }) {
  const now = new Date();
  // Year-granular, not month-granular: this covers the current calendar year plus the
  // previous 1-2 calendar years (2 back in the first half of the year, 1 back in the
  // second half), i.e. 2-3 full calendar years depending on when it runs — not a fixed
  // rolling ~18-month window.
  const startYear = now.getFullYear() - (now.getMonth() < 6 ? 2 : 1);
  return runQuery(buildQuery({ itemType: 'Q11424', startYear, endYear: now.getFullYear() + 1, countryQid, limit }));
}

export async function queryRecentTv({ limit, countryQid }) {
  const now = new Date();
  const startYear = now.getFullYear() - (now.getMonth() < 6 ? 2 : 1);
  return runQuery(buildQuery({ itemType: 'Q5398426', startYear, endYear: now.getFullYear() + 1, countryQid, limit }));
}

import { createThrottle, sleep } from '../lib/rateLimit.mjs';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'RESONANCE-sync/1.0 (personal art-discovery project, non-commercial data sync script)';
const throttle = createThrottle(1000);

const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

function buildQuery({ itemType, startYear, endYear, countryQid, limit, offset = 0 }) {
  const countryClause = countryQid ? `?item wdt:P495 wd:${countryQid} .` : '';
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
OFFSET ${offset}
`.trim();
}

async function runQuery(sparql) {
  await throttle();
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
  throw new Error('Wikidata request failed: retries exhausted');
}

export async function queryFilms({ startYear, endYear, limit, countryQid, offset = 0 }) {
  return runQuery(buildQuery({ itemType: 'Q11424', startYear, endYear, countryQid, limit, offset }));
}

export async function queryRecentFilms({ limit, countryQid }) {
  const now = new Date();
  const startYear = now.getFullYear() - (now.getMonth() < 6 ? 2 : 1);
  return runQuery(buildQuery({ itemType: 'Q11424', startYear, endYear: now.getFullYear() + 1, countryQid, limit }));
}

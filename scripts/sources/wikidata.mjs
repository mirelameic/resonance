import { createThrottle } from '../lib/rateLimit.mjs';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'RESONANCE-sync/1.0 (personal art-discovery project, non-commercial data sync script)';
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
  // Built manually with encodeURIComponent (not URLSearchParams) so that spaces are
  // encoded as %20 rather than '+' — decodeURIComponent doesn't turn '+' back into a
  // space, which broke plain-text substring assertions against the decoded query.
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(sparql)}`;
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

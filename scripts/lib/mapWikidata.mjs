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

// Wikidata's SPARQL endpoint resolves a commonsMedia property (P18, queried
// via wdt:P18) directly to a full, pre-percent-encoded Commons Special:FilePath
// URI (e.g. "http://commons.wikimedia.org/wiki/Special:FilePath/Foo%20bar.jpg"),
// not a bare filename. Upgrade to https for a consistent, secure URL.
function buildImage(imageUri) {
  if (!imageUri) return null;
  return imageUri.replace(/^http:\/\//, 'https://');
}

function mapWikidataToWork(binding, medium) {
  const title = value(binding, 'itemLabel') || 'Untitled';
  const year = parseYear(value(binding, 'date'));
  const country = value(binding, 'country') || 'Unknown';
  const language = value(binding, 'language') || 'unknown';
  const creator = value(binding, 'directors') || 'Unknown';
  const genres = splitList(value(binding, 'genres'), '|');
  const imageUri = value(binding, 'image');
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
    image: buildImage(imageUri),
    imageCredit: imageUri ? COMMONS_CREDIT : null,
    source: { type: 'wikidata', sourceId: qid },
  };
}

export function mapWikidataFilmToWork(binding) {
  return mapWikidataToWork(binding, 'film');
}

export function mapWikidataTvToWork(binding) {
  return mapWikidataToWork(binding, 'tv');
}

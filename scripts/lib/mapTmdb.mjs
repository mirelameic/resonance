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

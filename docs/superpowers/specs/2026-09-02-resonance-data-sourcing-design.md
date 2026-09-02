# RESONANCE — Data & Imagery Sourcing Overhaul (Sub-project A)

Date: 2026-09-02

## Context

The original RESONANCE build (spec: `2026-08-31-resonance-design.md`) shipped with
a hand-curated dataset of 79 works and procedurally-generated abstract SVG cover
art. That dataset was a proof of concept. This spec replaces it entirely: the
dataset is now populated exclusively from public, reliable third-party APIs —
real works, real metadata, real images where available — with breadth across
decades and countries as the explicit goal, and a repeatable sync process so the
collection keeps growing over time (including newly released works) rather than
being frozen at launch.

**The 79 hand-curated works are discarded, not preserved.** There is no
"manual" or protected entry concept in this design — every work in the
collection originates from a sync run against a real API.

## Goals

- Populate the dataset exclusively from public APIs / open-access sources — no
  invented works, no model-generated facts.
- Breadth: works spanning many decades (not clustered in one era) and many
  countries/languages (not dominated by English-language/US output), for every
  medium.
- Repeatable, incremental growth: running the sync again should add newly
  released works and can be re-run indefinitely to keep expanding the
  collection, without duplicating or corrupting what's already there.
- Real images where a source provides them, with proper attribution where the
  source's terms require it; a clean typography-only treatment (no procedural
  art, no broken-looking placeholder) where no image exists.
- No change to the deployed app's architecture: it stays a static site with
  zero backend, zero runtime API calls, zero exposed API keys. All API access
  happens offline, in a Node script you run yourself.
- Zero new npm dependencies (Node 18+'s built-in `fetch` is sufficient).

## Sources

| Medium | Source | Auth | Notes |
|---|---|---|---|
| Film, TV | [Wikidata](https://www.wikidata.org/) Query Service (SPARQL) | None — no key, no signup, no commercial-use fee, ever (CC0) | **Superseded TMDB** (2026-09-02): TMDB's free tier excludes commercial use — any monetized deployment would owe a $149/mo license fee. Wikidata's data is CC0 (public domain), explicitly permitting commercial use with no fee and no negotiation, which fits this project's eventual monetization intent. Trade-off: weaker image coverage than TMDB — official posters are typically copyrighted and not hosted on Wikimedia Commons, so most film/TV works will have no image, falling back to the typography-only card treatment (already built for exactly this case). Queried via `https://query.wikidata.org/sparql`, items where `wdt:P31` (instance of) is `wd:Q11424` (film) or `wd:Q5398426` (television series); relevant properties: `P577` (publication date), `P136` (genre), `P57` (director), `P495` (country of origin), `P364` (original language), `P18` (image, when present). No auth, but requires a descriptive `User-Agent` header per Wikidata's etiquette; rate-limited to 5 parallel queries per IP, back off on HTTP 429. |
| Music | [MusicBrainz](https://musicbrainz.org/) API + [Cover Art Archive](https://coverartarchive.org/) | None | Open data, no key. Rate-limited to ~1 request/second — the sync script must throttle accordingly. MusicBrainz provides release/recording metadata, area (country), date, and folksonomy tags; Cover Art Archive provides album art keyed by MusicBrainz release ID. |
| Literature | [Open Library](https://openlibrary.org/) API | None (generally) | Open data via Internet Archive. Provides title/author/subjects/first-publish-year/cover images. Crowd-sourced — coverage and metadata richness varies per book; be a good citizen with request pacing. |
| Photography, Visual Arts | [The Met Open Access](https://www.metmuseum.org/) API (+ similar CC0 museum sources as a stretch goal: National Gallery of Art, Cleveland Museum of Art, Art Institute of Chicago) | None | CC0-licensed, no key. Strongest for historical/public-domain work; weak on living/contemporary artists and photographers — this is a known, accepted gap (no good open API solves this). Provides object title, artist/culture, date, medium, classification, and high-resolution images. |

All sources are queried only from the Node sync script — never from the
browser — so CORS is a non-issue regardless of source, and no source in this
revised lineup requires an API key at all.

## Architecture

```
scripts/
  sync-data.mjs            # orchestrator — `npm run sync-data [-- --new]`
  sources/
    wikidata.mjs             # film + TV (SPARQL)
    musicbrainz.mjs          # music metadata
    coverartarchive.mjs       # album art (paired with musicbrainz.mjs)
    openlibrary.mjs           # literature
    met.mjs                    # visual arts + photography
  lib/
    mapToWork.mjs             # pure functions: raw API record -> our work schema
    rateLimit.mjs              # small throttling helper shared by all sources
data/
  enrichment.json            # optional hand-curation overlay (empty by default — see below)
js/data.js                   # GENERATED — header comment warns against hand-editing
```

Nothing downstream of `js/data.js` changes: `js/filters.js`, `js/similarity.js`,
and `js/render.js` keep consuming the exact same schema shape and the exact
same `works` export they already do. This is deliberate — the sync overhaul is
fully isolated to data production, not consumption.

## Schema changes

Two fields are added to every work; everything else keeps the existing shape
from the original spec:

```js
{
  // ...existing fields unchanged (id, title, creator, medium, year, decade,
  // country, language, movement, genre, style[], themes[], mood[], context,
  // description)...

  image: "https://commons.wikimedia.org/wiki/Special:FilePath/xyz.jpg" | null,
  imageCredit: "Image via Wikimedia Commons (CC0/public domain data via Wikidata)" | null,   // required by source terms where applicable; optional-but-good-practice for CC0 sources like Wikidata and the Met
  source: { type: "wikidata" | "musicbrainz" | "openlibrary" | "met", sourceId: "Q186358" },
}
```

`source.sourceId` is how re-syncs stay idempotent — a work already present
(matched by `source.type` + `source.sourceId`) gets its objective fields
refreshed in place rather than duplicated; a new one gets appended.

`id` stays a human-readable kebab-case slug (`title-year`-derived) for URLs —
it's independent of `source.sourceId` so re-slugging on a title correction
never breaks the URL scheme's readability, but matching for idempotency always
goes through `source`, never through `id`.

## The editorial-field problem, and how this design handles it

APIs give us objective facts (title, creator, year, country, top-level genre,
image) but not the interpretive fields that make the connections engine
interesting: `movement`, nuanced `themes`, `mood`, and prose `context`. With
zero hand-curated seed data now, 100% of the collection starts without that
layer, which would otherwise make every connection either genre/period/country
matches only — real, but thinner than the original curated set's output.

Mitigation, built into `mapToWork.mjs`'s per-source mappers rather than left
manual:

- **`themes`**: derived from each source's own richer signal fields, not just
  top-level genre — Wikidata's genre property (`P136`, often multi-valued) and
  main-subject property (`P921`, when present), MusicBrainz's folksonomy
  *tags*, Open Library's *subjects*, the Met's *classification* / *culture* /
  *period* fields. These are real, source-provided data, not invented.
- **`description`**: the source's own synopsis/description text where
  available (Wikidata's short `schema:description` / Wikipedia sitelink
  summary where present, Open Library `description`, the Met's object
  description) — real content, not fabricated. Wikidata's descriptions are
  often terse (a one-line disambiguator, not a synopsis) — a shorter fallback
  than TMDB's `overview` would have given, which is an accepted trade-off.
- **`context`**: where no curated cultural-context prose exists, falls back to
  a short, honest, factually-generated line (e.g. "Released in {year} in
  {country}.") — never a fabricated claim, just thinner than hand-written
  prose.
- **`movement`**: the hardest to derive automatically (it's usually an
  art-historical judgment call). Falls back to a coarser, still-real label
  combining genre/decade/country (e.g. "American drama, 1970s") rather than
  guessing a named movement.
- **`mood`**: derived heuristically from sentiment-adjacent tags/keywords
  where a source provides them; falls back to a small neutral default set
  when nothing usable exists.

`data/enrichment.json` remains as an **optional**, empty-by-default overlay
keyed by `source.sourceId` — a future escape hatch for hand-curating specific
works' `movement`/`themes`/`mood`/`context` to strengthen their connections,
without being required for the dataset to work today.

## Sync behavior

**Full/bulk mode** (`npm run sync-data`): for each medium, queries its source
deliberately across multiple decades and countries/languages — not just
"most popular" — targeting roughly 500-1,000 works per medium per run (~3,000-
6,000 total on a first run). This is a starting rhythm, not a ceiling: the
script is designed to be re-run to keep expanding the collection over time,
since pulling every title a source has (Wikidata alone holds well over a
million film/TV items) in one run isn't practical or useful.

**Incremental mode** (`npm run sync-data -- --new`): queries each source's
"recently released/added" surface — for Wikidata, a narrow `P577` (publication
date) window covering roughly the last 18 months instead of a full
historical decade sweep — MusicBrainz's recent releases, Open Library's recent
additions — to pick up new works without re-walking the whole historical
catalog. The Met's collection doesn't have a
meaningful "recent" concept (museum accessions, not new artworks), so
incremental mode skips it — full mode is re-run periodically instead.

**Error handling:** a failure fetching one source, one page, or one record
never aborts the whole run — it's caught, logged, and the script continues
with everything else. Partial progress from other sources is never discarded
because one source had a bad response.

**Rate limiting:** each source module respects its own documented limits via
the shared `rateLimit.mjs` helper (MusicBrainz's ~1 req/sec is the strictest
and will dominate that medium's sync time — this is expected and fine for an
offline batch job, not a live user-facing wait).

## Image handling

`js/render.js`'s card/detail/constellation-node templates render `work.image`
when present (a normal `<img>` tag — no CORS concern for display, only for
pixel-level reads we don't need) with `work.imageCredit` shown as a small
caption where non-null. Where `work.image` is `null`, the same layout renders
a clean typography/color-only treatment (no procedural SVG generator — that
module, `js/artwork.js`, is removed as part of this change) so there's no
"looks broken" in-between state.

## Testing

- `mapToWork.mjs`'s per-source mapping functions are pure and unit-tested with
  `node --test`, same as every other logic module in this project — given a
  raw fixture API response, assert the mapped work object has the right
  shape/values. This is where mapping bugs would actually live, so it's where
  the tests concentrate.
- `test/data.test.js` (existing, unchanged) continues to validate whatever
  `js/data.js` the sync script produces — schema shape, unique ids,
  decade-matches-year, valid medium enum — regardless of source. This is
  already a solid regression net for the sync script's output.
- The sync script's network/orchestration code itself isn't unit-tested (I/O),
  consistent with how this project already treats DOM rendering: verified by
  running it and inspecting output, not mocked.

## Out of scope for this sub-project

- The mood/feeling-based discovery input (Sub-project B) — separate spec.
- Any UI for hand-editing `data/enrichment.json` — it's a JSON file you edit
  directly if/when you want to curate a specific work further.
- Deduplicating the same underlying work if it appears via two different
  sources (not expected given each medium maps to exactly one source in this
  design).

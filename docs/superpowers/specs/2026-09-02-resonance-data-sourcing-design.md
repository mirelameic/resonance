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
| Film, TV | [TMDB](https://www.themoviedb.org/) API | Free API key (self-service signup) | No CORS support — must be called server-side/in Node, which the sync-script architecture already requires. Provides poster images (hosted on TMDB's CDN), overview text, genres, keywords, production countries, original language, release date. |
| Music | [MusicBrainz](https://musicbrainz.org/) API + [Cover Art Archive](https://coverartarchive.org/) | None | Open data, no key. Rate-limited to ~1 request/second — the sync script must throttle accordingly. MusicBrainz provides release/recording metadata, area (country), date, and folksonomy tags; Cover Art Archive provides album art keyed by MusicBrainz release ID. |
| Literature | [Open Library](https://openlibrary.org/) API | None (generally) | Open data via Internet Archive. Provides title/author/subjects/first-publish-year/cover images. Crowd-sourced — coverage and metadata richness varies per book; be a good citizen with request pacing. |
| Photography, Visual Arts | [The Met Open Access](https://www.metmuseum.org/) API (+ similar CC0 museum sources as a stretch goal: National Gallery of Art, Cleveland Museum of Art, Art Institute of Chicago) | None | CC0-licensed, no key. Strongest for historical/public-domain work; weak on living/contemporary artists and photographers — this is a known, accepted gap (no good open API solves this). Provides object title, artist/culture, date, medium, classification, and high-resolution images. |

All four sources are queried only from the Node sync script — never from the
browser — so API keys (TMDB) never ship to the client and CORS is a non-issue.

## Architecture

```
scripts/
  sync-data.mjs            # orchestrator — `npm run sync-data [-- --new]`
  sources/
    tmdb.mjs                # film + TV
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

  image: "https://image.tmdb.org/t/p/w500/xyz.jpg" | null,
  imageCredit: "Poster courtesy of TMDB" | null,   // required by source terms where applicable; null for CC0 sources like the Met
  source: { type: "tmdb" | "musicbrainz" | "openlibrary" | "met", sourceId: "598" },
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
  top-level genre — TMDB's per-title *keywords* endpoint, MusicBrainz's
  folksonomy *tags*, Open Library's *subjects*, the Met's *classification* /
  *culture* / *period* fields. These are real, source-provided data, not
  invented.
- **`description`**: the source's own synopsis/description text where
  available (TMDB `overview`, Open Library `description`, the Met's object
  description) — real content, not fabricated.
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
since pulling every title a source has (TMDB alone holds over a million) in
one run isn't practical or useful.

**Incremental mode** (`npm run sync-data -- --new`): queries each source's
"recently released/added" surface (TMDB's now-playing/upcoming, MusicBrainz's
recent releases, Open Library's recent additions) to pick up new works without
re-walking the whole historical catalog. The Met's collection doesn't have a
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

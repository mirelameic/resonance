# RESONANCE

An interactive artistic archive for discovering connections between
creative works — film today, with music, literature, photography, and
visual arts planned — from Brazil and around the world. Explore by
combinable parameters (period, country, medium, movement, genre, style,
theme, mood, creator, language) instead of searching by title, and follow
computed connections between works that explain *why* they relate.

The deployed app itself runs entirely locally — no AI APIs, no paid
services, no accounts, no backend, no build step. Growing the dataset uses
one local script that talks to a free public API (see below); browsing the
app never makes a network call of its own.

## Running it

```bash
npm run serve   # or: python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Running the tests

```bash
npm test
```

Every pure logic module is unit-tested with Node's built-in test runner —
no dependencies to install. This covers the app itself (`js/router.js`,
`js/filters.js`, `js/similarity.js`, the dataset schema in `js/data.js`)
and the data-sync pipeline (`scripts/lib/*.mjs`, `scripts/sources/*.mjs`).

## How the app works

- `index.html` + `js/main.js` — the shell: header chrome, theme toggle,
  ambient/grain/cursor decoration, and the hash router bootstrap.
- `js/router.js` — parses `location.hash` into a view/params/query and
  builds hashes back from that shape. Filter state lives in the query
  string, so views are bookmarkable and back/forward works.
- `js/data.js` — the dataset as a plain array. **Auto-generated** by the
  sync pipeline below — never hand-edited.
- `js/filters.js` — pure faceted filtering (`extractFacets`,
  `filterWorks`) that powers the Explore view.
- `js/similarity.js` — the connections engine: a weighted multi-attribute
  similarity score (shared movement, genre, themes, mood, country,
  creator, period proximity) with human-readable reason generation. This
  powers both the "Connections" section on a work's detail page and the
  Surprise Me view's "unexpected discovery" hook. Guards against sentinel
  placeholder values (`'Unknown'`, `'Uncategorized'`, etc.) so sparse data
  never gets scored as a real match.
- `js/render.js` — DOM rendering for each view (home, explore, work
  detail, surprise). Shows a real image when a work has one (sourced from
  Wikimedia Commons), or a clean typography-only card when it doesn't —
  there's no procedural/generated artwork.

## How the dataset is populated

```bash
npm run sync-data          # grow the dataset — safe to run anytime
npm run sync-data -- --new # pull only recently-added/released works
```

The dataset is sourced from **Wikidata's public SPARQL endpoint**
(`query.wikidata.org`) — chosen specifically because it's CC0 (public
domain) and free for commercial use with no API key, unlike most media
metadata APIs (e.g. TMDB requires a paid license once an app is
monetized). No credentials needed.

The sync is **paginated and checkpointed**, not a one-shot pull:
`scripts/lib/syncState.mjs` tracks, per query "bucket" (e.g. `film
1990-1999`, or a Brazil-filtered variant of that decade — Brazilian
representation is queried for explicitly, not left to chance), how far
into that bucket's results the last run got (`offset`) and whether
Wikidata has any more to give (`exhausted`) — persisted in
`data/sync-state.json`, committed to git. Each run:

- skips any exhausted bucket with **zero network calls**
- asks for the *next* page for buckets still in progress, instead of
  re-fetching the same top results every time
- advances the checkpoint only on a successful response — a network/
  server error (Wikidata's shared endpoint is often under heavy load)
  leaves the checkpoint untouched, so the same slice is retried next run
  rather than skipped or double-counted
- saves state after every individual bucket, so an interrupted run never
  loses progress already made

This means `npm run sync-data` is always safe to re-run and purely
additive — it never clears or duplicates existing works, and running it
ten times costs roughly the same as running it once, since exhausted work
is never repeated.

`data/enrichment.json` is an optional, hand-curated overlay (empty by
default) for strengthening specific works' `movement`/`themes`/`mood`/
`context` beyond what's auto-derivable from the API, keyed by
`"<source>:<sourceId>"`.

## Design

Visual identity started shared with [the author's portfolio](../portfolio)
— same type stack (Space Grotesk / Newsreader / JetBrains Mono),
grain/cursor/corner motifs, reveal-on-scroll and hand-drawn SVG draw-in
animation — but the color palette has since diverged into its own green
scheme (`--green` / `--moss`, alongside `--rust` / `--teal`), rather than
the portfolio's blue/wine.

## Specs & plans

Design docs and implementation plans live in `docs/superpowers/`, in case
you want the full history of decisions (including two abandoned attempts —
a hand-curated placeholder dataset, and a TMDB integration dropped once
its commercial-use licensing terms became clear).

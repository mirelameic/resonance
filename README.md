# RESONANCE

An interactive archive for discovering connections between creative
works from around the world — music, film, literature, and visual
art, added gradually (film is live today). Explore by combinable
parameters (period, country, medium, movement, genre, style, theme,
mood, creator, language) instead of searching by title, and see
computed connections that explain *why* works relate.

Runs entirely locally: static HTML/CSS/JS, no backend, no build step,
no AI APIs, no accounts.

## Running it

```bash
npm run serve   # or: python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Testing

```bash
npm install   # first time only — installs jsdom for DOM/integration tests
npm test
```

Pure logic (`js/router.js`, `js/filters.js`, `js/similarity.js`, the
sync pipeline) is unit-tested with zero dependencies. `js/render.js`
and `js/main.js` are integration-tested against a real DOM via
`jsdom` — the one thing you need to `npm install`. The app itself
still ships nothing extra: jsdom is a test-only dependency, never
loaded by the browser.

## Structure

- `index.html` + `js/main.js` — app shell and router bootstrap
- `js/router.js` — hash-based routing (bookmarkable views)
- `js/data.js` — the dataset. **Auto-generated** — never hand-edited
- `js/filters.js` — faceted filtering for the Explore view
- `js/similarity.js` — the connections engine (weighted similarity + reasons)
- `js/render.js` — DOM rendering for each view

## Growing the dataset

```bash
npm run sync-data          # pull more works from Wikidata
npm run sync-data -- --new # pull only recently-added/released works
```

Sourced from Wikidata's public SPARQL endpoint (CC0, no API key). The
sync is paginated and checkpointed (`data/sync-state.json`), so it's
always safe to re-run — it's additive only, never duplicates or loses
progress on failure.

`data/enrichment.json` is an optional hand-curated overlay for
strengthening specific works' metadata beyond what the API gives.

## Design

Space Grotesk / Newsreader / JetBrains Mono, grain/cursor motifs,
green palette (`--green` / `--moss`, plus `--rust` / `--teal`).

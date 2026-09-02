# RESONANCE

An interactive artistic archive for discovering connections between music,
film, TV, literature, photography, and visual arts — from Brazil and
around the world. Explore by combinable parameters (period, country,
medium, movement, genre, style, theme, mood, cultural context, creator,
language) instead of searching by title, and follow computed connections
between works across completely different mediums.

Runs entirely locally — no AI APIs, no paid services, no accounts, no
backend, no build step.

## Running it

```bash
npm run serve   # or: python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Running the tests

```bash
npm test
```

Unit tests cover every pure logic module (`js/router.js`, `js/filters.js`,
`js/artwork.js`, `js/similarity.js`, and the dataset schema in
`js/data.js`) using Node's built-in test runner — no dependencies to
install.

## How it works

- `index.html` + `js/main.js` — the shell: header chrome, theme toggle,
  ambient/grain/cursor decoration, and the hash router bootstrap.
- `js/router.js` — parses `location.hash` into a view/params/query and
  builds hashes back from that shape. Filter state lives in the query
  string, so views are bookmarkable and back/forward works.
- `js/data.js` — the curated dataset (79 works) as a plain array.
- `js/filters.js` — pure faceted filtering (`extractFacets`,
  `filterWorks`) that powers the Explore view.
- `js/artwork.js` — a deterministic procedural SVG cover-art generator,
  seeded from each work's id, so every work has a distinct visual
  identity with no sourced images.
- `js/similarity.js` — the connections engine: a weighted multi-attribute
  similarity score (shared movement, genre, themes, mood, country,
  creator, period proximity) with human-readable reason generation. This
  is what powers both the "Connections" section on a work's detail page
  and the Surprise Me view's "unexpected discovery" hook.
- `js/render.js` — DOM rendering for each view (home, explore, work
  detail, surprise), consuming the modules above.

## Design

Visual language is shared with [the author's portfolio](../portfolio):
same color tokens, type stack, grain/cursor/corner motifs, and
reveal-on-scroll and hand-drawn SVG draw-in animation techniques.

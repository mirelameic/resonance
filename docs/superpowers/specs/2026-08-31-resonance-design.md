# RESONANCE — Design Spec

Date: 2026-08-31

## Concept

RESONANCE is an interactive artistic archive for discovering connections
between creative works — music, film, TV, literature, photography, and
visual arts — from Brazil and around the world. Instead of searching by
title, users explore through combinable parameters (period, country,
medium, movement, genre, style, theme, mood, cultural context, creator,
language) and surface unexpected works that share ideas, aesthetics, or
context across completely different mediums.

Runs entirely locally: no AI APIs, no paid services, no auth, no build
step. A static site that can be opened with any local static server (or
directly as a file).

## Visual identity

Directly extends the visual language of `~/Desktop/portfolio`: same design
tokens (cream `#F7F4EC` / near-black `#121110` themes, ink text, accent
colors wine `#732334`, blue `#2A46E8`, rust `#C1502E`, teal `#2B7A6F`),
same type stack (Space Grotesk display, Newsreader serif body, JetBrains
Mono for tags/labels), same motifs: bracketed mono tags (`[ 01 / INTRO ]`),
crosshair corner marks, film-grain overlay, custom cursor dot, drifting
ambient particles, scroll-reveal transitions, and hand-drawn SVG diagrams
that draw themselves in via `stroke-dashoffset` animation. Dark/light theme
toggle persisted to `localStorage`, defaulting to dark.

New components (filter chips, work cards, constellation diagrams) are
built in that same visual language rather than introducing a new one.

## Architecture

Single-page app, vanilla HTML/CSS/JS, no framework, no bundler.

- `index.html` — shell: header chrome, ambient/grain/cursor decorations,
  a single `<main id="app">` mount point, script tags.
- `css/style.css` — design tokens (copied/extended from the portfolio) +
  archive-specific components (filter panel, cards, constellation,
  detail layout).
- `js/data.js` — the works dataset as a plain exported JS array (no
  `fetch`, so it works whether opened via a local server or as a file —
  no CORS issues either way).
- `js/artwork.js` — deterministic procedural SVG cover-art generator,
  seeded from each work's id/attributes.
- `js/similarity.js` — the connections engine (see below).
- `js/render.js` — pure(ish) render functions for each view: explore
  grid, work detail, surprise.
- `js/main.js` — hash router (`#/`, `#/explore`, `#/work/:id`,
  `#/surprise`) + event wiring + app bootstrap.

Routing is hash-based; filter state is encoded in the hash's query string
(e.g. `#/explore?medium=film,music&decade=1960s`) so views are
bookmarkable/shareable and browser back/forward works.

## Data model

Each work in `js/data.js`:

```js
{
  id: "cidade-de-deus",
  title: "Cidade de Deus",
  creator: "Fernando Meirelles",
  medium: "film",            // music | film | tv | literature | photography | visual-arts
  year: 2002,
  decade: "2000s",
  country: "Brazil",
  language: "Portuguese",
  movement: "Cinema de favela",
  genre: "Crime drama",
  style: ["Handheld", "Nonlinear narrative"],
  themes: ["Violence", "Coming of age", "Poverty", "Fate"],
  mood: ["Frenetic", "Unflinching"],
  context: "Short prose on the historical/cultural context.",
  description: "Short evocative description of the work."
}
```

No copyrighted images are sourced. Each card/detail view instead shows a
procedurally generated SVG cover (geometric marks composed from a hash of
the work's id, colored from the shared accent palette) — every work gets a
real, distinct visual identity with zero asset sourcing.

## Connections engine

Rather than hand-authoring relationships between ~75 works, connections
are computed at runtime in `similarity.js`: a weighted score comparing two
works across shared movement, genre, themes, mood, period proximity,
country, and creator produces a ranked list of related works, each
annotated with a human-readable reason (e.g. "same movement: Tropicália",
"shared theme: memory — 12 years apart, different hemispheres"). This
scales to any dataset size without manual curation and is the project's
technical centerpiece — a small, explainable multi-attribute
similarity/explanation algorithm.

## Views

**Explore** — faceted filter panel (chips, multi-select; OR within a
category, AND across categories) for every parameter listed above, plus
free-text search over title/creator. Results render as a live-updating
card grid (procedural cover, title, creator, year, medium tag).

**Work detail** — full metadata, context/description prose, large
procedural artwork. Below: a connections section listing ranked related
works with their "why," plus a small constellation SVG (the current work
as a central hub, related works as orbiting nodes connected by
draw-in-animated lines, styled after the portfolio's hero diagram) —
clicking a node navigates to that work.

**Surprise Me** — picks a random work, then surfaces its strongest
*unexpected* connection (cross-medium, low shared-dimension count, but
still a genuine match) as the discovery hook, with a reroll button.

## Out of scope for v1

- User accounts, saved collections, or any persistence beyond
  `localStorage` theme preference.
- Server/backend of any kind.
- Deployment/GitHub Pages setup (explicitly deferred — local only for
  now).
- Editing/authoring UI for the dataset (it's a hand-curated JS file).

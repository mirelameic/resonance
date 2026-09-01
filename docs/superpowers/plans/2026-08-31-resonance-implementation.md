# RESONANCE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build RESONANCE, a local, static, single-page artistic discovery archive that lets users explore ~75 curated works (music, film, TV, literature, photography, visual arts) via combinable parameters and computed cross-medium connections, in the visual language of `~/Desktop/portfolio`.

**Architecture:** Vanilla HTML/CSS/JS SPA, no build step, no framework. A hash router (`js/router.js`) dispatches to render functions (`js/render.js`) that read a curated dataset (`js/data.js`) and consume three pure logic modules — filtering (`js/filters.js`), procedural cover art (`js/artwork.js`), and a weighted connections/similarity engine (`js/similarity.js`). Pure modules are unit-tested with Node's built-in test runner (zero dependencies); DOM rendering is verified manually in the browser.

**Tech Stack:** Plain HTML5, CSS3 (custom properties, no preprocessor), ES modules (no bundler), Node.js built-in `node --test` for unit tests, Python's `http.server` as the local dev server (no npm install required at all).

**Spec:** `docs/superpowers/specs/2026-08-31-resonance-design.md`

## Global Constraints

- No AI APIs, no paid services, no authentication/accounts, no backend — everything runs from static files served locally.
- No build step and no npm dependencies — `node --test` (built into Node 20+) and `python3 -m http.server` are the only tooling, both already present.
- No image assets are sourced from anywhere; every work's cover art is generated procedurally in-browser from `js/artwork.js`.
- `js/data.js` is a plain ES module exporting an array — never `fetch`-ed — so the app works identically whether opened via a local server or (mostly) as a `file://` URL.
- Reuse the portfolio's exact design tokens and motifs (colors, fonts, grain, cursor dot, crosshair corners, reveal-on-scroll, hand-drawn SVG draw-in animation) rather than inventing a new visual language.
- All decorative motion respects `prefers-reduced-motion: reduce`.
- Local git repository only (`git init`, no remote) — commit after every task for a clean history. No GitHub Pages / CNAME setup (explicitly deferred).

---

## Task 1: Project scaffold, shared chrome, and local dev loop

**Files:**
- Create: `resonance/package.json`
- Create: `resonance/assets/favicon.svg`
- Create: `resonance/assets/noise.svg` (copied from `~/Desktop/portfolio/assets/noise.svg`)
- Create: `resonance/index.html`
- Create: `resonance/css/style.css`
- Create: `resonance/js/reveal.js`
- Create: `resonance/js/main.js`
- Create: `resonance/.gitignore`

**Interfaces:**
- Produces: `observeReveals(root = document)` exported from `js/reveal.js` — attaches an `IntersectionObserver` to every `.reveal` element under `root` and adds `.is-visible` when it enters the viewport (or immediately, under reduced motion / no `IntersectionObserver`). Later tasks call this after every dynamic render.
- Produces: a mounted `<main id="app">` element in `index.html` that later tasks render into.

- [ ] **Step 1: Initialize the project directory and local git repo**

```bash
cd ~/Desktop/resonance
mkdir -p css js assets test
git init
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "resonance",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "RESONANCE — a local, static artistic discovery archive connecting works across music, film, TV, literature, photography, and visual arts.",
  "scripts": {
    "test": "node --test",
    "serve": "python3 -m http.server 8000"
  }
}
```

- [ ] **Step 3: Copy the grain texture and create a new favicon**

```bash
cp ~/Desktop/portfolio/assets/noise.svg ~/Desktop/resonance/assets/noise.svg
```

Create `assets/favicon.svg` (a small three-node "constellation" mark, in the same stroke language as the portfolio's aperture mark, but a distinct glyph so the two sites are recognizably siblings, not identical):

```svg
<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#2A46E8" stroke-width="2.4" stroke-linecap="round" fill="none">
    <line x1="8" y1="24" x2="16" y2="8"/>
    <line x1="16" y1="8" x2="24" y2="20"/>
    <line x1="24" y1="20" x2="8" y2="24"/>
  </g>
  <circle cx="8" cy="24" r="3.4" fill="#732334"/>
  <circle cx="16" cy="8" r="3.4" fill="#732334"/>
  <circle cx="24" cy="20" r="3.4" fill="#732334"/>
</svg>
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>RESONANCE — an archive of connections</title>
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
<meta name="description" content="RESONANCE — an interactive archive for discovering connections between music, film, TV, literature, photography, and visual arts across Brazil and the world.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/style.css">
<script>
  (function () {
    try {
      var saved = localStorage.getItem('theme');
      document.documentElement.setAttribute('data-theme', saved || 'dark');
    } catch (e) {}
  })();
</script>
</head>
<body>

<div class="corner corner--bl" aria-hidden="true"></div>
<div class="corner corner--br" aria-hidden="true"></div>
<div class="ambient" aria-hidden="true" id="ambient"></div>
<div class="grain" aria-hidden="true"></div>
<div class="cursor-dot" aria-hidden="true" id="cursorDot"></div>

<header class="chrome">
  <a class="chrome__brand" href="#/">
    <svg class="chrome__mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <g stroke="var(--blue)" stroke-width="2.4" stroke-linecap="round">
        <line x1="8" y1="24" x2="16" y2="8"/>
        <line x1="16" y1="8" x2="24" y2="20"/>
        <line x1="24" y1="20" x2="8" y2="24"/>
      </g>
      <circle cx="8" cy="24" r="3.2" fill="var(--wine)"/>
      <circle cx="16" cy="8" r="3.2" fill="var(--wine)"/>
      <circle cx="24" cy="20" r="3.2" fill="var(--wine)"/>
    </svg>
    RESONANCE
  </a>
  <div class="chrome__meta">
    <span class="tag" id="workCount">[ ARCHIVE ]</span>
    <button class="theme-toggle" id="themeToggle" type="button" aria-pressed="false" aria-label="Toggle dark mode">
      <svg class="theme-toggle__icon theme-toggle__icon--sun" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="5"/>
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>
      </svg>
      <svg class="theme-toggle__icon theme-toggle__icon--moon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"/>
      </svg>
    </button>
  </div>
</header>

<main id="app">
  <section class="view">
    <p class="tag">[ LOADING ARCHIVE… ]</p>
  </section>
</main>

<footer class="footer">
  <span class="tag">© 2026 RESONANCE — AN ARCHIVE OF CONNECTIONS</span>
  <span class="tag">[ RUNS ENTIRELY LOCAL ]</span>
</footer>

<script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create `css/style.css` with the ported design tokens and base chrome**

```css
/* ===== Tokens (ported from ~/Desktop/portfolio) ===== */
:root {
  --bg: #F7F4EC;
  --ink: #17160F;
  --ink-soft: rgba(23,22,15,0.62);
  --ink-faint: rgba(23,22,15,0.34);
  --blue: #2A46E8;
  --rust: #C1502E;
  --wine: #732334;
  --teal: #2B7A6F;
  --line: rgba(23,22,15,0.16);
  --grid-line: rgba(23,22,15,0.07);

  --f-display: 'Space Grotesk', sans-serif;
  --f-body: 'Newsreader', serif;
  --f-mono: 'JetBrains Mono', monospace;

  --edge: 20px;
}

:root[data-theme="dark"] {
  --bg: #121110;
  --ink: #F3EEE2;
  --ink-soft: rgba(243,238,226,0.66);
  --ink-faint: rgba(243,238,226,0.36);
  --blue: #6E8CFF;
  --rust: #FF9354;
  --wine: #D65C72;
  --teal: #4FBBAA;
  --line: rgba(243,238,226,0.16);
  --grid-line: rgba(243,238,226,0.07);
}

body { transition: background-color 0.4s ease, color 0.4s ease, border-color 0.4s ease; }

@media (min-width: 720px) { :root { --edge: 32px; } }

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--f-body);
  font-size: 17px;
  line-height: 1.5;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

::selection { background: var(--wine); color: var(--bg); }
a { color: inherit; }

.tag {
  font-family: var(--f-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
  white-space: nowrap;
}

/* ===== Corner crosshairs ===== */
.corner {
  position: fixed; width: 13px; height: 13px; z-index: 50;
  pointer-events: none; opacity: 0.5;
  animation: corner-breathe 5s ease-in-out infinite;
}
.corner::before, .corner::after { content: ""; position: absolute; background: var(--ink); }
.corner::before { width: 100%; height: 1px; top: 50%; left: 0; }
.corner::after { width: 1px; height: 100%; left: 50%; top: 0; }
.corner--bl { bottom: var(--edge); left: var(--edge); }
.corner--br { bottom: var(--edge); right: var(--edge); animation-delay: 2.5s; }
@keyframes corner-breathe { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.75; } }
@media (prefers-reduced-motion: reduce) { .corner { animation: none; opacity: 0.5; } }

/* ===== Ambient drifting particles ===== */
.ambient { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
.ambient span {
  position: absolute; width: 3px; height: 3px; border-radius: 50%;
  background: var(--ink-faint); animation: drift linear infinite;
}
@keyframes drift {
  0%   { transform: translate(0, 0); opacity: 0.15; }
  50%  { opacity: 0.5; }
  100% { transform: translate(var(--dx), var(--dy)); opacity: 0.15; }
}
@media (prefers-reduced-motion: reduce) { .ambient { display: none; } }

/* ===== Grain overlay ===== */
.grain {
  position: fixed; inset: 0; z-index: 95; pointer-events: none;
  opacity: 0.36; mix-blend-mode: overlay;
  background-image: url("../assets/noise.svg"); background-size: 80px 80px;
}
:root[data-theme="dark"] .grain { opacity: 0.46; mix-blend-mode: soft-light; }

/* ===== Cursor accent dot ===== */
.cursor-dot {
  position: fixed; top: 0; left: 0; width: 8px; height: 8px; margin: -4px 0 0 -4px;
  border-radius: 50%; border: 1px solid var(--wine); z-index: 60; pointer-events: none;
  --cx: -100px; --cy: -100px; --cs: 1;
  transform: translate(var(--cx), var(--cy)) scale(var(--cs));
  transition: transform 0.12s ease-out, opacity 0.3s ease, background 0.3s ease;
  opacity: 0;
}
.cursor-dot.is-active { opacity: 0.8; }
.cursor-dot.is-hovering { background: var(--wine); --cs: 1.8; }
@media (hover: none), (prefers-reduced-motion: reduce) { .cursor-dot { display: none; } }

/* ===== Chrome header ===== */
.chrome {
  position: fixed; top: 0; left: 0; right: 0; z-index: 40;
  display: flex; flex-wrap: wrap; gap: 8px 12px; justify-content: space-between; align-items: center;
  padding: 20px var(--edge) 0;
}
.chrome__brand {
  display: flex; align-items: center; gap: 9px;
  font-family: var(--f-mono); font-size: 19px; font-weight: 700; letter-spacing: 0.08em;
  text-decoration: none;
}
.chrome__mark { width: 40px; height: 40px; flex-shrink: 0; animation: chrome-mark-spin 26s linear infinite; }
@keyframes chrome-mark-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .chrome__mark { animation: none; } }
.chrome__meta { display: flex; align-items: center; gap: 18px; }
.chrome__meta .tag { font-size: 13px; }

.theme-toggle {
  display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; padding: 0;
  border: 1px solid var(--line); border-radius: 50%; background: transparent; color: var(--ink);
  cursor: pointer; position: relative; transition: border-color 0.4s ease, transform 0.3s ease;
}
.theme-toggle:hover { border-color: var(--wine); transform: rotate(20deg); }
.theme-toggle__icon {
  width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.5; position: absolute;
  transition: opacity 0.3s ease, transform 0.4s ease;
}
.theme-toggle__icon--sun { opacity: 1; transform: scale(1) rotate(0deg); }
.theme-toggle__icon--moon { opacity: 0; transform: scale(0.5) rotate(-40deg); }
:root[data-theme="dark"] .theme-toggle__icon--sun { opacity: 0; transform: scale(0.5) rotate(40deg); }
:root[data-theme="dark"] .theme-toggle__icon--moon { opacity: 1; transform: scale(1) rotate(0deg); }

/* ===== Layout scaffolding ===== */
main { padding: 120px var(--edge) 0; }
.view { max-width: 1040px; margin: 0 auto; padding-bottom: 70px; }
.section-label { display: block; margin-bottom: 28px; }

/* ===== Reveal-on-scroll ===== */
.reveal { opacity: 0; transform: translateY(18px); transition: opacity 0.7s ease, transform 0.7s ease; }
.reveal.is-visible { opacity: 1; transform: translateY(0); }
@media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; transform: none; transition: none; } }

/* ===== Shared components ===== */
.pill {
  display: inline-block;
  font-family: var(--f-mono); font-size: 12px; letter-spacing: 0.06em; text-decoration: none;
  color: var(--ink); border: 1px solid var(--ink); padding: 10px 20px; border-radius: 999px;
  background: transparent; cursor: pointer; transition: background 0.25s ease, color 0.25s ease;
}
.pill:hover { background: var(--wine); color: var(--bg); border-color: var(--wine); }

/* ===== Footer ===== */
.footer {
  display: flex; flex-wrap: wrap; gap: 8px 16px; justify-content: space-between;
  padding: 30px var(--edge) 40px; max-width: 1040px; margin: 0 auto;
}
```

- [ ] **Step 6: Create `js/reveal.js`**

```js
export function observeReveals(root = document) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const elements = root.querySelectorAll('.reveal');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    elements.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );
  elements.forEach((el) => observer.observe(el));
}
```

- [ ] **Step 7: Create `js/main.js`**

```js
import { observeReveals } from './reveal.js';

// Theme toggle
(function () {
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;
  const setPressed = () => {
    toggle.setAttribute('aria-pressed', root.getAttribute('data-theme') === 'dark' ? 'true' : 'false');
  };
  setPressed();
  toggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    setPressed();
    try { localStorage.setItem('theme', next); } catch (e) {}
  });
})();

// Ambient drifting dots
(function () {
  const field = document.getElementById('ambient');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!field || reduceMotion) return;
  const COUNT = 10;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < COUNT; i++) {
    const dot = document.createElement('span');
    dot.style.top = `${Math.random() * 100}%`;
    dot.style.left = `${Math.random() * 100}%`;
    dot.style.setProperty('--dx', `${(Math.random() * 160 - 80).toFixed(0)}px`);
    dot.style.setProperty('--dy', `${(Math.random() * 160 - 80).toFixed(0)}px`);
    dot.style.animationDuration = `${(16 + Math.random() * 14).toFixed(1)}s`;
    dot.style.animationDelay = `${(-Math.random() * 20).toFixed(1)}s`;
    frag.appendChild(dot);
  }
  field.appendChild(frag);
})();

// Cursor accent dot
(function () {
  const dot = document.getElementById('cursorDot');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!dot || reduceMotion || !window.matchMedia('(hover: hover)').matches) return;
  let active = false;
  window.addEventListener('mousemove', (e) => {
    dot.style.setProperty('--cx', `${e.clientX}px`);
    dot.style.setProperty('--cy', `${e.clientY}px`);
    if (!active) { dot.classList.add('is-active'); active = true; }
  }, { passive: true });
  document.addEventListener('mouseleave', () => {
    dot.classList.remove('is-active');
    active = false;
  });
  const HOVER_TARGETS = 'a, button, .work-card, .constellation-node';
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(HOVER_TARGETS)) dot.classList.add('is-hovering');
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(HOVER_TARGETS)) dot.classList.remove('is-hovering');
  });
})();

observeReveals(document);
```

- [ ] **Step 8: Create `.gitignore`**

```
.DS_Store
node_modules/
```

- [ ] **Step 9: Start the local server and verify in the browser**

```bash
cd ~/Desktop/resonance
python3 -m http.server 8000 &
```

Open `http://localhost:8000/` in the browser. Confirm: header with the RESONANCE brand mark (slowly rotating) and theme toggle is fixed at the top; crosshair corners breathe at the bottom corners; a subtle grain texture and drifting particles are visible; the cursor grows a wine-colored dot on hover targets; clicking the theme toggle flips between dark/light and persists across a reload; "[ LOADING ARCHIVE… ]" shows in the body; no console errors.

- [ ] **Step 10: Commit**

```bash
cd ~/Desktop/resonance
git add -A
git commit -m "Scaffold RESONANCE: shared chrome, tokens, and local dev loop"
```

---

## Task 2: Hash router and view dispatch

**Files:**
- Create: `resonance/js/router.js`
- Create: `resonance/test/router.test.js`
- Create: `resonance/js/render.js`
- Modify: `resonance/js/main.js` — wire routing into the bootstrap

**Interfaces:**
- Consumes: nothing new from Task 1 beyond the DOM shell (`#app` mount point).
- Produces: `parseRoute(hash: string) -> { view: 'home'|'explore'|'work'|'surprise', params: { id?: string }, query: Record<string, string[]> }` and `buildHash(view: string, params?: object, query?: Record<string, string[]>) -> string`, both exported from `js/router.js`. Later tasks use `buildHash` to build every internal link/navigation and `parseRoute` is only called from `main.js`.
- Produces: `renderView(mount: HTMLElement, view: string, params: object, query: object) -> void` exported from `js/render.js`, dispatching to per-view render functions (stubbed here, implemented in Tasks 6/8/9/10).

- [ ] **Step 1: Write the failing router tests**

Create `test/router.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, buildHash } from '../js/router.js';

test('parseRoute: empty hash is home', () => {
  assert.deepEqual(parseRoute(''), { view: 'home', params: {}, query: {} });
});

test('parseRoute: bare "#/" is home', () => {
  assert.deepEqual(parseRoute('#/'), { view: 'home', params: {}, query: {} });
});

test('parseRoute: explore with query params splits comma lists', () => {
  const result = parseRoute('#/explore?medium=film,music&decade=1960s');
  assert.equal(result.view, 'explore');
  assert.deepEqual(result.query.medium, ['film', 'music']);
  assert.deepEqual(result.query.decade, ['1960s']);
});

test('parseRoute: work detail captures the id param', () => {
  const result = parseRoute('#/work/cidade-de-deus');
  assert.equal(result.view, 'work');
  assert.equal(result.params.id, 'cidade-de-deus');
});

test('parseRoute: unknown view falls back to home', () => {
  assert.equal(parseRoute('#/nonsense').view, 'home');
});

test('buildHash: explore query roundtrips through parseRoute', () => {
  const hash = buildHash('explore', {}, { medium: ['film', 'music'], decade: ['1960s'] });
  const parsed = parseRoute(hash);
  assert.equal(parsed.view, 'explore');
  assert.deepEqual(parsed.query.medium, ['film', 'music']);
});

test('buildHash: work detail includes the id in the path', () => {
  assert.equal(buildHash('work', { id: 'cidade-de-deus' }), '#/work/cidade-de-deus');
});

test('buildHash: home has no trailing segment', () => {
  assert.equal(buildHash('home'), '#/');
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
cd ~/Desktop/resonance
npm test
```

Expected: FAIL — `Cannot find module '../js/router.js'`.

- [ ] **Step 3: Implement `js/router.js`**

```js
const VALID_VIEWS = new Set(['home', 'explore', 'work', 'surprise']);

export function parseRoute(hash) {
  const raw = (hash || '').replace(/^#/, '');
  if (!raw || raw === '/') return { view: 'home', params: {}, query: {} };

  const [pathPart, queryPart] = raw.slice(1).split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const rawView = segments[0] || 'home';
  const view = VALID_VIEWS.has(rawView) ? rawView : 'home';

  const params = {};
  if (view === 'work' && segments[1]) params.id = segments[1];

  const query = {};
  if (queryPart) {
    for (const pair of queryPart.split('&')) {
      if (!pair) continue;
      const [key, value] = pair.split('=');
      if (!key) continue;
      query[decodeURIComponent(key)] = decodeURIComponent(value || '').split(',').filter(Boolean);
    }
  }

  return { view, params, query };
}

export function buildHash(view, params = {}, query = {}) {
  let path = `#/${view === 'home' ? '' : view}`;
  if (view === 'work' && params.id) path += `/${params.id}`;

  const queryEntries = Object.entries(query).filter(([, v]) => Array.isArray(v) && v.length);
  if (queryEntries.length) {
    const qs = queryEntries
      .map(([k, v]) => `${encodeURIComponent(k)}=${v.map(encodeURIComponent).join(',')}`)
      .join('&');
    path += `?${qs}`;
  }
  return path;
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
npm test
```

Expected: PASS — 8 passing router tests.

- [ ] **Step 5: Create `js/render.js` with stubbed views**

```js
export function renderView(mount, view, params, query) {
  switch (view) {
    case 'explore':
      mount.innerHTML = `<section class="view"><p class="tag">[ EXPLORE — COMING SOON ]</p></section>`;
      break;
    case 'work':
      mount.innerHTML = `<section class="view"><p class="tag">[ WORK: ${escapeHtml(params.id || '')} — COMING SOON ]</p></section>`;
      break;
    case 'surprise':
      mount.innerHTML = `<section class="view"><p class="tag">[ SURPRISE ME — COMING SOON ]</p></section>`;
      break;
    default:
      mount.innerHTML = `<section class="view"><p class="tag">[ HOME — COMING SOON ]</p></section>`;
  }
}

export function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

- [ ] **Step 6: Wire the router into `js/main.js`**

Add to the top of `js/main.js` (below the existing `import { observeReveals } from './reveal.js';`):

```js
import { parseRoute } from './router.js';
import { renderView } from './render.js';
```

Replace the final `observeReveals(document);` line at the bottom of `js/main.js` with:

```js
function handleRouteChange() {
  const { view, params, query } = parseRoute(window.location.hash);
  const mount = document.getElementById('app');
  renderView(mount, view, params, query);
  observeReveals(mount);
}

window.addEventListener('hashchange', handleRouteChange);
handleRouteChange();
```

- [ ] **Step 7: Verify routing manually in the browser**

Reload `http://localhost:8000/`. Confirm the body now shows "[ HOME — COMING SOON ]". Manually change the URL to `http://localhost:8000/#/explore`, `#/work/anything`, and `#/surprise` — confirm the placeholder text updates instantly without a page reload each time, and an unknown hash like `#/nope` falls back to the home placeholder.

- [ ] **Step 8: Commit**

```bash
cd ~/Desktop/resonance
git add -A
git commit -m "Add hash router and view dispatch skeleton"
```

---

## Task 3: Data schema, validation test, and curated dataset

**Files:**
- Create: `resonance/test/data.test.js`
- Create: `resonance/js/data.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `works` — a named export from `js/data.js`, an array of ~75 objects matching the schema below. Every subsequent task (`filters.js`, `artwork.js`, `similarity.js`, `render.js`) consumes this array by importing `{ works }` from `'./data.js'`.

**Schema** (every work must satisfy this; enforced by the validation test):

```js
{
  id: string,            // unique, kebab-case slug
  title: string,
  creator: string,
  medium: 'music' | 'film' | 'tv' | 'literature' | 'photography' | 'visual-arts',
  year: number,           // 4-digit release/publication year
  decade: string,         // e.g. "1960s" — must be `${Math.floor(year/10)*10}s`
  country: string,
  language: string,
  movement: string,       // artistic movement or scene, can be a specific label per work
  genre: string,
  style: string[],        // 1+ short style tags
  themes: string[],       // 1+ theme tags
  mood: string[],         // 1+ mood tags
  context: string,        // 1-3 sentence cultural/historical context
  description: string,    // 1-3 sentence evocative description
}
```

- [ ] **Step 1: Write the failing schema validation test**

Create `test/data.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { works } from '../js/data.js';

const VALID_MEDIA = new Set(['music', 'film', 'tv', 'literature', 'photography', 'visual-arts']);
const REQUIRED_STRING_FIELDS = ['id', 'title', 'creator', 'medium', 'country', 'language', 'movement', 'genre', 'context', 'description'];
const REQUIRED_ARRAY_FIELDS = ['style', 'themes', 'mood'];

test('data.js exports at least 70 works', () => {
  assert.ok(Array.isArray(works));
  assert.ok(works.length >= 70, `expected >= 70 works, got ${works.length}`);
});

test('every work has all required string fields non-empty', () => {
  for (const work of works) {
    for (const field of REQUIRED_STRING_FIELDS) {
      assert.equal(typeof work[field], 'string', `${work.id || '?'}.${field} should be a string`);
      assert.ok(work[field].trim().length > 0, `${work.id || '?'}.${field} should not be empty`);
    }
  }
});

test('every work has non-empty array fields', () => {
  for (const work of works) {
    for (const field of REQUIRED_ARRAY_FIELDS) {
      assert.ok(Array.isArray(work[field]), `${work.id}.${field} should be an array`);
      assert.ok(work[field].length > 0, `${work.id}.${field} should not be empty`);
    }
  }
});

test('every work has a valid medium', () => {
  for (const work of works) {
    assert.ok(VALID_MEDIA.has(work.medium), `${work.id} has invalid medium "${work.medium}"`);
  }
});

test('every work has a plausible 4-digit year and matching decade', () => {
  for (const work of works) {
    assert.ok(Number.isInteger(work.year) && work.year > 1000 && work.year <= 2026, `${work.id} has invalid year ${work.year}`);
    assert.equal(work.decade, `${Math.floor(work.year / 10) * 10}s`, `${work.id} decade should match its year`);
  }
});

test('every work id is unique', () => {
  const ids = works.map((w) => w.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids found');
});

test('every id is a kebab-case slug', () => {
  for (const work of works) {
    assert.match(work.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${work.id} is not kebab-case`);
  }
});

test('the collection spans every medium and includes Brazilian works', () => {
  const mediaPresent = new Set(works.map((w) => w.medium));
  for (const medium of VALID_MEDIA) {
    assert.ok(mediaPresent.has(medium), `no work found for medium "${medium}"`);
  }
  assert.ok(works.some((w) => w.country === 'Brazil'), 'expected at least one Brazilian work');
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../js/data.js'`.

- [ ] **Step 3: Create `js/data.js` and curate the dataset**

Start the file with this exact structure and pattern (one fully worked example per medium is shown below — continue populating `works` with real, well-known works following this exact shape until the collection has 70-80 entries spanning all six mediums, a strong mix of Brazilian and international works, and a spread of periods from early 20th century to the 2020s):

```js
export const works = [
  {
    id: 'cidade-de-deus',
    title: 'Cidade de Deus',
    creator: 'Fernando Meirelles',
    medium: 'film',
    year: 2002,
    decade: '2000s',
    country: 'Brazil',
    language: 'Portuguese',
    movement: 'Cinema de favela',
    genre: 'Crime drama',
    style: ['Handheld camera', 'Nonlinear narrative', 'Ensemble cast'],
    themes: ['Violence', 'Coming of age', 'Poverty', 'Fate'],
    mood: ['Frenetic', 'Unflinching'],
    context: 'Adapted from Paulo Lins’ novel, it dramatizes three decades of organized crime in Rio de Janeiro’s Cidade de Deus favela, cast largely with nonprofessional actors from the community it depicts.',
    description: 'A kinetic, unsentimental chronicle of a boy growing up inside a drug war he never chose, told through the eyes of the one kid who got out with a camera instead of a gun.',
  },
  {
    id: 'tropicalia-ou-panis-et-circenses',
    title: 'Tropicália ou Panis et Circenses',
    creator: 'Vários Artistas (Caetano Veloso, Gilberto Gil, Os Mutantes, Gal Costa, Nara Leão, Tom Zé)',
    medium: 'music',
    year: 1968,
    decade: '1960s',
    country: 'Brazil',
    language: 'Portuguese',
    movement: 'Tropicália',
    genre: 'Psychedelic MPB',
    style: ['Collage', 'Genre pastiche', 'Orchestral pop'],
    themes: ['National identity', 'Modernity vs. tradition', 'Censorship'],
    mood: ['Playful', 'Defiant'],
    context: 'Released under Brazil’s military dictatorship, this manifesto-album collaged bossa nova, rock, and Bahian folk into a single deliberately chaotic statement of cultural resistance.',
    description: 'A joyfully cluttered collage-record where samba, psychedelic rock, and radio jingles collide to smuggle political defiance past the censors as pure noise and color.',
  },
  {
    id: 'twin-peaks',
    title: 'Twin Peaks',
    creator: 'David Lynch & Mark Frost',
    medium: 'tv',
    year: 1990,
    decade: '1990s',
    country: 'United States',
    language: 'English',
    movement: 'American surrealism',
    genre: 'Mystery drama',
    style: ['Surrealism', 'Soap opera pastiche', 'Dream logic'],
    themes: ['Small-town secrets', 'Duality', 'Grief'],
    mood: ['Uncanny', 'Melancholic'],
    context: 'Broadcast on network television at the height of the prime-time soap, it imported art-house surrealism into a murder-mystery format American audiences thought they already understood.',
    description: 'A small logging town’s homecoming-queen murder unravels into red rooms, backwards-talking dwarves, and the quiet suggestion that evil is a place, not just a person.',
  },
  {
    id: 'grande-sertao-veredas',
    title: 'Grande Sertão: Veredas',
    creator: 'João Guimarães Rosa',
    medium: 'literature',
    year: 1956,
    decade: '1950s',
    country: 'Brazil',
    language: 'Portuguese',
    movement: 'Brazilian modernism (third phase)',
    genre: 'Novel',
    style: ['Invented vocabulary', 'Stream of consciousness', 'Oral storytelling'],
    themes: ['Good and evil', 'Memory', 'The sertão as cosmos'],
    mood: ['Hypnotic', 'Meditative'],
    context: 'Set among the jagunço outlaw-bands of Brazil’s arid interior, it reinvents Portuguese prose with neologisms and regional speech to make an entire landscape think out loud.',
    description: 'An aging former outlaw retells his life to an unseen listener in a single unbroken monologue, questioning across six hundred pages whether the devil exists — or whether he made a pact with him.',
  },
  {
    id: 'lacerda-favela-series',
    title: 'Série sobre as favelas cariocas',
    creator: 'Maureen Bisilliat',
    medium: 'photography',
    year: 1975,
    decade: '1970s',
    country: 'Brazil',
    language: 'Portuguese',
    movement: 'Brazilian documentary photography',
    genre: 'Social documentary',
    style: ['Black and white', 'Observational', 'Portraiture'],
    themes: ['Urban inequality', 'Everyday dignity', 'Migration'],
    mood: ['Intimate', 'Somber'],
    context: 'Working alongside Rio’s hillside communities during a period of rapid, unequal urbanization, this body of work documents daily life without the sensationalism typical of favela photojournalism at the time.',
    description: 'Quiet, dignified black-and-white portraits of hillside communities that refuse the era’s appetite for spectacle, insisting on ordinary life as the real subject.',
  },
  {
    id: 'oiticica-parangoles',
    title: 'Parangólés',
    creator: 'Hélio Oiticica',
    medium: 'visual-arts',
    year: 1964,
    decade: '1960s',
    country: 'Brazil',
    language: 'Portuguese',
    movement: 'Neoconcretismo / Tropicália',
    genre: 'Wearable sculpture',
    style: ['Participatory art', 'Color-field', 'Performance'],
    themes: ['Bodily experience', 'Favela culture', 'Art as event'],
    mood: ['Ecstatic', 'Liberated'],
    context: 'Developed through Oiticica’s time with samba dancers of Mangueira, these wearable cape-sculptures moved Brazilian art off the wall and onto moving bodies in the street.',
    description: 'Layered fabric capes meant to be danced in, not hung on a wall — color and structure that only become the artwork once a body sets them in motion.',
  },
  // ... continue populating with ~65-70 more works following this exact shape,
  // covering all six mediums, drawing heavily on Brazilian works (film, MPB/Tropicalia/bossa
  // nova/samba/funk/Brazilian rock, literature, photography, visual arts, telenovelas/TV)
  // alongside international works (world cinema, international literature and music movements,
  // photography, visual arts movements, international TV), spanning periods from the early
  // 20th century through the 2020s.
];
```

Populate `js/data.js` to 70-80 total entries. Distribute roughly evenly across the six mediums (aim for 10-15 each), with heavy Brazilian representation (aim for roughly a third of the collection) alongside international works across multiple countries, decades, and movements — this diversity is what makes the connections engine in Task 7 interesting.

- [ ] **Step 4: Run the tests and verify they pass**

```bash
npm test
```

Expected: PASS — all `data.test.js` assertions pass, including the >= 70 count, medium coverage, and Brazilian-representation checks.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/resonance
git add -A
git commit -m "Add curated works dataset with schema validation"
```

---

## Task 4: Procedural cover-art generator

**Files:**
- Create: `resonance/test/artwork.test.js`
- Create: `resonance/js/artwork.js`

**Interfaces:**
- Consumes: a work-like object with at least `{ id: string, title: string, medium: string }` (any object from `js/data.js`'s `works` array satisfies this).
- Produces: `generateArtworkSVG(work, size = 240) -> string` exported from `js/artwork.js` — a self-contained `<svg>...</svg>` markup string, deterministic per `work.id`. Consumed by `render.js` in Tasks 6, 8, and 9 wherever a work's cover needs to be displayed.

- [ ] **Step 1: Write the failing tests**

Create `test/artwork.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateArtworkSVG } from '../js/artwork.js';

const work = { id: 'cidade-de-deus', title: 'Cidade de Deus', medium: 'film' };

test('generateArtworkSVG is deterministic for the same work id', () => {
  assert.equal(generateArtworkSVG(work), generateArtworkSVG(work));
});

test('generateArtworkSVG produces different output for a different id', () => {
  const other = { ...work, id: 'ilha-das-flores' };
  assert.notEqual(generateArtworkSVG(work), generateArtworkSVG(other));
});

test('generateArtworkSVG returns a well-formed svg root with the requested viewBox', () => {
  const svg = generateArtworkSVG(work, 200);
  assert.match(svg, /^<svg viewBox="0 0 200 200"/);
  assert.match(svg, /<\/svg>$/);
});

test('generateArtworkSVG escapes the title in the aria-label', () => {
  const svg = generateArtworkSVG({ ...work, title: 'A & B' });
  assert.match(svg, /aria-label="A &amp; B"/);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../js/artwork.js'`.

- [ ] **Step 3: Implement `js/artwork.js`**

```js
function hashString(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = ['var(--wine)', 'var(--blue)', 'var(--rust)', 'var(--teal)'];
const MEDIUM_SHAPE = {
  film: 'rect',
  tv: 'rect',
  music: 'circle',
  literature: 'line',
  photography: 'circle',
  'visual-arts': 'polygon',
};

function escapeAttr(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function generateArtworkSVG(work, size = 240) {
  const random = mulberry32(hashString(work.id));
  const shapeKind = MEDIUM_SHAPE[work.medium] || 'circle';
  const layerCount = 4 + Math.floor(random() * 4);
  const layers = [];

  for (let i = 0; i < layerCount; i++) {
    const color = PALETTE[Math.floor(random() * PALETTE.length)];
    const cx = Math.round(random() * size);
    const cy = Math.round(random() * size);
    const r = Math.round(20 + random() * (size / 3));
    const opacity = (0.25 + random() * 0.5).toFixed(2);

    if (shapeKind === 'circle') {
      layers.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${opacity}" />`);
    } else if (shapeKind === 'rect') {
      const w = r * 1.6;
      const h = r;
      layers.push(`<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}" opacity="${opacity}" />`);
    } else if (shapeKind === 'line') {
      const x2 = Math.round(random() * size);
      const y2 = Math.round(random() * size);
      layers.push(`<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${(2 + random() * 4).toFixed(1)}" opacity="${opacity}" />`);
    } else {
      const points = Array.from({ length: 3 }, () => `${Math.round(random() * size)},${Math.round(random() * size)}`).join(' ');
      layers.push(`<polygon points="${points}" fill="${color}" opacity="${opacity}" />`);
    }
  }

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeAttr(work.title)}">` +
    `<rect width="${size}" height="${size}" fill="var(--bg)" />` +
    layers.join('') +
    `</svg>`;
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
npm test
```

Expected: PASS — all 4 `artwork.test.js` tests pass, plus every prior test file still passes.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/resonance
git add -A
git commit -m "Add deterministic procedural cover-art generator"
```

---

## Task 5: Filtering engine

**Files:**
- Create: `resonance/test/filters.test.js`
- Create: `resonance/js/filters.js`

**Interfaces:**
- Consumes: an array of work-like objects (the shape defined in Task 3).
- Produces: `extractFacets(works) -> Record<string, string[]>` (unique sorted values per facet key) and `filterWorks(works, filters, searchText = '') -> works[]`, both exported from `js/filters.js`. Consumed by `render.js`'s `renderExplore` in Task 6.

- [ ] **Step 1: Write the failing tests**

Create `test/filters.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFacets, filterWorks } from '../js/filters.js';

const sample = [
  { id: 'a', title: 'Black Orpheus', creator: 'Marcel Camus', medium: 'film', decade: '1950s', country: 'Brazil', movement: 'Cinema Novo precursor', genre: 'Drama', style: ['Location shooting'], themes: ['Myth', 'Love'], mood: ['Vibrant'], language: 'Portuguese' },
  { id: 'b', title: 'Tropicalia', creator: 'Various', medium: 'music', decade: '1960s', country: 'Brazil', movement: 'Tropicalia', genre: 'Psychedelic', style: ['Collage'], themes: ['Identity', 'Modernity'], mood: ['Playful'], language: 'Portuguese' },
  { id: 'c', title: 'Seven Samurai', creator: 'Akira Kurosawa', medium: 'film', decade: '1950s', country: 'Japan', movement: 'Golden Age Japanese cinema', genre: 'Drama', style: ['Ensemble'], themes: ['Honor', 'Sacrifice'], mood: ['Epic'], language: 'Japanese' },
];

test('extractFacets collects unique sorted values per facet', () => {
  const facets = extractFacets(sample);
  assert.deepEqual(facets.medium, ['film', 'music']);
  assert.deepEqual(facets.country, ['Brazil', 'Japan']);
});

test('filterWorks: a single facet filters by OR within the category', () => {
  const result = filterWorks(sample, { country: ['Brazil'] });
  assert.deepEqual(result.map((w) => w.id).sort(), ['a', 'b']);
});

test('filterWorks: multiple facets combine with AND across categories', () => {
  const result = filterWorks(sample, { medium: ['film'], country: ['Japan'] });
  assert.deepEqual(result.map((w) => w.id), ['c']);
});

test('filterWorks: array-valued facet (themes) matches if any selected value is present', () => {
  const result = filterWorks(sample, { themes: ['Myth'] });
  assert.deepEqual(result.map((w) => w.id), ['a']);
});

test('filterWorks: search text matches title or creator, case-insensitively', () => {
  const result = filterWorks(sample, {}, 'kurosawa');
  assert.deepEqual(result.map((w) => w.id), ['c']);
});

test('filterWorks: no filters or search returns everything', () => {
  assert.equal(filterWorks(sample, {}, '').length, 3);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../js/filters.js'`.

- [ ] **Step 3: Implement `js/filters.js`**

```js
const FACET_KEYS = ['medium', 'decade', 'country', 'movement', 'genre', 'style', 'themes', 'mood', 'language'];

export function extractFacets(works) {
  const facets = {};
  for (const key of FACET_KEYS) {
    const values = new Set();
    for (const work of works) {
      const raw = work[key];
      if (Array.isArray(raw)) raw.forEach((v) => values.add(v));
      else if (raw) values.add(raw);
    }
    facets[key] = [...values].sort();
  }
  return facets;
}

export function filterWorks(works, filters, searchText = '') {
  const activeFacets = Object.entries(filters || {}).filter(([, values]) => values && values.length);
  const needle = searchText.trim().toLowerCase();

  return works.filter((work) => {
    for (const [key, selected] of activeFacets) {
      const raw = work[key];
      const workValues = Array.isArray(raw) ? raw : [raw];
      if (!selected.some((v) => workValues.includes(v))) return false;
    }
    if (needle) {
      const haystack = `${work.title} ${work.creator}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
npm test
```

Expected: PASS — all 6 `filters.test.js` tests pass, plus every prior test file still passes.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/resonance
git add -A
git commit -m "Add faceted filtering engine"
```

---

## Task 6: Explore view — filter panel and card grid

**Files:**
- Modify: `resonance/js/render.js` — replace the `explore` stub with `renderExplore`
- Modify: `resonance/css/style.css` — add filter-panel, chip, and card-grid styles
- Modify: `resonance/js/main.js` — display a live work count in the header

**Interfaces:**
- Consumes: `works` from `./data.js`, `extractFacets`/`filterWorks` from `./filters.js`, `generateArtworkSVG` from `./artwork.js`, `buildHash` from `./router.js`.
- Produces: nothing new consumed by later tasks (this view is a leaf), but establishes the `.work-card` DOM shape reused visually (not programmatically) by Tasks 8 and 9's connection cards.

- [ ] **Step 1: Implement `renderExplore` in `js/render.js`**

Add these imports to the top of `js/render.js`:

```js
import { works } from './data.js';
import { extractFacets, filterWorks } from './filters.js';
import { generateArtworkSVG } from './artwork.js';
import { buildHash } from './router.js';
```

Add this constant near the top of the file:

```js
const FACET_LABELS = {
  medium: 'Medium', decade: 'Period', country: 'Country', movement: 'Movement',
  genre: 'Genre', style: 'Style', themes: 'Theme', mood: 'Mood', language: 'Language',
};
```

Replace the `case 'explore':` line in `renderView`'s switch with:

```js
    case 'explore':
      renderExplore(mount, query);
      break;
```

Add the `renderExplore` function (and its private helper) below `renderView`:

```js
function renderExplore(mount, query = {}) {
  const facets = extractFacets(works);
  const activeFilters = { ...query };
  delete activeFilters.q;
  const searchText = (query.q && query.q[0]) || '';
  const results = filterWorks(works, activeFilters, searchText);

  mount.innerHTML = `
    <section class="view view--explore">
      <div class="section-label tag reveal">[ EXPLORE THE ARCHIVE ]</div>
      <div class="explore__layout">
        <aside class="filter-panel reveal">
          <input class="filter-panel__search" type="search" placeholder="Search by title or creator…" value="${escapeHtml(searchText)}" />
          ${Object.entries(facets).map(([key, values]) => `
            <div class="filter-group">
              <div class="filter-group__label tag">${FACET_LABELS[key] || key}</div>
              <div class="filter-group__chips">
                ${values.map((value) => `
                  <button type="button" class="chip ${activeFilters[key] && activeFilters[key].includes(value) ? 'is-active' : ''}" data-facet="${key}" data-value="${escapeHtml(value)}">${escapeHtml(value)}</button>
                `).join('')}
              </div>
            </div>
          `).join('')}
          ${Object.keys(activeFilters).length || searchText ? '<button type="button" class="filter-panel__clear tag">[ CLEAR ALL ]</button>' : ''}
        </aside>
        <div class="explore__results">
          <div class="explore__count tag">${results.length} WORK${results.length === 1 ? '' : 'S'}</div>
          <div class="card-grid">
            ${results.map((work) => `
              <a class="work-card reveal" href="${buildHash('work', { id: work.id })}">
                <div class="work-card__art">${generateArtworkSVG(work, 200)}</div>
                <div class="work-card__meta">
                  <span class="tag work-card__medium">${work.medium}</span>
                  <h3 class="work-card__title">${escapeHtml(work.title)}</h3>
                  <span class="work-card__creator">${escapeHtml(work.creator)} — ${work.year}</span>
                </div>
              </a>
            `).join('')}
          </div>
        </div>
      </div>
    </section>
  `;

  wireExploreEvents(mount, activeFilters, searchText);
}

function wireExploreEvents(mount, activeFilters, searchText) {
  mount.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const facet = chip.dataset.facet;
      const value = chip.dataset.value;
      const next = { ...activeFilters };
      const current = new Set(next[facet] || []);
      current.has(value) ? current.delete(value) : current.add(value);
      next[facet] = [...current];
      if (searchText) next.q = [searchText];
      window.location.hash = buildHash('explore', {}, next);
    });
  });

  const searchInput = mount.querySelector('.filter-panel__search');
  if (searchInput) {
    searchInput.addEventListener('change', () => {
      const next = { ...activeFilters };
      if (searchInput.value.trim()) next.q = [searchInput.value.trim()];
      else delete next.q;
      window.location.hash = buildHash('explore', {}, next);
    });
  }

  const clearBtn = mount.querySelector('.filter-panel__clear');
  if (clearBtn) clearBtn.addEventListener('click', () => { window.location.hash = buildHash('explore'); });
}
```

- [ ] **Step 2: Add explore styles to `css/style.css`**

```css
/* ===== Explore view ===== */
.explore__layout { display: grid; grid-template-columns: 1fr; gap: 32px; }
@media (min-width: 900px) { .explore__layout { grid-template-columns: 260px 1fr; align-items: start; } }

.filter-panel {
  display: flex; flex-direction: column; gap: 22px;
  border: 1px solid var(--line); padding: 18px; position: sticky; top: 100px;
}
.filter-panel__search {
  font-family: var(--f-body); font-size: 15px; padding: 8px 10px;
  background: transparent; border: 1px solid var(--line); color: var(--ink); border-radius: 4px;
}
.filter-group__label { display: block; margin-bottom: 8px; }
.filter-group__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  font-family: var(--f-mono); font-size: 11px; letter-spacing: 0.03em;
  padding: 5px 10px; border-radius: 999px; border: 1px solid var(--line);
  background: transparent; color: var(--ink-soft); cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}
.chip:hover { border-color: var(--wine); color: var(--ink); }
.chip.is-active { background: var(--wine); border-color: var(--wine); color: var(--bg); }
.filter-panel__clear {
  align-self: flex-start; background: none; border: none; padding: 0; cursor: pointer; color: var(--wine);
}

.explore__count { display: block; margin-bottom: 16px; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }

.work-card {
  display: block; text-decoration: none; color: inherit;
  border: 1px solid var(--line); overflow: hidden; transition: border-color 0.25s ease, transform 0.25s ease;
}
.work-card:hover { border-color: var(--wine); transform: translateY(-3px); }
.work-card__art { line-height: 0; }
.work-card__art svg { width: 100%; height: auto; display: block; }
.work-card__meta { padding: 12px; display: flex; flex-direction: column; gap: 4px; }
.work-card__medium { text-transform: uppercase; }
.work-card__title { font-family: var(--f-display); font-size: 1rem; font-weight: 600; margin: 0; line-height: 1.3; }
.work-card__creator { font-size: 13px; color: var(--ink-soft); }
```

- [ ] **Step 3: Show a live work count in the header**

In `js/main.js`, add this import at the top:

```js
import { works } from './data.js';
```

Replace the body of `handleRouteChange` to also update the header count — the full function becomes:

```js
function handleRouteChange() {
  const { view, params, query } = parseRoute(window.location.hash);
  const mount = document.getElementById('app');
  renderView(mount, view, params, query);
  observeReveals(mount);
  const countEl = document.getElementById('workCount');
  if (countEl) countEl.textContent = `[ ${works.length} WORKS ]`;
}
```

- [ ] **Step 4: Verify manually in the browser**

Reload and navigate to `http://localhost:8000/#/explore`. Confirm: the header now shows the real work count; the filter panel lists chips for every facet with real values from the dataset; clicking chips updates the URL hash and the grid live, with multiple chips in the same category behaving as OR and chips across categories behaving as AND; the search box filters by title/creator on change; "[ CLEAR ALL ]" appears only when filters/search are active and resets the view; every card shows a distinct procedural artwork.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/resonance
git add -A
git commit -m "Build the Explore view: faceted filters and card grid"
```

---

## Task 7: Connections / similarity engine

**Files:**
- Create: `resonance/test/similarity.test.js`
- Create: `resonance/js/similarity.js`

**Interfaces:**
- Consumes: work-like objects (Task 3's schema).
- Produces: `computeConnections(work, allWorks, { limit = 6, minScore = 1 } = {}) -> Array<{ work, score: number, reasons: string[] }>` and `pickUnexpectedConnection(sourceWork, connections) -> { work, score, reasons } | null`, both exported from `js/similarity.js`. Consumed by `render.js`'s `renderWorkDetail` (Task 8) and `renderSurprise` (Task 9).

- [ ] **Step 1: Write the failing tests**

Create `test/similarity.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeConnections, pickUnexpectedConnection } from '../js/similarity.js';

const cinemaNovo = { id: 'a', title: 'A', medium: 'film', year: 1964, country: 'Brazil', movement: 'Cinema Novo', genre: 'Drama', themes: ['Poverty', 'Hunger'], mood: ['Stark'] };
const cinemaNovoSibling = { id: 'b', title: 'B', medium: 'film', year: 1963, country: 'Brazil', movement: 'Cinema Novo', genre: 'Drama', themes: ['Poverty', 'Land'], mood: ['Stark'] };
const unrelated = { id: 'c', title: 'C', medium: 'music', year: 1998, country: 'Japan', movement: 'City Pop', genre: 'Pop', themes: ['Nightlife'], mood: ['Euphoric'] };
const sameEraDifferentEverything = { id: 'd', title: 'D', medium: 'photography', year: 1965, country: 'USA', movement: 'Documentary photography', genre: 'Documentary', themes: ['Displacement'], mood: ['Somber'] };

test('computeConnections ranks a strong shared-movement match highest', () => {
  const results = computeConnections(cinemaNovo, [cinemaNovoSibling, unrelated, sameEraDifferentEverything]);
  assert.equal(results[0].work.id, 'b');
  assert.ok(results[0].reasons.some((r) => r.includes('Cinema Novo')));
});

test('computeConnections excludes the work itself even if present in the candidate list', () => {
  const results = computeConnections(cinemaNovo, [cinemaNovo, cinemaNovoSibling]);
  assert.ok(!results.some((r) => r.work.id === 'a'));
});

test('computeConnections excludes works below the minimum score threshold', () => {
  const results = computeConnections(cinemaNovo, [unrelated], { minScore: 1 });
  assert.deepEqual(results, []);
});

test('computeConnections still surfaces a weak period-only connection above threshold', () => {
  const results = computeConnections(cinemaNovo, [sameEraDifferentEverything], { minScore: 1 });
  assert.equal(results.length, 1);
  assert.ok(results[0].reasons.some((r) => r.includes('era')));
});

test('computeConnections respects the limit option', () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ ...cinemaNovoSibling, id: `sib-${i}` }));
  const results = computeConnections(cinemaNovo, many, { limit: 3 });
  assert.equal(results.length, 3);
});

test('pickUnexpectedConnection prefers a cross-medium match over a same-medium one', () => {
  const source = { id: 'x', medium: 'film' };
  const sameMedium = { work: { id: 'y', medium: 'film' }, score: 5, reasons: ['same movement: X'] };
  const crossMedium = { work: { id: 'z', medium: 'music' }, score: 2, reasons: ['shared theme: memory'] };
  const result = pickUnexpectedConnection(source, [sameMedium, crossMedium]);
  assert.equal(result.work.id, 'z');
});

test('pickUnexpectedConnection falls back to the same-medium pool when nothing crosses mediums', () => {
  const source = { id: 'x', medium: 'film' };
  const onlySameMedium = { work: { id: 'y', medium: 'film' }, score: 5, reasons: ['same movement: X'] };
  const result = pickUnexpectedConnection(source, [onlySameMedium]);
  assert.equal(result.work.id, 'y');
});

test('pickUnexpectedConnection returns null when there are no connections', () => {
  assert.equal(pickUnexpectedConnection({ id: 'x', medium: 'film' }, []), null);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../js/similarity.js'`.

- [ ] **Step 3: Implement `js/similarity.js`**

```js
const WEIGHTS = { movement: 5, genre: 2, theme: 1.5, mood: 1, country: 1, creator: 4 };
const PERIOD_WEIGHT = 2;
const PERIOD_DECAY_YEARS = 10;

function sharedValues(a = [], b = []) {
  const setB = new Set(b);
  return a.filter((v) => setB.has(v));
}

function scorePair(work, other) {
  let score = 0;
  const reasons = [];

  if (work.movement && work.movement === other.movement) {
    score += WEIGHTS.movement;
    reasons.push(`same movement: ${work.movement}`);
  }
  if (work.genre && work.genre === other.genre) {
    score += WEIGHTS.genre;
    reasons.push(`same genre: ${work.genre}`);
  }
  if (work.creator && work.creator === other.creator) {
    score += WEIGHTS.creator;
    reasons.push(`same creator: ${work.creator}`);
  }
  if (work.country && work.country === other.country) {
    score += WEIGHTS.country;
    reasons.push(`same country: ${work.country}`);
  }

  const sharedThemes = sharedValues(work.themes, other.themes);
  if (sharedThemes.length) {
    score += sharedThemes.length * WEIGHTS.theme;
    reasons.push(`shared theme${sharedThemes.length > 1 ? 's' : ''}: ${sharedThemes.join(', ')}`);
  }

  const sharedMoods = sharedValues(work.mood, other.mood);
  if (sharedMoods.length) {
    score += sharedMoods.length * WEIGHTS.mood;
    reasons.push(`shared mood: ${sharedMoods.join(', ')}`);
  }

  if (typeof work.year === 'number' && typeof other.year === 'number') {
    const yearsApart = Math.abs(work.year - other.year);
    const periodScore = Math.max(0, PERIOD_WEIGHT - yearsApart / PERIOD_DECAY_YEARS);
    if (periodScore > 0) {
      score += periodScore;
      if (yearsApart <= 5) reasons.push(`same era: both from around ${work.year}`);
    }
  }

  return { score, reasons };
}

export function computeConnections(work, allWorks, { limit = 6, minScore = 1 } = {}) {
  return allWorks
    .filter((other) => other.id !== work.id)
    .map((other) => {
      const { score, reasons } = scorePair(work, other);
      return { work: other, score, reasons };
    })
    .filter((connection) => connection.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function pickUnexpectedConnection(sourceWork, connections) {
  if (!connections.length) return null;
  const crossMedium = connections.filter((c) => c.work.medium !== sourceWork.medium);
  const pool = crossMedium.length ? crossMedium : connections;
  return [...pool].sort((a, b) => a.reasons.length - b.reasons.length || b.score - a.score)[0];
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
npm test
```

Expected: PASS — all 8 `similarity.test.js` tests pass, plus every prior test file still passes.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/resonance
git add -A
git commit -m "Add weighted connections engine with human-readable reasons"
```

---

## Task 8: Work detail view and constellation diagram

**Files:**
- Modify: `resonance/js/render.js` — replace the `work` stub with `renderWorkDetail`
- Modify: `resonance/css/style.css` — add detail-layout, connection-card, and constellation styles

**Interfaces:**
- Consumes: `computeConnections` from `./similarity.js`; `works`, `generateArtworkSVG`, `buildHash`, `escapeHtml` already imported/defined in `render.js`.
- Produces: nothing new consumed by later tasks (leaf view).

- [ ] **Step 1: Implement `renderWorkDetail` in `js/render.js`**

Add this import to the top of `js/render.js`:

```js
import { computeConnections } from './similarity.js';
```

Replace the `case 'work':` line in `renderView`'s switch with:

```js
    case 'work':
      renderWorkDetail(mount, params.id);
      break;
```

Add the `renderWorkDetail` function and its `renderConstellation` helper below `renderExplore`:

```js
function renderWorkDetail(mount, id) {
  const work = works.find((w) => w.id === id);
  if (!work) {
    mount.innerHTML = `
      <section class="view">
        <p class="tag">[ WORK NOT FOUND ]</p>
        <a class="pill" href="${buildHash('explore')}">BACK TO ARCHIVE</a>
      </section>`;
    return;
  }

  const connections = computeConnections(work, works, { limit: 6 });

  mount.innerHTML = `
    <section class="view view--detail">
      <a class="tag detail__back" href="${buildHash('explore')}">[ ← BACK TO ARCHIVE ]</a>
      <div class="detail__layout reveal">
        <div class="detail__art">${generateArtworkSVG(work, 420)}</div>
        <div class="detail__info">
          <span class="tag work-card__medium">${work.medium} — ${work.year} — ${escapeHtml(work.country)}</span>
          <h1 class="detail__title">${escapeHtml(work.title)}</h1>
          <p class="detail__creator">${escapeHtml(work.creator)}</p>
          <p class="detail__description">${escapeHtml(work.description)}</p>
          <p class="detail__context"><em>${escapeHtml(work.context)}</em></p>
          <div class="detail__facts">
            ${['movement', 'genre', 'language'].map((key) => work[key] ? `<span class="tag fact">${FACET_LABELS[key]}: ${escapeHtml(work[key])}</span>` : '').join('')}
          </div>
        </div>
      </div>

      ${connections.length ? `
        <div class="section-label tag reveal">[ CONNECTIONS ]</div>
        <div class="constellation-wrap reveal">${renderConstellation(connections)}</div>
        <div class="connections-grid">
          ${connections.map((c) => `
            <a class="connection-card reveal" href="${buildHash('work', { id: c.work.id })}">
              <div class="connection-card__art">${generateArtworkSVG(c.work, 100)}</div>
              <div>
                <span class="tag work-card__medium">${c.work.medium}</span>
                <h4>${escapeHtml(c.work.title)}</h4>
                <p class="connection-card__reason">${c.reasons.join(' · ')}</p>
              </div>
            </a>
          `).join('')}
        </div>
      ` : ''}
    </section>
  `;
}

function renderConstellation(connections) {
  const size = 400;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const nodes = connections.map((c, i) => {
    const angle = (i / connections.length) * Math.PI * 2 - Math.PI / 2;
    return { id: c.work.id, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  });

  const lines = nodes.map((n) => `<line class="constellation-line" x1="${cx}" y1="${cy}" x2="${n.x.toFixed(1)}" y2="${n.y.toFixed(1)}" />`).join('');
  const points = nodes.map((n) => `
    <a href="${buildHash('work', { id: n.id })}">
      <circle class="constellation-node" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="8" />
    </a>
  `).join('');

  return `<svg viewBox="0 0 ${size} ${size}" class="constellation">
    ${lines}
    <circle class="constellation-hub" cx="${cx}" cy="${cy}" r="12" />
    ${points}
  </svg>`;
}
```

- [ ] **Step 2: Add detail and constellation styles to `css/style.css`**

```css
/* ===== Work detail view ===== */
.detail__back { display: inline-block; margin-bottom: 24px; text-decoration: none; }
.detail__layout { display: grid; grid-template-columns: 1fr; gap: 32px; margin-bottom: 60px; }
@media (min-width: 800px) { .detail__layout { grid-template-columns: 380px 1fr; } }
.detail__art svg { width: 100%; height: auto; display: block; border: 1px solid var(--line); }
.detail__info { display: flex; flex-direction: column; gap: 14px; }
.detail__title { font-family: var(--f-display); font-size: clamp(1.8rem, 3vw + 1rem, 2.6rem); margin: 0; line-height: 1.1; }
.detail__creator { font-family: var(--f-mono); font-size: 14px; color: var(--ink-soft); margin: 0; }
.detail__description { font-size: 1.15rem; line-height: 1.6; margin: 0; }
.detail__context { color: var(--ink-soft); margin: 0; }
.detail__facts { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
.fact { border-left: 2px solid var(--wine); padding-left: 10px; }

.constellation-wrap { max-width: 420px; margin: 0 auto 32px; }
.constellation { width: 100%; height: auto; display: block; }
.constellation-line {
  stroke: var(--ink-faint); stroke-width: 1;
  stroke-dasharray: 400; stroke-dashoffset: 400; transition: stroke-dashoffset 1.2s ease;
}
.constellation-wrap.is-visible .constellation-line,
.reveal.is-visible .constellation-line { stroke-dashoffset: 0; }
.constellation-hub { fill: var(--wine); }
.constellation-node {
  fill: var(--bg); stroke: var(--ink); stroke-width: 1.4; cursor: pointer;
  transition: fill 0.2s ease, r 0.2s ease;
}
.constellation-node:hover { fill: var(--wine); r: 10; }
@media (prefers-reduced-motion: reduce) { .constellation-line { stroke-dashoffset: 0; transition: none; } }

.connections-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.connection-card {
  display: flex; gap: 12px; align-items: center; text-decoration: none; color: inherit;
  border: 1px solid var(--line); padding: 10px; transition: border-color 0.2s ease;
}
.connection-card:hover { border-color: var(--wine); }
.connection-card__art { width: 60px; height: 60px; flex-shrink: 0; line-height: 0; }
.connection-card__art svg { width: 100%; height: 100%; display: block; }
.connection-card h4 { font-family: var(--f-display); font-size: 0.95rem; margin: 2px 0; }
.connection-card__reason { font-size: 12px; color: var(--ink-soft); margin: 0; }
```

- [ ] **Step 3: Verify manually in the browser**

From `#/explore`, click a work card. Confirm: full metadata, description, and context render; a constellation diagram appears with lines drawing themselves in from a central hub to surrounding nodes; hovering a node highlights it; clicking a constellation node or a connection card navigates to that work's own detail page, whose connections list is different and plausible (shared movement/theme/mood reasons make sense); visiting a work with no strong connections (if any) hides the connections section cleanly instead of showing an empty grid.

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/resonance
git add -A
git commit -m "Build the work detail view with a connections constellation"
```

---

## Task 9: Surprise Me view

**Files:**
- Modify: `resonance/js/render.js` — replace the `surprise` stub with `renderSurprise`
- Modify: `resonance/css/style.css` — add surprise-view styles

**Interfaces:**
- Consumes: `computeConnections`, `pickUnexpectedConnection` from `./similarity.js`; `works`, `generateArtworkSVG`, `buildHash`, `escapeHtml`, `observeReveals` (imported fresh here since `render.js` needs it for the reroll path — `import { observeReveals } from './reveal.js';`).
- Produces: nothing new consumed by later tasks (leaf view).

- [ ] **Step 1: Implement `renderSurprise` in `js/render.js`**

Add this import to the top of `js/render.js`:

```js
import { pickUnexpectedConnection } from './similarity.js';
import { observeReveals } from './reveal.js';
```

Replace the `case 'surprise':` line in `renderView`'s switch with:

```js
    case 'surprise':
      renderSurprise(mount);
      break;
```

Add the `renderSurprise` function below `renderWorkDetail`:

```js
function renderSurprise(mount) {
  const work = works[Math.floor(Math.random() * works.length)];
  const connections = computeConnections(work, works, { limit: 8, minScore: 0.5 });
  const hook = pickUnexpectedConnection(work, connections);

  mount.innerHTML = `
    <section class="view view--surprise">
      <div class="section-label tag reveal">[ SERENDIPITY ]</div>
      <div class="surprise__stage reveal">
        <div class="surprise__art">${generateArtworkSVG(work, 320)}</div>
        <div class="surprise__info">
          <span class="tag work-card__medium">${work.medium} — ${work.year}</span>
          <h1 class="detail__title">${escapeHtml(work.title)}</h1>
          <p class="detail__creator">${escapeHtml(work.creator)} — ${escapeHtml(work.country)}</p>
          <p class="detail__description">${escapeHtml(work.description)}</p>
          ${hook ? `
            <div class="surprise__hook">
              <p class="tag">[ UNEXPECTED DISCOVERY ]</p>
              <a class="connection-card connection-card--hook" href="${buildHash('work', { id: hook.work.id })}">
                <div class="connection-card__art">${generateArtworkSVG(hook.work, 100)}</div>
                <div>
                  <span class="tag work-card__medium">${hook.work.medium}</span>
                  <h4>${escapeHtml(hook.work.title)}</h4>
                  <p class="connection-card__reason">${hook.reasons.join(' · ')}</p>
                </div>
              </a>
            </div>
          ` : ''}
          <div class="surprise__actions">
            <a class="pill" href="${buildHash('work', { id: work.id })}">SEE FULL ENTRY</a>
            <button type="button" class="pill" id="rerollBtn">ANOTHER DISCOVERY</button>
          </div>
        </div>
      </div>
    </section>
  `;

  const reroll = mount.querySelector('#rerollBtn');
  if (reroll) reroll.addEventListener('click', () => {
    renderSurprise(mount);
    observeReveals(mount);
  });
}
```

- [ ] **Step 2: Add surprise-view styles to `css/style.css`**

```css
/* ===== Surprise Me view ===== */
.surprise__stage { display: grid; grid-template-columns: 1fr; gap: 32px; }
@media (min-width: 800px) { .surprise__stage { grid-template-columns: 320px 1fr; } }
.surprise__art svg { width: 100%; height: auto; display: block; border: 1px solid var(--line); }
.surprise__info { display: flex; flex-direction: column; gap: 14px; }
.surprise__hook { margin-top: 8px; }
.surprise__hook > .tag { display: block; margin-bottom: 8px; }
.connection-card--hook { border-color: var(--wine); }
.surprise__actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 10px; }
#rerollBtn { font-family: var(--f-mono); }
```

- [ ] **Step 3: Verify manually in the browser**

Navigate to `http://localhost:8000/#/surprise` several times (reload) and click "ANOTHER DISCOVERY" repeatedly. Confirm: a different work appears each time; the "unexpected discovery" hook is usually a different medium from the featured work and its reason text makes sense; "SEE FULL ENTRY" navigates to that work's detail page; the reroll button updates content in place without a hash change or full reload.

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/resonance
git add -A
git commit -m "Build the Surprise Me view with unexpected-connection hook"
```

---

## Task 10: Home view

**Files:**
- Modify: `resonance/js/render.js` — replace the `home` (default) stub with `renderHome`
- Modify: `resonance/css/style.css` — add hero styles

**Interfaces:**
- Consumes: `works`, `buildHash` (already imported in `render.js`).
- Produces: nothing new consumed by later tasks (leaf view / app entry point).

- [ ] **Step 1: Implement `renderHome` in `js/render.js`**

Replace the `default:` line in `renderView`'s switch with:

```js
    default:
      renderHome(mount);
```

Add the `renderHome` function below `renderSurprise`:

```js
function renderHome(mount) {
  mount.innerHTML = `
    <section class="view view--home hero">
      <div class="hero__index tag reveal">[ 00 / ARCHIVE ]</div>
      <h1 class="hero__title reveal">EVERY WORK<br><em>REMEMBERS ANOTHER.</em></h1>
      <p class="hero__sub reveal">
        RESONANCE is an artistic memory archive — ${works.length} works of music, film, television,
        literature, photography, and visual art from Brazil and around the world, connected not by
        genre but by the ideas, moods, and moments they share. Explore by parameter, or let the
        archive surprise you.
      </p>
      <div class="hero__actions reveal">
        <a class="pill" href="${buildHash('explore')}">EXPLORE THE ARCHIVE</a>
        <a class="pill" href="${buildHash('surprise')}">SURPRISE ME</a>
      </div>
    </section>
  `;
}
```

- [ ] **Step 2: Add hero styles to `css/style.css`**

```css
/* ===== Home / hero ===== */
.hero { padding-top: 60px; min-height: 60vh; display: flex; flex-direction: column; justify-content: center; }
.hero__index { display: block; margin-bottom: 18px; }
.hero__title {
  font-family: var(--f-display); font-weight: 700; font-size: clamp(1.85rem, 6vw, 4.2rem);
  line-height: 0.98; letter-spacing: -0.01em; margin: 0 0 28px; max-width: 17ch;
}
.hero__title em { font-style: normal; color: var(--wine); }
.hero__sub { max-width: 56ch; font-size: 1.1rem; color: var(--ink-soft); margin: 0 0 32px; }
.hero__actions { display: flex; gap: 14px; flex-wrap: wrap; }
```

- [ ] **Step 3: Verify manually in the browser**

Reload `http://localhost:8000/`. Confirm: the hero shows the real work count in its subtitle, the title and subtitle reveal in on load, and both "EXPLORE THE ARCHIVE" and "SURPRISE ME" pills navigate correctly. Click the RESONANCE brand mark in the header from any other view — confirm it returns here.

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/resonance
git add -A
git commit -m "Build the home view"
```

---

## Task 11: Responsive polish, README, and final pass

**Files:**
- Modify: `resonance/css/style.css` — mobile adjustments
- Create: `resonance/README.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed elsewhere — this is the final task.

- [ ] **Step 1: Add mobile adjustments to `css/style.css`**

```css
/* ===== Mobile adjustments ===== */
@media (max-width: 899px) {
  .filter-panel { position: static; }
  .card-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
  .detail__layout { gap: 20px; }
  .hero__actions .pill { flex: 1 1 auto; text-align: center; }
}
```

- [ ] **Step 2: Write `README.md`**

```markdown
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
- `js/data.js` — the curated dataset (~75 works) as a plain array.
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
```

- [ ] **Step 3: Full manual pass**

Resize the browser down to a narrow mobile width and re-check all four views (home, explore with filter panel, work detail, surprise). Confirm the filter panel stacks above the grid, cards remain legible, and no horizontal scrollbar appears. Run `npm test` one final time to confirm the full suite is green.

```bash
npm test
```

Expected: PASS — every test file (`router`, `data`, `artwork`, `filters`, `similarity`) passes.

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/resonance
git add -A
git commit -m "Polish responsive layout and add README"
```

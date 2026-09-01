import { observeReveals } from './reveal.js';
import { parseRoute } from './router.js';
import { renderView } from './render.js';

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

function handleRouteChange() {
  const { view, params, query } = parseRoute(window.location.hash);
  const mount = document.getElementById('app');
  renderView(mount, view, params, query);
  observeReveals(mount);
}

window.addEventListener('hashchange', handleRouteChange);
handleRouteChange();

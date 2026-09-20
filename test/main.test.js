import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, click, navigate } from './helpers/dom.mjs';

installDom();

const { works } = await import('../js/data.js');
await import('../js/main.js');

test('the app renders the home view on load', () => {
  assert.ok(document.querySelector('.view--home'), 'expected the home view to render on initial load');
});

test('the work count in the header reflects the dataset size', () => {
  assert.equal(document.getElementById('workCount').textContent, `[ ${works.length} WORKS ]`);
});

test('navigating via location.hash re-renders the app', () => {
  navigate('#/explore');
  assert.ok(document.querySelector('.view--explore'), 'expected the explore view to render after a hash change');
});

test('theme toggle flips data-theme, aria-pressed, and persists to localStorage', () => {
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  assert.equal(root.getAttribute('data-theme'), 'dark', 'the page boots in dark mode by default');

  click(toggle);
  assert.equal(root.getAttribute('data-theme'), 'light');
  assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(localStorage.getItem('theme'), 'light');

  click(toggle);
  assert.equal(root.getAttribute('data-theme'), 'dark');
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  assert.equal(localStorage.getItem('theme'), 'dark');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.mjs';

installDom();

const { observeReveals } = await import('../js/reveal.js');

test('without IntersectionObserver support, every .reveal element is marked visible immediately', () => {
  document.body.innerHTML = '<div id="root"><p class="reveal"></p><p class="reveal"></p></div>';
  const root = document.getElementById('root');
  assert.ok(!('IntersectionObserver' in window), 'this test assumes jsdom has no IntersectionObserver');

  observeReveals(root);

  const revealed = [...root.querySelectorAll('.reveal')];
  assert.equal(revealed.length, 2);
  assert.ok(revealed.every((el) => el.classList.contains('is-visible')));
});

test('respects prefers-reduced-motion by revealing immediately too', () => {
  document.body.innerHTML = '<div id="root2"><p class="reveal"></p></div>';
  const original = window.matchMedia;
  window.matchMedia = (query) => ({ matches: query.includes('prefers-reduced-motion'), media: query, addEventListener() {}, removeEventListener() {} });

  observeReveals(document.getElementById('root2'));

  assert.ok(document.querySelector('#root2 .reveal').classList.contains('is-visible'));
  window.matchMedia = original;
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, click, change } from './helpers/dom.mjs';

installDom();

const { renderView } = await import('../js/render.js');
const { parseRoute } = await import('../js/router.js');
const { works } = await import('../js/data.js');

function renderRoute(mount, hash) {
  window.location.hash = hash;
  const { view, params, query } = parseRoute(window.location.hash);
  renderView(mount, view, params, query);
  return mount;
}

function freshMount() {
  const mount = document.getElementById('app');
  mount.innerHTML = '';
  return mount;
}

test('home view renders the hero with links to explore and surprise', () => {
  const mount = freshMount();
  renderRoute(mount, '#/');
  const links = [...mount.querySelectorAll('.hero__actions a')].map((a) => a.getAttribute('href'));
  assert.deepEqual(links, ['#/explore', '#/surprise']);
});

test('explore defaults to the film tab and excludes Movement from the facet panel', () => {
  const mount = freshMount();
  renderRoute(mount, '#/explore');
  assert.equal(mount.querySelector('.medium-tab.is-active').dataset.tab, 'film');
  const facetLabels = [...mount.querySelectorAll('.filter-group__label')].map((el) => el.textContent);
  assert.ok(!facetLabels.includes('Movement'), 'Movement must not appear as an Explore facet for film');
  assert.ok(facetLabels.includes('Country'), 'Country should still be a facet for film');
  assert.equal(mount.querySelectorAll('.work-card').length, works.length, 'all works are film today, so the film tab shows everything');
});

test('switching to a medium with no data shows the coming-soon empty state, not the filter panel', () => {
  const mount = freshMount();
  renderRoute(mount, '#/explore');
  click(mount.querySelector('.medium-tab[data-tab="music"]'));
  assert.equal(window.location.hash, '#/explore?medium=music');
  renderRoute(mount, window.location.hash);
  assert.equal(mount.querySelector('.medium-tab.is-active').dataset.tab, 'music');
  assert.match(mount.querySelector('.explore__empty').textContent, /MUSIC.*COMING SOON/);
  assert.equal(mount.querySelector('.filter-panel'), null);
});

test('clicking a country chip filters results and marks the chip active', () => {
  const mount = freshMount();
  renderRoute(mount, '#/explore');
  const brazilChip = [...mount.querySelectorAll('.chip[data-facet="country"]')].find((c) => c.dataset.value === 'Brazil');
  assert.ok(brazilChip, 'expected a Brazil chip in the country facet');
  click(brazilChip);
  assert.match(window.location.hash, /country=Brazil/);
  assert.match(window.location.hash, /medium=film/);
  renderRoute(mount, window.location.hash);
  const activeChip = [...mount.querySelectorAll('.chip[data-facet="country"]')].find((c) => c.dataset.value === 'Brazil');
  assert.ok(activeChip.classList.contains('is-active'));
  const expectedCount = works.filter((w) => w.country === 'Brazil').length;
  assert.equal(mount.querySelectorAll('.work-card').length, expectedCount);
});

test('searching filters by title or creator', () => {
  const mount = freshMount();
  renderRoute(mount, '#/explore');
  const target = works[0];
  const needle = target.creator.split(' ')[0].toLowerCase();
  const searchInput = mount.querySelector('.filter-panel__search');
  searchInput.value = needle;
  change(searchInput);
  assert.match(window.location.hash, new RegExp(`q=${needle}`));
  renderRoute(mount, window.location.hash);
  const cardHrefs = [...mount.querySelectorAll('.work-card')].map((a) => a.getAttribute('href'));
  assert.ok(cardHrefs.length > 0, `expected at least one work matching "${needle}"`);
  assert.ok(cardHrefs.some((href) => href.includes(target.id)), 'the work the search term came from must be among the results');
});

test('clear all resets facet filters and search but keeps the active medium tab', () => {
  const mount = freshMount();
  renderRoute(mount, '#/explore?medium=film&country=Brazil&q=test');
  const clearBtn = mount.querySelector('.filter-panel__clear');
  assert.ok(clearBtn, 'Clear All should be visible when a filter is active');
  click(clearBtn);
  assert.equal(window.location.hash, '#/explore?medium=film');
  renderRoute(mount, window.location.hash);
  assert.equal(mount.querySelector('.medium-tab.is-active').dataset.tab, 'film');
  assert.equal(mount.querySelector('.filter-panel__clear'), null);
});

test('the mobile filter sheet opens and closes', () => {
  const mount = freshMount();
  renderRoute(mount, '#/explore');
  assert.ok(!mount.querySelector('.filter-panel').classList.contains('is-open'));

  click(mount.querySelector('#filterTrigger'));
  assert.ok(mount.querySelector('.filter-panel').classList.contains('is-open'));
  assert.ok(mount.querySelector('.filter-backdrop').classList.contains('is-open'));
  assert.equal(document.body.style.overflow, 'hidden');

  click(mount.querySelector('#filterClose'));
  assert.ok(!mount.querySelector('.filter-panel').classList.contains('is-open'));
  assert.equal(document.body.style.overflow, '');
});

test('the filter sheet stays open across a filter selection instead of closing on every click', () => {
  const mount = freshMount();
  renderRoute(mount, '#/explore');
  click(mount.querySelector('#filterTrigger'));
  assert.ok(mount.querySelector('.filter-panel').classList.contains('is-open'));

  const chip = mount.querySelector('.chip[data-facet="country"]');
  click(chip);
  renderRoute(mount, window.location.hash);

  assert.ok(mount.querySelector('.filter-panel').classList.contains('is-open'), 'sheet must stay open after selecting a filter');

  click(mount.querySelector('#filterClose'));
  assert.ok(!mount.querySelector('.filter-panel').classList.contains('is-open'));
});

test('the filter panel keeps its scroll position across a re-render triggered by a filter click', () => {
  const mount = freshMount();
  renderRoute(mount, '#/explore');
  const panel = mount.querySelector('.filter-panel');
  panel.scrollTop = 120;

  const chip = mount.querySelector('.chip[data-facet="country"]');
  click(chip);
  renderRoute(mount, window.location.hash);

  assert.equal(mount.querySelector('.filter-panel').scrollTop, 120);
});

test('work detail renders the selected work and its facts', () => {
  const mount = freshMount();
  const work = works[0];
  renderRoute(mount, `#/work/${work.id}`);
  assert.equal(mount.querySelector('.detail__title').textContent, work.title);
  assert.match(mount.querySelector('.detail__creator').textContent, new RegExp(work.creator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('an unknown work id shows a not-found state instead of throwing', () => {
  const mount = freshMount();
  renderRoute(mount, '#/work/does-not-exist');
  assert.match(mount.querySelector('.tag').textContent, /WORK NOT FOUND/);
});

test('back to archive returns to the exact explore state the user came from, not a reset', () => {
  const mount = freshMount();
  renderRoute(mount, '#/explore?medium=film&country=Brazil');
  const work = works.find((w) => w.country === 'Brazil');
  assert.ok(work, 'expected at least one Brazilian work to link into');
  renderRoute(mount, `#/work/${work.id}`);

  click(mount.querySelector('#detailBack'));
  assert.equal(window.location.hash, '#/explore?medium=film&country=Brazil');
});

test('surprise renders a random work with a working reroll button', () => {
  const mount = freshMount();
  renderRoute(mount, '#/surprise');
  assert.ok(mount.querySelector('.surprise__stage'));
  assert.ok(mount.querySelector('.detail__title').textContent.length > 0);

  const reroll = mount.querySelector('#rerollBtn');
  click(reroll);
  assert.ok(mount.querySelector('.surprise__stage'), 'rerolling must not throw and must re-render the stage');
});

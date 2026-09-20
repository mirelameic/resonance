import { works } from './data.js';
import { extractFacets, filterWorks, MEDIUM_TABS, tabForMedium } from './filters.js';
import { buildHash } from './router.js';
import { computeConnections, pickUnexpectedConnection } from './similarity.js';
import { observeReveals } from './reveal.js';

const FACET_LABELS = {
  medium: 'Medium', decade: 'Period', country: 'Country', movement: 'Movement',
  genre: 'Genre', style: 'Style', themes: 'Theme', mood: 'Mood', language: 'Language',
};

export function renderView(mount, view, params, query) {
  switch (view) {
    case 'explore':
      renderExplore(mount, query);
      break;
    case 'work':
      renderWorkDetail(mount, params.id);
      break;
    case 'surprise':
      renderSurprise(mount);
      break;
    default:
      renderHome(mount);
  }
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderWorkArt(work) {
  if (work.image) {
    const credit = work.imageCredit
      ? `<span class="work-art__credit tag">${escapeHtml(work.imageCredit)}</span>`
      : '';
    return `<img class="work-art__image" src="${escapeHtml(work.image)}" alt="${escapeHtml(work.title)}" loading="lazy">${credit}`;
  }
  return `
    <div class="work-art__fallback">
      <span class="work-art__fallback-title">${escapeHtml(work.title)}</span>
      <span class="tag work-art__fallback-medium">${escapeHtml(work.medium)}</span>
    </div>
  `;
}

function renderExplore(mount, query = {}) {
  const requestedMedium = query.medium && query.medium[0];
  const activeTab = requestedMedium ? tabForMedium(requestedMedium) : MEDIUM_TABS[0];
  const worksInTab = filterWorks(works, { medium: activeTab.mediums });

  const tabsMarkup = `
    <div class="medium-tabs reveal" role="tablist">
      ${MEDIUM_TABS.map((tab) => `
        <button type="button" class="medium-tab ${tab.id === activeTab.id ? 'is-active' : ''}" data-tab="${tab.id}">${escapeHtml(tab.label)}</button>
      `).join('')}
    </div>
  `;

  if (worksInTab.length === 0) {
    mount.innerHTML = `
      <section class="view view--explore">
        <div class="section-label tag reveal">[ EXPLORE THE ARCHIVE ]</div>
        ${tabsMarkup}
        <div class="explore__empty tag reveal">[ ${escapeHtml(activeTab.label.toUpperCase())} — COMING SOON ]</div>
      </section>
    `;
    wireExploreEvents(mount, {}, '', activeTab.mediums);
    return;
  }

  const facets = extractFacets(worksInTab, activeTab.id);
  const activeFilters = { ...query };
  delete activeFilters.q;
  delete activeFilters.medium;
  const searchText = (query.q && query.q[0]) || '';
  const results = filterWorks(worksInTab, activeFilters, searchText);

  mount.innerHTML = `
    <section class="view view--explore">
      <div class="section-label tag reveal">[ EXPLORE THE ARCHIVE ]</div>
      ${tabsMarkup}
      <div class="explore__layout">
        <aside class="filter-panel reveal">
          <input class="filter-panel__search" type="search" placeholder="Search by title or creator…" value="${escapeHtml(searchText)}" />
          ${Object.entries(facets).filter(([key]) => key !== 'medium').map(([key, values]) => `
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
                <div class="work-card__art">${renderWorkArt(work)}</div>
                <div class="work-card__meta">
                  <span class="tag work-card__medium">${escapeHtml(work.medium)}</span>
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

  wireExploreEvents(mount, activeFilters, searchText, activeTab.mediums);
}

function wireExploreEvents(mount, activeFilters, searchText, tabMedium) {
  mount.querySelectorAll('.medium-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = MEDIUM_TABS.find((t) => t.id === btn.dataset.tab);
      window.location.hash = buildHash('explore', {}, { medium: tab.mediums });
    });
  });

  mount.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const facet = chip.dataset.facet;
      const value = chip.dataset.value;
      const next = { ...activeFilters, medium: tabMedium };
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
      const next = { ...activeFilters, medium: tabMedium };
      if (searchInput.value.trim()) next.q = [searchInput.value.trim()];
      else delete next.q;
      window.location.hash = buildHash('explore', {}, next);
    });
  }

  const clearBtn = mount.querySelector('.filter-panel__clear');
  if (clearBtn) clearBtn.addEventListener('click', () => { window.location.hash = buildHash('explore', {}, { medium: tabMedium }); });
}

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
        <div class="detail__art">${renderWorkArt(work)}</div>
        <div class="detail__info">
          <span class="tag work-card__medium">${escapeHtml(work.medium)} — ${work.year} — ${escapeHtml(work.country)}</span>
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
              <div class="connection-card__art">${renderWorkArt(c.work)}</div>
              <div>
                <span class="tag work-card__medium">${escapeHtml(c.work.medium)}</span>
                <h4>${escapeHtml(c.work.title)}</h4>
                <p class="connection-card__reason">${escapeHtml(c.reasons.join(' · '))}</p>
              </div>
            </a>
          `).join('')}
        </div>
      ` : ''}
    </section>
  `;
}

function renderSurprise(mount) {
  const work = works[Math.floor(Math.random() * works.length)];
  const connections = computeConnections(work, works, { limit: 8, minScore: 0.5 });
  const hook = pickUnexpectedConnection(work, connections);

  mount.innerHTML = `
    <section class="view view--surprise">
      <div class="section-label tag reveal">[ SERENDIPITY ]</div>
      <div class="surprise__stage reveal">
        <div class="surprise__art">${renderWorkArt(work)}</div>
        <div class="surprise__info">
          <span class="tag work-card__medium">${escapeHtml(work.medium)} — ${work.year}</span>
          <h1 class="detail__title">${escapeHtml(work.title)}</h1>
          <p class="detail__creator">${escapeHtml(work.creator)} — ${escapeHtml(work.country)}</p>
          <p class="detail__description">${escapeHtml(work.description)}</p>
          ${hook ? `
            <div class="surprise__hook">
              <p class="tag">[ UNEXPECTED DISCOVERY ]</p>
              <a class="connection-card connection-card--hook" href="${buildHash('work', { id: hook.work.id })}">
                <div class="connection-card__art">${renderWorkArt(hook.work)}</div>
                <div>
                  <span class="tag work-card__medium">${escapeHtml(hook.work.medium)}</span>
                  <h4>${escapeHtml(hook.work.title)}</h4>
                  <p class="connection-card__reason">${escapeHtml(hook.reasons.join(' · '))}</p>
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

function renderHome(mount) {
  mount.innerHTML = `
    <section class="view view--home hero">
      <div class="hero__rings" aria-hidden="true">
        <svg class="hero__ring hero__ring--a" viewBox="0 0 400 400"><circle cx="200" cy="200" r="180"/></svg>
        <svg class="hero__ring hero__ring--b" viewBox="0 0 400 400"><circle cx="200" cy="200" r="135"/></svg>
        <svg class="hero__ring hero__ring--c" viewBox="0 0 400 400"><circle cx="200" cy="200" r="95"/></svg>
      </div>
      <div class="hero__index tag reveal">[ 00 / ARCHIVE ]</div>
      <h1 class="hero__title reveal"><span class="hero__title-highlight">EVERY PIECE<br>ECHOES ANOTHER.</span></h1>
      <p class="hero__sub reveal">
        RESONANCE is an artistic memory archive — ${works.length} works from around the
        world (film today, with music, literature, and visual art joining gradually),
        connected not by genre but by the ideas, moods, and moments they share. Explore
        by parameter, or let the archive surprise you.
      </p>
      <div class="hero__actions reveal">
        <a class="pill" href="${buildHash('explore')}">EXPLORE THE ARCHIVE</a>
        <a class="pill" href="${buildHash('surprise')}">SURPRISE ME</a>
      </div>
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

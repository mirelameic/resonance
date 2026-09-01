import { works } from './data.js';
import { extractFacets, filterWorks } from './filters.js';
import { generateArtworkSVG } from './artwork.js';
import { buildHash } from './router.js';
import { computeConnections } from './similarity.js';

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
      mount.innerHTML = `<section class="view"><p class="tag">[ SURPRISE ME — COMING SOON ]</p></section>`;
      break;
    default:
      mount.innerHTML = `<section class="view"><p class="tag">[ HOME — COMING SOON ]</p></section>`;
  }
}

export function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

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

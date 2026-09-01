import { works } from './data.js';
import { extractFacets, filterWorks } from './filters.js';
import { generateArtworkSVG } from './artwork.js';
import { buildHash } from './router.js';

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

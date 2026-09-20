const FACET_KEYS = ['medium', 'decade', 'country', 'movement', 'genre', 'style', 'themes', 'mood', 'language'];

const FACET_EXCLUSIONS_BY_MEDIUM = {
  film: ['movement'],
};

export const MEDIUM_TABS = [
  { id: 'film', label: 'Film', mediums: ['film'] },
  { id: 'music', label: 'Music', mediums: ['music'] },
  { id: 'literature', label: 'Literature', mediums: ['literature'] },
  { id: 'visual-arts', label: 'Visual Arts', mediums: ['visual-arts', 'photography'] },
];

export function tabForMedium(medium) {
  return MEDIUM_TABS.find((tab) => tab.mediums.includes(medium)) || MEDIUM_TABS[0];
}

export function extractFacets(works, tabId) {
  const excluded = new Set(FACET_EXCLUSIONS_BY_MEDIUM[tabId] || []);
  const facets = {};
  for (const key of FACET_KEYS) {
    if (excluded.has(key)) continue;
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

export function sortByYearDescending(works) {
  return [...works].sort((a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity));
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

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

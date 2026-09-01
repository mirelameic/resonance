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

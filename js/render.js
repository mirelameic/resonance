export function renderView(mount, view, params, query) {
  switch (view) {
    case 'explore':
      mount.innerHTML = `<section class="view"><p class="tag">[ EXPLORE — COMING SOON ]</p></section>`;
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

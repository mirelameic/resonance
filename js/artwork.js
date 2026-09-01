function hashString(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = ['var(--wine)', 'var(--blue)', 'var(--rust)', 'var(--teal)'];
const MEDIUM_SHAPE = {
  film: 'rect',
  tv: 'rect',
  music: 'circle',
  literature: 'line',
  photography: 'circle',
  'visual-arts': 'polygon',
};

function escapeAttr(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function generateArtworkSVG(work, size = 240) {
  const random = mulberry32(hashString(work.id));
  const shapeKind = MEDIUM_SHAPE[work.medium] || 'circle';
  const layerCount = 4 + Math.floor(random() * 4);
  const layers = [];

  for (let i = 0; i < layerCount; i++) {
    const color = PALETTE[Math.floor(random() * PALETTE.length)];
    const cx = Math.round(random() * size);
    const cy = Math.round(random() * size);
    const r = Math.round(20 + random() * (size / 3));
    const opacity = (0.25 + random() * 0.5).toFixed(2);

    if (shapeKind === 'circle') {
      layers.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${opacity}" />`);
    } else if (shapeKind === 'rect') {
      const w = r * 1.6;
      const h = r;
      layers.push(`<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}" opacity="${opacity}" />`);
    } else if (shapeKind === 'line') {
      const x2 = Math.round(random() * size);
      const y2 = Math.round(random() * size);
      layers.push(`<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${(2 + random() * 4).toFixed(1)}" opacity="${opacity}" />`);
    } else {
      const points = Array.from({ length: 3 }, () => `${Math.round(random() * size)},${Math.round(random() * size)}`).join(' ');
      layers.push(`<polygon points="${points}" fill="${color}" opacity="${opacity}" />`);
    }
  }

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeAttr(work.title)}">` +
    `<rect width="${size}" height="${size}" fill="var(--bg)" />` +
    layers.join('') +
    `</svg>`;
}

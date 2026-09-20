const EXCLUDED_KEYWORDS = [
  'pornographic', 'pornography', 'porn', 'erotic', 'eroticism',
  'sexploitation', 'fetish', 'hardcore', 'hentai',
];

function containsExcludedKeyword(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return EXCLUDED_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export function isExcludedContent(work) {
  const fields = [
    work.genre,
    work.movement,
    work.description,
    work.context,
    ...(Array.isArray(work.style) ? work.style : []),
    ...(Array.isArray(work.themes) ? work.themes : []),
  ];
  return fields.some(containsExcludedKeyword);
}

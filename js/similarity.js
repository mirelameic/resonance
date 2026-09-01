const WEIGHTS = { movement: 5, genre: 2, theme: 1.5, mood: 1, country: 1, creator: 4 };
const PERIOD_WEIGHT = 2;
const PERIOD_DECAY_YEARS = 10;

function sharedValues(a = [], b = []) {
  const setB = new Set(b);
  return a.filter((v) => setB.has(v));
}

function scorePair(work, other) {
  let score = 0;
  const reasons = [];

  if (work.movement && work.movement === other.movement) {
    score += WEIGHTS.movement;
    reasons.push(`same movement: ${work.movement}`);
  }
  if (work.genre && work.genre === other.genre) {
    score += WEIGHTS.genre;
    reasons.push(`same genre: ${work.genre}`);
  }
  if (work.creator && work.creator === other.creator) {
    score += WEIGHTS.creator;
    reasons.push(`same creator: ${work.creator}`);
  }
  if (work.country && work.country === other.country) {
    score += WEIGHTS.country;
    reasons.push(`same country: ${work.country}`);
  }

  const sharedThemes = sharedValues(work.themes, other.themes);
  if (sharedThemes.length) {
    score += sharedThemes.length * WEIGHTS.theme;
    reasons.push(`shared theme${sharedThemes.length > 1 ? 's' : ''}: ${sharedThemes.join(', ')}`);
  }

  const sharedMoods = sharedValues(work.mood, other.mood);
  if (sharedMoods.length) {
    score += sharedMoods.length * WEIGHTS.mood;
    reasons.push(`shared mood: ${sharedMoods.join(', ')}`);
  }

  if (typeof work.year === 'number' && typeof other.year === 'number') {
    const yearsApart = Math.abs(work.year - other.year);
    const periodScore = Math.max(0, PERIOD_WEIGHT - yearsApart / PERIOD_DECAY_YEARS);
    if (periodScore > 0) {
      score += periodScore;
      if (yearsApart <= 5) reasons.push(`same era: both from around ${work.year}`);
    }
  }

  return { score, reasons };
}

export function computeConnections(work, allWorks, { limit = 6, minScore = 1 } = {}) {
  return allWorks
    .filter((other) => other.id !== work.id)
    .map((other) => {
      const { score, reasons } = scorePair(work, other);
      return { work: other, score, reasons };
    })
    .filter((connection) => connection.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function pickUnexpectedConnection(sourceWork, connections) {
  if (!connections.length) return null;
  const crossMedium = connections.filter((c) => c.work.medium !== sourceWork.medium);
  const pool = crossMedium.length ? crossMedium : connections;
  return [...pool].sort((a, b) => a.reasons.length - b.reasons.length || b.score - a.score)[0];
}

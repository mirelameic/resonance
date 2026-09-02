import { sourceKey } from './mergeWorks.mjs';

export function applyEnrichment(work, enrichmentMap) {
  const overlay = enrichmentMap[sourceKey(work)];
  if (!overlay) return work;
  return { ...work, ...overlay };
}

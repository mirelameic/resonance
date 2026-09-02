export function sourceKey(work) {
  return `${work.source.type}:${work.source.sourceId}`;
}

export function mergeWorks(existingWorks, freshWorks) {
  const bySourceKey = new Map();
  for (const work of existingWorks) {
    bySourceKey.set(sourceKey(work), work);
  }
  for (const work of freshWorks) {
    bySourceKey.set(sourceKey(work), work);
  }
  return [...bySourceKey.values()];
}

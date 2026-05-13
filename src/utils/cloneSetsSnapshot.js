export function cloneSetsSnapshot(sets = []) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(sets);
  }

  return sets.map((set) => ({ ...set }));
}

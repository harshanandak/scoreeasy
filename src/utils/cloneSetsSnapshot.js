export function cloneSetsSnapshot(sets = []) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(sets);
  }

  return deepClone(sets);
}

function deepClone(value) {
  if (Array.isArray(value)) {
    return value.map(deepClone);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, deepClone(nestedValue)]),
    );
  }

  return value;
}

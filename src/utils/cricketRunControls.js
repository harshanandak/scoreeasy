export const CRICKET_RUN_VALUES = [0, 1, 2, 3, 4, 5, 6];

export function isCricketRunKey(key) {
  if (typeof key !== 'string' || key.length !== 1) return false;
  return CRICKET_RUN_VALUES.includes(Number.parseInt(key, 10));
}

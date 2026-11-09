// Tracks local saves that failed and have not been followed by a successful save of the same
// key. While one is outstanding, the newest score may exist only in memory, so nothing may
// reload the page on its own and no screen may promise "your scores are saved".
//
// Module state on purpose: it is per tab and per page load, which is exactly the lifetime of
// the in-memory state it describes. storage.js sets and clears it; nothing else needs to.
const failingKeys = new Set();

export function markSaveFailed(key) {
  failingKeys.add(key);
}

export function markSaveOk(key) {
  failingKeys.delete(key);
}

export function hasOutstandingSaveFailure() {
  return failingKeys.size > 0;
}

export function resetSaveHealth() {
  failingKeys.clear();
}

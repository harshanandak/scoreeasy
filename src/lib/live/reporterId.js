// Stable, anonymous reporter id for the signed-out moderation report path (q7k).
// Persisted in localStorage so the backend can dedup repeat reports from the same
// browser (one reporter counts once toward the auto-hold threshold). It is NOT an
// identity — just a spoofable client token; the server treats it as untrusted.

import { loadData, saveData } from '../../utils/storage';

const REPORTER_KEY = 'se_reporter_id';

/** Get (or lazily create + persist) this browser's anonymous reporter id. */
export function getReporterId() {
  const existing = loadData(REPORTER_KEY, null);
  if (typeof existing === 'string' && existing) return existing;
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `r_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  saveData(REPORTER_KEY, id);
  return id;
}

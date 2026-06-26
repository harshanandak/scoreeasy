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
  const id = newReporterId();
  saveData(REPORTER_KEY, id);
  return id;
}

// Generate the id from the Web Crypto CSPRNG only — never Math.random (S2245).
// This isn't a security boundary (the server treats reporterId as untrusted), but
// a CSPRNG avoids the lint flag and gives collision-free ids for free.
function newReporterId() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const bytes = c.getRandomValues(new Uint8Array(16));
    return `r_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
  }
  // No Web Crypto at all (only legacy/non-secure contexts, which can't run the
  // app anyway): a non-cryptographic, collision-tolerant id — still no Math.random.
  return `r_${Date.now().toString(36)}${(globalThis.performance?.now?.() ?? 0).toString(36).replace('.', '')}`;
}

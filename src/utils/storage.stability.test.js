import { describe, it, expect, vi, afterEach } from 'vitest';

// Stability audit 2026-10-21 (docs/plans/2026-10-21-stability-audit.md).
// `it.fails` encodes the correct behaviour and fails on master today; flip it to
// `it` in the fix PR.

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  globalThis.localStorage.clear();
});

describe('storage — stability audit 2026-10-21', () => {
  // SA-02 (P0): storage.js probes localStorage ONCE at import with a test write.
  // When the device is already at quota that write throws, the module flips to an
  // in-memory store for the whole session, and every READ also goes to memory —
  // so an in-progress match already saved on the device becomes invisible (the
  // browser sweep reloaded a scored volleyball match straight to the setup screen).
  // Fix PR: "fix(storage): quota at boot must not hide saved data".
  it.fails('SA-02 a full-but-readable localStorage still returns saved data', async () => {
    globalThis.localStorage.setItem('se_quickmatch_draft_volleyball', JSON.stringify({ phase: 'scoring' }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    vi.resetModules();
    const { loadData } = await import('./storage.js');
    expect(loadData('se_quickmatch_draft_volleyball', null)).toEqual({ phase: 'scoring' });
  });
});

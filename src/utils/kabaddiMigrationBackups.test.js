import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isKabaddiMigrationBackup, kabaddiMigrationBackupKey, migrateLegacyKabaddiBackups } from './kabaddiMigrationBackups';

const ctx = vi.hoisted(() => ({ data: new Map(), fail: false }));
vi.mock('./storage', () => ({
  listDataKeys: () => [...ctx.data.keys()],
  loadData: key => ctx.data.get(key) ?? null,
  saveData: (key, value) => { if (ctx.fail) return false; ctx.data.set(key, structuredClone(value)); return true; },
  clearData: key => ctx.data.delete(key),
}));
const draftKey = 'se_quickmatch_draft_kabaddi_game';
const oldKey = `${draftKey}_before_kabaddi_v2`;
const original = { phase: 'scoring', quickMatchId: 'game', kabaddi: { state: { version: 1 } } };

beforeEach(() => { ctx.data.clear(); ctx.fail = false; ctx.data.set(oldKey, original); });

describe('kabaddi migration backup relocation', () => {
  it('copies the original outside the draft namespace before removing the old key', () => {
    const key = kabaddiMigrationBackupKey(draftKey);
    migrateLegacyKabaddiBackups();
    expect(key.startsWith('se_quickmatch_draft_')).toBe(false);
    expect(ctx.data.get(key)).toEqual(original);
    expect(ctx.data.has(oldKey)).toBe(false);
    migrateLegacyKabaddiBackups();
    expect(ctx.data.get(key)).toEqual(original);
  });

  it('retains and identifies the old backup when the new copy cannot be saved', () => {
    ctx.fail = true;
    migrateLegacyKabaddiBackups();
    expect(ctx.data.get(oldKey)).toEqual(original);
    expect(ctx.data.has(kabaddiMigrationBackupKey(draftKey))).toBe(false);
    expect(isKabaddiMigrationBackup(oldKey)).toBe(true);
  });

  it('preserves both originals when an existing destination has different data', () => {
    const existing = { ...original, quickMatchId: 'other-original' };
    ctx.data.set(kabaddiMigrationBackupKey(draftKey), existing);
    migrateLegacyKabaddiBackups();
    expect(ctx.data.get(oldKey)).toEqual(original);
    expect(ctx.data.get(kabaddiMigrationBackupKey(draftKey))).toEqual(existing);
  });
});

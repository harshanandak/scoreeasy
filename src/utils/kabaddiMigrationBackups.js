import { clearData, listDataKeys, loadData, saveData } from './storage';
import { QUICK_MATCH_DRAFT_PREFIX } from './quickMatchDrafts';

const PREFIX = 'se_kabaddi_backup_';
const SUFFIX = '_before_kabaddi_v2';
const isLegacyBackup = key => typeof key === 'string' && key.startsWith(`${QUICK_MATCH_DRAFT_PREFIX}kabaddi_`) && key.endsWith(SUFFIX);

export const isKabaddiMigrationBackup = key => typeof key === 'string' && (key.startsWith(PREFIX) || isLegacyBackup(key));
export const kabaddiMigrationBackupKey = draftKey => `${PREFIX}${draftKey.slice(QUICK_MATCH_DRAFT_PREFIX.length)}${SUFFIX}`;

/** Copy and confirm the original before removing a backup from the old draft namespace. */
export function migrateLegacyKabaddiBackups() {
  for (const oldKey of listDataKeys().filter(isLegacyBackup)) {
    const original = loadData(oldKey);
    if (!original) continue;
    const key = kabaddiMigrationBackupKey(oldKey.slice(0, -SUFFIX.length));
    const existing = loadData(key);
    if (!existing && !saveData(key, original)) continue;
    if (JSON.stringify(loadData(key)) === JSON.stringify(original)) clearData(oldKey);
  }
}

import { loadQuickMatches, saveData, saveQuickMatches } from './storage';
import { loadHistory } from './universalStorage';
import { createHistoryRecovery } from './historyRecovery';

// Namespacing keeps an older-history ID distinct from the same quick-match ID.
const wrap = (source, records) => records.map(record => ({ id: `${source}:${record.id}`, source, record }));
const loadMatches = () => [...wrap('quick', loadQuickMatches()), ...wrap('older', loadHistory())];

function saveMatches(matches) {
  const previousQuick = loadQuickMatches();
  const previousOlder = loadHistory();
  const quick = matches.filter(match => match.source === 'quick').map(match => match.record);
  const older = matches.filter(match => match.source === 'older').map(match => match.record);
  const quickChanged = JSON.stringify(quick) !== JSON.stringify(previousQuick);
  const olderChanged = JSON.stringify(older) !== JSON.stringify(previousOlder);
  if (quickChanged && !saveQuickMatches(quick)) return false;
  if (olderChanged && !saveData('gs_history', older)) {
    if (quickChanged && !saveQuickMatches(previousQuick)) {
      console.warn('[ScoreEasy] Could not roll back quick history after an older-history write failed.');
      return 'rollback-failed';
    }
    return false;
  }
  return true;
}

const recovery = createHistoryRecovery('se_matches_pending_undo', {
  loadMatches,
  saveMatches,
  isRemovable: (match, kind) => match.source === 'quick' ? match.record.status === 'completed' : kind === 'clear',
  keepFailedOperations: true,
  clearPreviousOnClear: true,
});

export const removeMatchHistory = (id, kind) => recovery.remove(
  kind === 'clear' ? loadMatches() : wrap('quick', [{ id }]), kind,
);
export const restoreMatchHistory = recovery.restore;

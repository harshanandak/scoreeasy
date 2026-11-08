import { clearData, loadData, loadQuickMatches, saveData, saveQuickMatches } from './storage';

const RECOVERY_KEY = 'se_stats_pending_undo';

export const loadQuickStatsRecovery = () => loadData(RECOVERY_KEY);

export function removeQuickStats(matches, kind) {
  const current = loadQuickMatches();
  const ids = new Set(matches.map(match => String(match.id)));
  const removed = current.flatMap((match, index) => (
    match.status === 'completed' && ids.has(String(match.id)) ? [{ match, index }] : []
  ));
  if (!removed.length) return null;

  const previous = loadQuickStatsRecovery();
  const recovery = { kind, removed, order: current.map(match => String(match.id)) };
  // Persist recovery before deletion so navigation or a refresh cannot strand it.
  if (!saveData(RECOVERY_KEY, recovery)) return null;
  const removedIds = new Set(removed.map(({ match }) => String(match.id)));
  if (!saveQuickMatches(current.filter(match => !removedIds.has(String(match.id))))) {
    if (previous) saveData(RECOVERY_KEY, previous);
    else clearData(RECOVERY_KEY);
    return null;
  }
  return recovery;
}

export function restoreQuickStats() {
  const recovery = loadQuickStatsRecovery();
  if (!recovery) return false;
  const current = loadQuickMatches();
  const ids = new Set(current.map(match => String(match.id)));
  for (const { match, index } of recovery.removed) {
    if (ids.has(String(match.id))) continue;
    const nextIds = new Set(recovery.order.slice(index + 1));
    const next = current.findIndex(item => nextIds.has(String(item.id)));
    const previousIds = new Set(recovery.order.slice(0, index));
    const previous = current.findLastIndex(item => previousIds.has(String(item.id)));
    const position = next >= 0 ? next : previous >= 0 ? previous + 1 : Math.min(index, current.length);
    current.splice(position, 0, match);
    ids.add(String(match.id));
  }
  if (!saveQuickMatches(current)) return false;
  clearData(RECOVERY_KEY);
  return true;
}

import { loadData, loadQuickMatches, saveData, saveQuickMatches } from './storage';
import { generateId } from '../models/types';

const RECOVERY_KEY = 'se_stats_pending_undo';
const MAX_OPERATIONS = 5;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function prune(operations) {
  const now = Date.now();
  return (Array.isArray(operations) ? operations : []).filter(operation => (
    typeof operation?.id === 'string' &&
    ['delete', 'clear'].includes(operation.kind) &&
    Number.isFinite(operation.createdAt) && operation.createdAt <= now &&
    now - operation.createdAt < MAX_AGE_MS &&
    Array.isArray(operation.items) && Array.isArray(operation.order)
  )).slice(-MAX_OPERATIONS);
}

const writeRecoveries = operations => saveData(RECOVERY_KEY, prune(operations));

export function loadQuickStatsRecoveries() {
  const stored = loadData(RECOVERY_KEY, []);
  const operations = prune(stored);
  if (JSON.stringify(stored) !== JSON.stringify(operations)) writeRecoveries(operations);
  return operations;
}

export const loadQuickStatsRecovery = () => loadQuickStatsRecoveries().at(-1) || null;
export const clearQuickStatsRecovery = () => writeRecoveries([]);

export function removeQuickStats(matches, kind) {
  const current = loadQuickMatches();
  const ids = new Set(matches.map(match => String(match.id)));
  const items = current.flatMap((match, index) => (
    match.status === 'completed' && ids.has(String(match.id)) ? [{ match, index }] : []
  ));
  if (!items.length) return null;

  const recovery = {
    id: generateId(), kind, createdAt: Date.now(), items,
    order: current.map(match => String(match.id)),
  };
  // Persist recovery before deletion so navigation or a refresh cannot strand it.
  if (!writeRecoveries([...loadQuickStatsRecoveries(), recovery])) return null;
  const removedIds = new Set(items.map(({ match }) => String(match.id)));
  if (!saveQuickMatches(current.filter(match => !removedIds.has(String(match.id))))) {
    if (!writeRecoveries(loadQuickStatsRecoveries().filter(operation => operation.id !== recovery.id))) {
      console.warn('[ScoreEasy] Could not roll back Stats recovery. Restoring this extra operation is safe to retry.');
    }
    return null;
  }
  return recovery;
}

export function restoreQuickStats(id) {
  const recovery = loadQuickStatsRecoveries().find(operation => operation.id === id);
  if (!recovery) return 'unavailable';
  const current = loadQuickMatches();
  const ids = new Set(current.map(match => String(match.id)));
  for (const { match, index } of recovery.items) {
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
  if (!writeRecoveries(loadQuickStatsRecoveries().filter(operation => operation.id !== id))) return 'cleanup-failed';
  return true;
}

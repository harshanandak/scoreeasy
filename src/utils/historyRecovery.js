import { loadData, saveData } from './storage';
import { generateId } from '../models/types';

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
  ));
}

export function createHistoryRecovery(key, {
  loadMatches, saveMatches, isRemovable,
  keepFailedOperations = false, clearPreviousOnClear = false,
}) {
  const writeRecoveries = operations => saveData(key, prune(operations));

  function loadRecoveries() {
    const stored = loadData(key, []);
    const operations = prune(stored);
    if (JSON.stringify(stored) !== JSON.stringify(operations)) writeRecoveries(operations);
    return operations;
  }

  function remove(matches, kind) {
    const current = loadMatches();
    const ids = new Set(matches.map(match => String(match.id)));
    const items = current.flatMap((match, index) => (
      isRemovable(match, kind) && ids.has(String(match.id)) ? [{ match, index }] : []
    ));
    if (!items.length) return null;

    const recovery = {
      id: generateId(), kind, createdAt: Date.now(), items,
      order: current.map(match => String(match.id)),
    };
    // Persist recovery before deletion so navigation or a refresh cannot strand it.
    const previous = loadRecoveries();
    const pending = [...previous, recovery];
    if (!saveData(key, pending)) return null;
    const removedIds = new Set(items.map(({ match }) => String(match.id)));
    const saved = saveMatches(current.filter(match => !removedIds.has(String(match.id))));
    if (saved !== true) {
      // A partial removal still needs its durable recovery and an Undo control.
      if (saved === 'rollback-failed') return { ...recovery, failed: true };
      if (keepFailedOperations) return null;
      if (!saveData(key, previous)) {
        console.warn('[ScoreEasy] Could not restore the prior recovery list after a failed removal.');
      }
      return null;
    }
    // Eviction and a deliberate Clear barrier commit only after every match write succeeds.
    const committed = clearPreviousOnClear && kind === 'clear' ? [recovery] : pending.slice(-MAX_OPERATIONS);
    if (JSON.stringify(committed) !== JSON.stringify(pending) && !writeRecoveries(committed)) {
      return keepFailedOperations ? { ...recovery, failed: true } : null;
    }
    return recovery;
  }

  function restore(id) {
    const recovery = loadRecoveries().find(operation => operation.id === id);
    if (!recovery) return 'unavailable';
    const current = loadMatches();
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
    if (saveMatches(current) !== true) return false;
    if (!writeRecoveries(loadRecoveries().filter(operation => operation.id !== id))) return 'cleanup-failed';
    return true;
  }

  return {
    loadRecoveries,
    loadRecovery: () => loadRecoveries().at(-1) || null,
    clear: () => writeRecoveries([]),
    remove,
    restore,
  };
}

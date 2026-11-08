import { loadQuickMatches, saveQuickMatches } from './storage';
import { createHistoryRecovery } from './historyRecovery';

const recovery = createHistoryRecovery('se_stats_pending_undo', {
  loadMatches: loadQuickMatches,
  saveMatches: saveQuickMatches,
  isRemovable: match => match.status === 'completed',
});

export const loadQuickStatsRecoveries = recovery.loadRecoveries;
export const loadQuickStatsRecovery = recovery.loadRecovery;
export const clearQuickStatsRecovery = recovery.clear;
export const removeQuickStats = recovery.remove;
export const restoreQuickStats = recovery.restore;

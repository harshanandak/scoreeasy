import { assertState, createKabaddiState, migrateKabaddiState, teamTotal } from './kabaddiEngine';
import { resolveKabaddiRules } from './kabaddiRules';

export function createKabaddiMatch({ format = {}, names, colours, rosters = [[], []] }) {
  const rules = format.kabaddiRules || resolveKabaddiRules('quick');
  return {
    state: createKabaddiState({ presetId: rules.presetId, ...(rules.presetId === 'custom' || rules.presetId === 'legacy-club' ? { rules } : {}), names, colours, openingRaidTeam: format.openingRaidTeam ?? 0 }),
    rosters: rosters.map(list => list.slice(0, rules.initialPlayers).map(p => typeof p === 'string' ? p : p.name || p.displayName || '')),
  };
}

export const matchTotals = match => match.state.teams.map(teamTotal);

/** Unknown/corrupt engine data throws; it must never fall back to an empty match. */
export function restoreKabaddiMatch(draft, setup) {
  if (draft.kabaddi) {
    let state = migrateKabaddiState(draft.kabaddi.state);
    if (state.activeRaid && (!state.activeRaid.draft?.raidId || draft.kabaddi.draft)) {
      const source = state.activeRaid.draft || draft.kabaddi.draft || { marks: [], bonus: false };
      state = { ...state, activeRaid: { ...state.activeRaid, draft: { ...source, raidId: state.activeRaid.id, history: source.history || [] } } };
    }
    const match = { ...draft.kabaddi, state, rosters: draft.kabaddi.rosters || [[], []] };
    // Older adapters held untracked points beside the engine. Absorb them once into its categories.
    if (Array.isArray(match.carried) && match.carried.some(n => n > 0)) {
      throw new Error('Kabaddi: this saved adapter has untracked carried points; retain the original for recovery');
    }
    assertState(match.state);
    return { match, migrated: state !== draft.kabaddi.state };
  }
  const halfMs = draft.format?.mode === 'timed' ? Math.round(draft.format.timeLimit * 500) : 1200000;
  const rules = resolveKabaddiRules('legacy-club', { ...resolveKabaddiRules('standard'), source: 'Score before raid tracking; player history unknown', end: { kind: 'timed', halves: 2, halfMs, intervalMs: 300000 } });
  const match = createKabaddiMatch({ ...setup, format: { kabaddiRules: rules } });
  match.legacyScore = [draft.gScore1 ?? 0, draft.gScore2 ?? 0];
  if (!match.legacyScore.every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('Kabaddi: invalid saved score');
  match.state.teams.forEach((team, i) => { team.score.technical = match.legacyScore[i]; });
  assertState(match.state);
  return { match, migrated: true };
}

/** Save before acknowledging a tap. Migration retains a separate original until explicitly removed. */
export function persistKabaddiDraft({ key, previous, match, save, nowIso }) {
  assertState(match.state);
  const totals = matchTotals(match);
  return save(key, { ...previous, kabaddi: match, gScore1: totals[0], gScore2: totals[1], updatedAt: nowIso });
}

export const boardPhase = state => state.phase === 'paused' ? state.resumePhase : state.phase;
export function raidLog(state) {
  const undone = new Set(state.events.filter(e => e.type === 'undo').map(e => e.targetId));
  return state.events.filter(e => e.type === 'raid' && !undone.has(e.id)).reverse();
}

import { describe, expect, it, vi } from 'vitest';
import { createKabaddiMatch, matchTotals, persistKabaddiDraft, restoreKabaddiMatch } from './kabaddiQuickMatch';
import { beginLiveRaid, draftOf, landRaid, markDefender, reopenRaid, touchCount } from './kabaddiBoardModel';
import { resolveKabaddiRules } from './kabaddiRules';
import { assertState } from './kabaddiEngine';
import { finishFromQuickResult } from '../designs/design1-mono/kit/finishModel';

const setup = { format: { kabaddiRules: resolveKabaddiRules('quick') }, names: ['Royals', 'Strikers'], colours: [undefined, undefined] };

describe('kabaddi storage adapter', () => {
  it('keeps old goals totals in the engine without inventing raid or player history', () => {
    const { match, migrated } = restoreKabaddiMatch({ gScore1: 23, gScore2: 17 }, setup);
    expect(migrated).toBe(true);
    expect(matchTotals(match)).toEqual([23, 17]);
    expect(match.state.raidNumber).toBe(0);
    expect(match.legacyScore).toEqual([23, 17]);
  });

  it('refuses a corrupt future state without replacing it with a new game', () => {
    const draft = { kabaddi: { state: { version: 99 } }, gScore1: 22 };
    expect(() => restoreKabaddiMatch(draft, setup)).toThrow();
    expect(draft.kabaddi.state.version).toBe(99);
  });

  it('persists active marks, undo history and landed reopening through JSON', () => {
    let match = beginLiveRaid(createKabaddiMatch(setup), { atMs: 100 });
    match = markDefender(match, 'B1', 'touched');
    const save = vi.fn(() => true);
    expect(persistKabaddiDraft({ key: 'draft', previous: { quickMatchId: 'same' }, match, save, nowIso: 'now' })).toBe(true);
    const stored = JSON.parse(JSON.stringify(save.mock.calls[0][1]));
    expect(stored.quickMatchId).toBe('same');
    match = restoreKabaddiMatch(stored, setup).match;
    expect(draftOf(match).marks).toEqual([{ slot: 'B1', kind: 'touched' }]);
    match = landRaid(match, 'safe', { atMs: 500 });
    const reopened = reopenRaid(JSON.parse(JSON.stringify(match)), { atMs: 1000 });
    expect(matchTotals(reopened)).toEqual([0, 0]);
    expect(draftOf(reopened).marks).toEqual([{ slot: 'B1', kind: 'touched' }]);
    expect(draftOf(reopened).history).toHaveLength(1);
  });

  it('propagates storage failure so the board can refuse to acknowledge the tap', () => {
    expect(persistKabaddiDraft({ key: 'draft', previous: {}, match: createKabaddiMatch(setup), save: () => false, nowIso: 'now' })).toBe(false);
  });

  it('rejects corrupt persisted draft marks before they can render or score', () => {
    const match = beginLiveRaid(createKabaddiMatch(setup), { atMs: 100 });
    match.state.activeRaid.draft.marks = [{ slot: 'A1', kind: 'touched' }];
    expect(() => assertState(match.state)).toThrow(/draft marks/);
  });

  it('uses the engine for two-tap casual touch counts with all players staying', () => {
    let match = beginLiveRaid(createKabaddiMatch(setup), { atMs: 100 });
    match = landRaid(touchCount(match, 2), 'safe', { atMs: 200 });
    expect(matchTotals(match)).toEqual([2, 0]);
    expect(match.state.mat.map(m => m.length)).toEqual([5, 5]);
  });

  it('shows no winner for an early finish even with unequal scores', () => {
    const model = finishFromQuickResult({ team1: 'A', team2: 'B', score1: 9, score2: 2, resultType: 'abandoned', kabaddi: {} }, { kind: 'goals' });
    expect(model).toMatchObject({ outcome: 'none', winnerSide: null, headline: 'Abandoned · no result' });
  });
});

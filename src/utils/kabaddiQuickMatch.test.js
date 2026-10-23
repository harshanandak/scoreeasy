// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { applyRaid, pause, preview, remainingTime } from './kabaddiEngine.js';
import {
  boardPhase, callTimeUp, canUndoAction, createKabaddiMatch, halfMsFor, isKabaddiMatch, matchTotals,
  previewWords, raidLog, raidMoment, raidRow, restoreKabaddiMatch, startNextRaid, startSecondHalf,
  undoAction, undoHint, withOpeningRaidTeam,
} from './kabaddiQuickMatch.js';

const setup = { format: { mode: 'timed', timeLimit: 2400 }, names: ['Royals', 'Strikers'], colours: ['#6d28d9', '#f97316'] };
const names = setup.names;
const json = (value) => JSON.parse(JSON.stringify(value));
let seq = 0;
const raid = (state, type, extra = {}, atMs = 1000) => {
  seq += 1;
  const started = startNextRaid(state, { id: `r${seq}`, atMs });
  return applyRaid(started, { id: `c${seq}`, raidId: `r${seq}`, expectedRevision: started.revision, type, ...extra });
};

describe('kabaddi quick match glue', () => {
  it('reads two equal halves from the setup match length', () => {
    expect(halfMsFor({ mode: 'timed', timeLimit: 2400 })).toBe(1200000);
    expect(halfMsFor({ mode: 'timed', timeLimit: 1800 })).toBe(900000);
    expect(halfMsFor({ mode: 'free' })).toBe(1200000);
    expect(createKabaddiMatch(setup).state.rules.halfMs).toBe(1200000);
  });

  it('lets the scorer pick the opening raider only before the first whistle', () => {
    const match = withOpeningRaidTeam(createKabaddiMatch(setup), 1, setup);
    expect(match.state.nextRaidTeam).toBe(1);
    const started = { ...match, state: startNextRaid(match.state, { id: 'r0', atMs: 0 }) };
    expect(withOpeningRaidTeam(started, 0, setup)).toBe(started);
  });

  it('round-trips through JSON and rejects corrupt saved state', () => {
    const match = createKabaddiMatch(setup);
    match.state = raid(match.state, 'touch', { count: 2 });
    const saved = json(match);
    expect(isKabaddiMatch(saved)).toBe(true);
    expect(restoreKabaddiMatch({ kabaddi: saved }, setup)).toEqual({ match: saved, migrated: false });
    expect(isKabaddiMatch({ ...saved, state: { ...saved.state, revision: 99 } })).toBe(false);
  });

  it('migrates an old +1/+2 draft: keeps both totals, starts the mat at 7–7', () => {
    const { match, migrated } = restoreKabaddiMatch({ gScore1: 12, gScore2: 9, gScoreHistory: [{ team: 1, value: 2 }] }, setup);
    expect(migrated).toBe(true);
    expect(matchTotals(match)).toEqual([12, 9]);
    expect(match.state.mat.map((m) => m.length)).toEqual([7, 7]);
    expect(match.state.phase).toBe('ready');
    const after = { ...match, state: raid(match.state, 'touch', { count: 1 }) };
    expect(matchTotals(after)).toEqual([13, 9]);
    expect(canUndoAction(match.state)).toBe(false);
  });

  it('undoes one raid as one action, through a pause, and says what it restores', () => {
    const match = createKabaddiMatch(setup);
    match.state = raid(match.state, 'touch', { count: 2, bonusAwarded: true, bonusBeforeContact: true }, 1000);
    expect(undoHint(match)).toBe('Restore 0–0 · mat 7–7');
    match.state = pause(match.state, { atMs: 5000 });
    const undone = undoAction(match.state);
    expect(matchTotals({ ...match, state: undone })).toEqual([0, 0]);
    expect(undone.mat.map((m) => m.length)).toEqual([7, 7]);
    expect(undone.nextRaidTeam).toBe(0);
    expect(undone.phase).toBe('paused');
    expect(boardPhase(undone)).toBe('playing');
    // the pre-raid clock, frozen for review; never the clock of a later anchor
    expect(remainingTime(undone, 999999)).toBe(1200000);
  });

  it('crosses half time only as its own action, and time up rides with the raid before it', () => {
    let state = raid(createKabaddiMatch(setup).state, 'empty', {}, 1000);
    state = callTimeUp(state, 1201000);
    expect(state.phase).toBe('halfTime');
    state = startSecondHalf(state, 1500000);
    expect(state.half).toBe(2);
    expect(state.nextRaidTeam).toBe(1);
    expect(undoHint({ state, carried: [0, 0] })).toBe('Back to half time');
    state = undoAction(state);
    expect(boardPhase(state)).toBe('halfTime');
    expect(undoHint({ state, carried: [0, 0] })).toBe('Restore 0–0 · mat 7–7');
    state = undoAction(state);
    expect(state.half).toBe(1);
    expect(boardPhase(state)).toBe('playing');
    expect(state.emptyStreak).toEqual([0, 0]);
  });

  it('words a preview, a log row and the big moments from engine output', () => {
    const match = createKabaddiMatch(setup);
    const started = startNextRaid(match.state, { id: 'r', atMs: 0 });
    const words = previewWords(preview(started, { id: 'p', type: 'touch', count: 2, bonusAwarded: true, bonusBeforeContact: true }), started, names, [0, 0]);
    expect(words.title).toBe('Royals +3');
    expect(words.lines).toEqual(['Score 3–0', 'Mat 7–5 · Strikers 2 out', 'Strikers raid next']);
    const after = applyRaid(started, { id: 'p', type: 'touch', count: 2, bonusAwarded: true, bonusBeforeContact: true });
    const row = raidRow(raidLog(after)[0], names, [0, 0]);
    expect(row).toMatchObject({ number: 1, text: 'Royals · 2 touch + bonus', score: [3, 0], mat: 'Strikers 7→5' });
    expect(raidMoment(raidLog(after)[0])).toBeNull();
  });

  it('flags all out and super tackle as moments', () => {
    let state = createKabaddiMatch(setup).state;
    state = raid(state, 'touch', { count: 4 });
    state = raid(state, 'empty');
    state = raid(state, 'tackled');
    expect(state.mat[0].length).toBe(6);
    expect(state.mat[1].length).toBe(4);
    state = raid(state, 'touch', { count: 1 }); // Strikers raid: 4→5 for them, Royals 6→5
    state = raid(state, 'tackled'); // Royals raid into 5 defenders: plain tackle
    expect(raidMoment(raidLog(state)[0])).toBeNull();
    state = raid(state, 'touch', { count: 3 }); // Strikers 6 touch Royals 4 → 1? 4 left -> 1
    expect(state.mat[0].length).toBe(1);
    state = raid(state, 'tackled'); // Royals' last player tackled: all out
    expect(raidMoment(raidLog(state)[0])).toEqual({ kind: 'allOut', team: 0 });
    expect(raidSummaryText(state)).toContain('All out');
  });
});

function raidSummaryText(state) {
  return raidRow(raidLog(state)[0], names, [0, 0]).text;
}

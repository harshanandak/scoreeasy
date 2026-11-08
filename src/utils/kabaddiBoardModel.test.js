// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { teamTotal } from './kabaddiEngine.js';
import {
  beginLiveRaid, boardView, cancelLiveRaid, createBoardMatch, draftOf, landRaid, lastMark, liveRaids, markDefender, namedOutMap, previewDraft,
  raiderLost, raidFlags, readback, reopenRaid, rulingForDraft, startHalf, toggleBonus, undoMark,
} from './kabaddiBoardModel.js';

const NOW = 1_000_000;
const HALF = 20 * 60 * 1000;

// Royals (team 0) raid first against Strikers' B1..B7, all seven on the mat, so bonus is legal.
function live() {
  let m = createBoardMatch({ halfMs: HALF, names: ['Royals', 'Strikers'], colours: [undefined, undefined] });
  m = { ...m, state: startHalf(m.state, { atMs: NOW }) };
  return beginLiveRaid(m, { atMs: NOW + 1000 });
}
const totals = (m) => m.state.teams.map(teamTotal);
const tap = (m, ...marks) => marks.reduce((acc, [slot, kind]) => markDefender(acc, slot, kind), m);

describe('live raid draft', () => {
  it('opens an empty draft for the started raid and the engine has an active raid', () => {
    const m = live();
    expect(m.state.activeRaid).not.toBeNull();
    expect(draftOf(m)).toEqual({ raidId: m.state.activeRaid.id, marks: [], bonus: false, history: [] });
  });

  it('marks keep tap order, a repeat removes, the other kind replaces in place', () => {
    let m = tap(live(), ['B3', 'touched'], ['B1', 'touched'], ['B5', 'out']);
    expect(draftOf(m).marks.map((x) => `${x.slot}:${x.kind}`)).toEqual(['B3:touched', 'B1:touched', 'B5:out']);
    m = markDefender(m, 'B1', 'out');
    expect(draftOf(m).marks.map((x) => `${x.slot}:${x.kind}`)).toEqual(['B3:touched', 'B1:out', 'B5:out']);
    m = markDefender(m, 'B3', 'touched');
    expect(draftOf(m).marks.map((x) => x.slot)).toEqual(['B1', 'B5']);
    expect(draftOf(undoMark(m)).marks.map((x) => x.slot)).toEqual(['B3', 'B1', 'B5']);
  });

  it('ignores a slot that is not a defender on the mat', () => {
    const m = live();
    expect(() => markDefender(m, 'A2', 'touched')).toThrow();
    expect(() => markDefender(m, 'B2', 'weird')).toThrow();
  });

  it('marks change no score and no mat until the raid lands', () => {
    const m = toggleBonus(tap(live(), ['B1', 'touched'], ['B2', 'touched']));
    expect(totals(m)).toEqual([0, 0]);
    expect(m.state.mat.map((x) => x.length)).toEqual([7, 7]);
  });

  it('survives a refresh: the match with its draft round-trips through JSON', () => {
    const m = toggleBonus(tap(live(), ['B4', 'touched'], ['B6', 'out']));
    const restored = JSON.parse(JSON.stringify(m));
    expect(draftOf(restored)).toEqual(draftOf(m));
    const landed = landRaid(restored, 'safe', { atMs: NOW + 9000 });
    expect(landed).not.toBeNull();
  });

  it('a draft left over from another raid is not used', () => {
    const m = live();
    const stale = { ...m, state: { ...m.state, activeRaid: { ...m.state.activeRaid, draft: { ...draftOf(m), raidId: 'old-raid' } } } };
    expect(draftOf(stale)).toBeNull();
    expect(landRaid(stale, 'safe', { atMs: NOW + 5000 })).toBeNull();
  });
});

describe('landing the raid', () => {
  it('nothing marked, back safe is an empty raid', () => {
    const m = landRaid(live(), 'safe', { atMs: NOW + 8000 });
    expect(totals(m)).toEqual([0, 0]);
    expect(liveRaids(m.state)[0].outcome).toBe('empty');
    expect(m.draft).toBeUndefined();
  });

  it('two touches and bonus: +3, defenders out in tap order', () => {
    const m = landRaid(toggleBonus(tap(live(), ['B6', 'touched'], ['B2', 'touched'])), 'safe', { atMs: NOW + 12000 });
    expect(totals(m)).toEqual([3, 0]);
    const entry = liveRaids(m.state)[0];
    expect(entry.effects.lost[1]).toEqual(['B6', 'B2']);
    expect(m.state.mat[1]).toHaveLength(5);
    expect(readback(m, entry)).toContain('Royals +3 with bonus');
  });

  it('bonus alone is a bonus-only raid', () => {
    const m = landRaid(toggleBonus(live()), 'safe', { atMs: NOW + 7000 });
    expect(totals(m)).toEqual([1, 0]);
    expect(liveRaids(m.state)[0].outcome).toBe('bonus');
  });

  it('tackled: raider out, touches do not score', () => {
    const m = landRaid(tap(live(), ['B1', 'touched'], ['B2', 'touched']), 'tackled', { atMs: NOW + 20000 });
    expect(totals(m)).toEqual([0, 1]);
    expect(m.state.mat[1]).toHaveLength(7);
    expect(m.state.mat[0]).toHaveLength(6);
    expect(raiderLost(liveRaids(m.state)[0])).toBe(true);
  });

  it('raider stepped out: raider out, defender side +1', () => {
    const m = landRaid(live(), 'raiderOut', { atMs: NOW + 6000 });
    expect(totals(m)).toEqual([0, 1]);
    expect(readback(m, liveRaids(m.state)[0])).toContain('Raider out');
  });

  it('a defender out of court plus a touch scores both and reads back truthfully', () => {
    const m = landRaid(tap(live(), ['B1', 'touched'], ['B7', 'out']), 'safe', { atMs: NOW + 15000 });
    expect(totals(m)).toEqual([2, 0]);
    const entry = liveRaids(m.state)[0];
    expect(entry.outcome).toBe('mixed');
    expect(raiderLost(entry)).toBe(false);
    expect(readback(m, entry)).toBe('Royals +2 · Strikers 2 out');
  });

  it('tackled with a defender out of court: both sides score, the words say so', () => {
    const m = landRaid(tap(live(), ['B7', 'out']), 'tackled', { atMs: NOW + 15000 });
    expect(totals(m)).toEqual([1, 1]);
    const text = readback(m, liveRaids(m.state)[0]);
    expect(text).toContain('Tackled');
    expect(text).toContain('Strikers 1 out of court');
    expect(text).not.toContain('Touched, then tackled');
  });

  it('the preview equals what landing then writes', () => {
    const m = toggleBonus(tap(live(), ['B3', 'touched'], ['B4', 'touched'], ['B5', 'touched']));
    const entry = previewDraft(m.state, draftOf(m), 'safe', { atMs: NOW + 10000 });
    const landed = landRaid(m, 'safe', { atMs: NOW + 10000 });
    expect([entry.effects.lost[1].length, entry.effects.awards.reduce((s, a) => s + a.points, 0)]).toEqual([3, 4]);
    expect(totals(landed)).toEqual([4, 0]);
  });

  it('all out lands with the two extra points', () => {
    let m = landRaid(tap(live(), ['B1', 'touched'], ['B2', 'touched'], ['B3', 'touched'], ['B4', 'touched']), 'safe', { atMs: NOW + 8000 });
    m = landRaid(beginLiveRaid(m, { atMs: NOW + 9000 }), 'safe', { atMs: NOW + 12000 }); // Strikers raid, empty
    m = beginLiveRaid(m, { atMs: NOW + 13000 });
    expect(m.state.activeRaid.raidingTeam).toBe(0);
    expect(m.state.mat[1]).toHaveLength(3);
    const allOut = landRaid(tap(m, ['B5', 'touched'], ['B6', 'touched'], ['B7', 'touched']), 'safe', { atMs: NOW + 16000 });
    expect(totals(allOut)).toEqual([9, 0]);
    expect(liveRaids(allOut.state)[0].effects.allOut).toEqual([1]);
    expect(readback(allOut, liveRaids(allOut.state)[0])).toContain('Strikers all out');
  });

  it('only a valid bonus lands: with six on the mat it still can, with fewer the engine refuses', () => {
    let m = live();
    // take Strikers down to five with one raid, then a later Royals raid cannot claim bonus
    m = landRaid(tap(m, ['B1', 'touched'], ['B2', 'touched']), 'safe', { atMs: NOW + 9000 });
    m = beginLiveRaid(m, { atMs: NOW + 10000 });
    m = landRaid(m, 'safe', { atMs: NOW + 12000 });
    m = beginLiveRaid(m, { atMs: NOW + 13000 });
    expect(m.state.activeRaid.raidingTeam).toBe(0);
    expect(boardView(m, NOW + 13000).mat[1].on).toBe(5);
    expect(() => toggleBonus(m)).toThrow(/bonus/);
    expect(draftOf(m).bonus).toBe(false);
  });
});

describe('cancel and reopen', () => {
  it('cancel drops the draft and changes no point', () => {
    const m = cancelLiveRaid(tap(live(), ['B1', 'touched']));
    expect(m.state.activeRaid).toBeNull();
    expect(m.draft).toBeUndefined();
    expect(totals(m)).toEqual([0, 0]);
  });

  it('undo after landing reopens the raid with the same marks and the same raid start', () => {
    const before = toggleBonus(tap(live(), ['B2', 'touched'], ['B5', 'touched']));
    const draft = draftOf(before);
    const landed = landRaid(before, 'safe', { atMs: NOW + 11000 });
    const entry = liveRaids(landed.state)[0];
    const startedAtMs = before.state.activeRaid.raidClock.startedAtMs;
    const reopened = reopenRaid(landed, { raidId: entry.id, startedAtMs, draft });
    expect(totals(reopened)).toEqual([0, 0]);
    expect(reopened.state.mat.map((x) => x.length)).toEqual([7, 7]);
    expect(draftOf(reopened).marks).toEqual(draft.marks);
    expect(reopened.state.activeRaid.raidClock.startedAtMs).toBe(startedAtMs);
    // fix a mark and land again
    const fixed = markDefender(reopened, 'B5', 'touched');
    expect(totals(landRaid(fixed, 'safe', { atMs: NOW + 13000 }))).toEqual([2, 0]);
  });

  it('reopen refuses when something else happened after that raid', () => {
    const landed = landRaid(live(), 'safe', { atMs: NOW + 5000 });
    expect(reopenRaid(landed, { raidId: 'not-the-latest', startedAtMs: NOW, draft: { marks: [], bonus: false } })).toBeNull();
  });
});

describe('rulingForDraft', () => {
  it('uses the engine slot order and never invents a count', () => {
    const m = tap(live(), ['B4', 'touched'], ['B1', 'touched']);
    expect(rulingForDraft(m.state, draftOf(m), 'safe')).toEqual({ type: 'touch', count: 2, outsInOrder: ['B4', 'B1'] });
  });

  it('is null with no raid or no draft', () => {
    const m = live();
    expect(rulingForDraft(m.state, null, 'safe')).toBeNull();
    expect(rulingForDraft(m.state, draftOf(m), 'nonsense')).toBeNull();
  });
});

describe('undo order and who is named', () => {
  it('undo takes the bonus and the marks back in the order they were tapped', () => {
    let m = tap(live(), ['B1', 'touched']);
    m = toggleBonus(m);
    m = tap(m, ['B2', 'touched']);
    expect(lastMark(m)).toEqual({ slot: 'B2', kind: 'touched' });
    m = undoMark(m);
    expect(lastMark(m)).toEqual({ bonus: true });
    m = undoMark(m);
    expect(draftOf(m).bonus).toBe(false);
    expect(lastMark(m)).toEqual({ slot: 'B1', kind: 'touched' });
    expect(lastMark(undoMark(m))).toBeNull();
  });

  it('only defenders picked on the board are named; a raider who went out is a count', () => {
    let m = landRaid(tap(live(), ['B3', 'touched']), 'safe', { atMs: NOW + 8000 });
    expect(Object.keys(namedOutMap(m.state)[1])).toEqual(['B3']);
    m = landRaid(beginLiveRaid(m, { atMs: NOW + 9000 }), 'tackled', { atMs: NOW + 12000 }); // Strikers raider out
    expect(Object.keys(namedOutMap(m.state)[1])).toEqual(['B3']);
    expect(Object.keys(namedOutMap(m.state)[0])).toEqual([]);
  });

  it('with a team list the readback names picked defenders but never the raider', () => {
    let m = createBoardMatch({ halfMs: HALF, names: ['Royals', 'Strikers'], colours: [undefined, undefined], rosters: [['Ravi', 'Arjun'], ['4', '7', '9']] });
    m = beginLiveRaid({ ...m, state: startHalf(m.state, { atMs: NOW }) }, { atMs: NOW + 1000 });
    const touched = landRaid(tap(m, ['B3', 'touched']), 'safe', { atMs: NOW + 5000 });
    expect(readback(touched, liveRaids(touched.state)[0], { raiderNamed: false })).toBe('Royals +1 · #9 out');
    const tackled = landRaid(m, 'tackled', { atMs: NOW + 5000 });
    expect(readback(tackled, liveRaids(tackled.state)[0], { guessed: false, raiderNamed: false })).toBe('Tackled · Strikers +1');
    const flags = raidFlags(tackled, liveRaids(tackled.state)[0], { outsNamed: true, raiderNamed: false });
    expect(flags[0].outText).toBe('1 out');
  });
});

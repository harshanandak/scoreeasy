// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createKabaddiState, applyRaid, startRaid, cancelRaid, preview, undo,
  isDoOrDie, isSuperTackleOn, nextRaider, startHalf, timeUp,
  pause, resume, correctClock, remainingTime, finish, reopen, result, teamTotal, assertState,
} from './kabaddiEngine.js';

const copy = (value) => JSON.parse(JSON.stringify(value));
function fixture({ score = [18, 18], mat = [5, 6], next = 0, streak = [0, 0] } = {}) {
  const state = startHalf(createKabaddiState({ names: ['Royals', 'Strikers'] }));
  for (const team of [0, 1]) {
    state.teams[team].score.touch = score[team];
    const slots = [...state.mat[team]];
    state.mat[team] = slots.slice(0, mat[team]);
    state.outQueue[team] = slots.slice(mat[team]).map((slotId, index) => ({
      slotId, outEventId: 'fixture', outSequence: index + 1,
    }));
  }
  state.nextOutSequence = 7;
  state.nextRaidTeam = next;
  state.emptyStreak = streak;
  assertState(state);
  return state;
}
const event = (type, extra = {}) => ({ id: 'raid-1', type, ...extra });
const totals = (state) => state.teams.map(teamTotal);
const counts = (state) => state.mat.map((slots) => slots.length);
const gameplay = (state) => ({
  teams: state.teams, mat: state.mat, outQueue: state.outQueue,
  nextRaidTeam: state.nextRaidTeam, emptyStreak: state.emptyStreak,
  half: state.half, raidNumber: state.raidNumber, nextOutSequence: state.nextOutSequence,
});

describe('worked examples from kabaddi-spec', () => {
  it('touch + bonus: +3, two FIFO revivals, mat 7–4 and one event', () => {
    const before = fixture();
    before.mat[0] = ['A1', 'A3', 'A4', 'A6', 'A7'];
    before.outQueue[0] = ['A2', 'A5'].map((slotId, i) => ({ slotId, outEventId: 'old', outSequence: i + 1 }));
    const after = applyRaid(before, event('touch', { count: 2, bonusAwarded: true, bonusBeforeContact: true, outsInOrder: ['B6', 'B2'] }));
    expect(totals(after)).toEqual([21, 18]);
    expect(counts(after)).toEqual([7, 4]);
    expect(after.mat[0].slice(-2)).toEqual(['A2', 'A5']);
    expect(after.outQueue[1].slice(-2).map((out) => out.slotId)).toEqual(['B6', 'B2']);
    expect(nextRaider(after)).toBe(1);
    expect(after.events.at(-1).effects.revived[0]).toEqual(['A2', 'A5']);
    expect(after.events.at(-1).superRaid).toBe(true);
  });

  it('bonus earned before a tackle survives, without touch or bonus revival', () => {
    const after = applyRaid(fixture(), event('tackled', { bonusAwarded: true, bonusBeforeContact: true }));
    expect(totals(after)).toEqual([19, 19]);
    expect(counts(after)).toEqual([4, 7]);
    expect(after.teams[0].score.touch).toBe(18);
  });

  it('super tackle gives two points but only one revival', () => {
    const before = fixture({ mat: [5, 3] });
    const after = applyRaid(before, event('tackled'));
    expect(totals(after)).toEqual([18, 20]);
    expect(counts(after)).toEqual([4, 4]);
    expect(after.mat[1].at(-1)).toBe(before.outQueue[1][0].slotId);
  });

  it('touching the last three derives one all-out and restores seven', () => {
    const before = fixture({ score: [16, 18], mat: [5, 3] });
    const after = applyRaid(before, event('touch', { count: 3 }));
    expect(totals(after)).toEqual([21, 18]);
    expect(counts(after)).toEqual([7, 7]);
    expect(after.outQueue).toEqual([[], []]);
    expect(after.events.at(-1).effects.allOut).toEqual([1]);
    expect(gameplay(undo(after))).toEqual(gameplay(before));
  });

  it('tackling the last raider awards 1 + 2, with only one defensive revival', () => {
    const after = applyRaid(fixture({ score: [20, 20], mat: [1, 6] }), event('tackled'));
    expect(totals(after)).toEqual([20, 23]);
    expect(counts(after)).toEqual([7, 7]);
    expect(after.events.at(-1).effects.revived[1]).toHaveLength(1);
  });

  it('third own empty becomes a raider out; bonus instead clears the streak', () => {
    const before = fixture({ score: [21, 18], mat: [7, 4], next: 1, streak: [0, 2] });
    expect(isDoOrDie(before)).toBe(true);
    const after = applyRaid(before, event('empty'));
    expect(totals(after)).toEqual([22, 18]);
    expect(counts(after)).toEqual([7, 3]);
    expect(after.emptyStreak).toEqual([0, 0]);
    expect(after.events.at(-1).outcome).toBe('doOrDieFailure');
    const bonus = applyRaid(before, event('bonus', { bonusBeforeContact: true }));
    expect(totals(bonus)).toEqual([21, 19]);
    expect(counts(bonus)).toEqual([7, 4]);
    expect(bonus.emptyStreak).toEqual([0, 0]);
  });

  it('plain line-out dismisses the raider and revives one defender', () => {
    const after = applyRaid(fixture(), event('selfOut', { reason: 'boundary' }));
    expect(totals(after)).toEqual([18, 19]);
    expect(counts(after)).toEqual([4, 7]);
  });

  it('between-raid technical point preserves queues, turn, streak and raid count', () => {
    const before = fixture({ streak: [2, 1] });
    const after = applyRaid(before, event('technical', { to: 0, reason: 'delay', turnEffect: 'none' }));
    expect(totals(after)).toEqual([19, 18]);
    expect(counts(after)).toEqual([5, 6]);
    for (const key of ['outQueue', 'nextRaidTeam', 'emptyStreak', 'raidNumber']) expect(after[key]).toEqual(before[key]);
  });

  it('half two carries score/mat/queues/streak and opens opposite half one', () => {
    const before = fixture({ score: [21, 18], mat: [7, 4], streak: [0, 2] });
    const after = startHalf(timeUp(before), { atMs: 1200000 });
    expect(totals(after)).toEqual([21, 18]);
    expect(counts(after)).toEqual([7, 4]);
    expect(after.outQueue).toEqual(before.outQueue);
    expect(after.emptyStreak).toEqual([0, 2]);
    expect(after.half).toBe(2);
    expect(nextRaider(after)).toBe(1);
    expect(remainingTime(after, 1200000)).toBe(1200000);
    expect(isDoOrDie(after)).toBe(true);
    const resolved = applyRaid(after, event('empty'));
    expect(totals(resolved)).toEqual([22, 18]);
  });

  it('time up during raid 61 awaits its ruling, then enters finishReview', () => {
    let state = startHalf(timeUp(fixture({ score: [32, 28], mat: [7, 7] })));
    state.raidNumber = 60;
    state = startRaid(state, { id: 'active-61', atMs: 10 });
    state = timeUp(state);
    expect(state.phase).toBe('fullPending');
    expect(totals(state)).toEqual([32, 28]);
    expect(() => finish(state)).toThrow(/review/i);
    state = applyRaid(state, event('empty', { raidId: 'active-61' }));
    expect(state.raidNumber).toBe(61);
    expect(state.phase).toBe('finishReview');
    expect(totals(state)).toEqual([32, 28]);
    expect(() => startRaid(state, { id: 'late' })).toThrow(/playing/);
    expect(finish(state).phase).toBe('finished');
  });

  it('result categories reconcile to 32–28, margin four, with bonus counted once', () => {
    const state = fixture({ score: [0, 0], mat: [7, 7] });
    Object.assign(state.teams[0].score, { touch: 20, bonus: 2, tackleBase: 5, superTackleExtra: 1, allOut: 4 });
    Object.assign(state.teams[1].score, { touch: 18, bonus: 1, tackleBase: 4, superTackleExtra: 1, allOut: 4 });
    expect(result(state)).toMatchObject({ totals: [32, 28], winner: 0, margin: 4, draw: false, final: false });
    expect(result(state).breakdown[0]).toMatchObject({ raid: 22, tackle: 6, allOut: 4 });
  });

  it('persisted draft differs from confirmed event; reconnect retry is idempotent', () => {
    const draft = startRaid(fixture(), { id: 'draft', atMs: 12 });
    const input = event('touch', { count: 1, raidId: 'draft', expectedRevision: draft.revision });
    expect(copy(draft).activeRaid.id).toBe('draft');
    const confirmed = copy(applyRaid(copy(draft), input));
    expect(confirmed.activeRaid).toBeNull();
    expect(applyRaid(confirmed, input)).toEqual(confirmed);
    expect(applyRaid(copy(confirmed), input)).toEqual(confirmed);
    expect(() => applyRaid(confirmed, { ...input, count: 2 })).toThrow(/reused/);
    expect(() => applyRaid(confirmed, event('empty', { id: 'new', expectedRevision: 0 }))).toThrow(/revision/);
  });
});

describe('rule boundaries and previews', () => {
  it.each([1, 2, 3, 4])('raid-start super eligibility at %i defenders for tackle and self-out', (defenders) => {
    for (const type of ['tackled', 'selfOut']) {
      const before = fixture({ mat: [5, defenders] });
      expect(isSuperTackleOn(before)).toBe(defenders <= 3);
      const after = applyRaid(before, event(type, { reason: 'cant lost' }));
      expect(teamTotal(after.teams[1]) - 18).toBe(defenders <= 3 ? 2 : 1);
      expect(after.events.at(-1).effects.revived[1]).toHaveLength(1);
    }
  });

  it.each([5, 6])('bonus eligibility with %i defenders', (defenders) => {
    const input = event('bonus', { bonusBeforeContact: true });
    const before = fixture({ mat: [5, defenders] });
    if (defenders === 5) expect(() => applyRaid(before, input)).toThrow(/six/);
    else expect(totals(applyRaid(before, input))).toEqual([19, 18]);
  });

  it('preview uses the real resolver, with no mutation or committed event', () => {
    const before = fixture();
    const saved = copy(before);
    const input = event('touch', { count: 2, bonusAwarded: true, bonusBeforeContact: true });
    expect(preview(before, input)).toMatchObject({ points: [3, 0], lost: [0, 2], revived: [2, 0], mat: [7, 4], nextRaidTeam: 1 });
    expect(before).toEqual(saved);
    expect(preview(fixture({ next: 1, mat: [3, 5], streak: [0, 2] }), event('empty')))
      .toMatchObject({ outcome: 'doOrDieFailure', points: [2, 0], lost: [0, 1] });
  });

  it('opponent nonempty raids do not clear own empties', () => {
    let state = fixture({ mat: [7, 7], streak: [1, 0] });
    state = applyRaid(state, event('empty'));
    state = applyRaid(state, event('touch', { id: 'other', count: 1 }));
    expect(state.emptyStreak).toEqual([2, 0]);
    expect(isDoOrDie(state)).toBe(true);
  });

  it('defender self-outs have their own category and ordered FIFO effects', () => {
    const after = applyRaid(fixture({ mat: [5, 2] }), event('defenderOut', { count: 2, reason: 'boundary' }));
    expect(totals(after)).toEqual([22, 18]);
    expect(after.teams[0].score.defenderOut).toBe(2);
    expect(after.teams[0].score.touch).toBe(18);
    expect(after.events.at(-1).superRaid).toBe(false);
    expect(counts(after)).toEqual([7, 7]);
  });

  it('technical knockout is explicit; all-out is derived once without extra revival', () => {
    const after = applyRaid(fixture({ mat: [1, 6] }), event('technical', {
      to: 1, offender: { team: 0, slotId: 'A1' }, reason: 'referee ruling', turnEffect: 'none',
    }));
    expect(totals(after)).toEqual([18, 21]);
    expect(counts(after)).toEqual([7, 7]);
    expect(after.events.at(-1).effects.revived[1]).toHaveLength(1);
    expect(after.raidNumber).toBe(0);
  });

  it('mixed rulings follow chronology, even when a later revival follows all-out', () => {
    const before = fixture({ mat: [1, 1] });
    const after = applyRaid(before, event('mixed', { dismissals: [
      { team: 1, slotId: 'B1', category: 'defenderOut' },
      { team: 0, slotId: 'A1', category: 'tackleBase' },
    ], reason: 'defender line out before raider out' }));
    expect(totals(after)).toEqual([21, 20]);
    expect(counts(after)).toEqual([1, 7]);
    expect(after.events.at(-1).effects.allOut).toEqual([1]);
  });

  it('technical replay preserves streak/turn and cancels draft; forfeit explicitly consumes turn', () => {
    const before = fixture({ streak: [2, 0] });
    const draft = startRaid(before, { id: 'interrupted' });
    const replay = applyRaid(draft, event('technical', { to: 0, reason: 'interruption', turnEffect: 'replay' }));
    expect(replay.activeRaid).toBeNull();
    expect(replay.nextRaidTeam).toBe(0);
    expect(replay.emptyStreak).toEqual([2, 0]);
    expect(replay.raidNumber).toBe(0);
    const forfeit = applyRaid(before, event('technical', { to: 1, reason: 'forfeit', turnEffect: 'forfeit' }));
    expect(forfeit.nextRaidTeam).toBe(1);
    expect(forfeit.raidNumber).toBe(1);
    expect(forfeit.emptyStreak).toEqual([0, 0]);
  });
});

describe('clocks, lifecycle and correction', () => {
  it('custom halves and 30-second raid clock are deterministic; expiry awards nothing', () => {
    const state = startHalf(createKabaddiState({ halfMs: 900000, openingRaidTeam: 1 }), { atMs: 100 });
    const active = startRaid(state, { id: 'r', atMs: 200 });
    expect(active.activeRaid).toMatchObject({ raidingTeam: 1, startMat: [7, 7], raidClock: { startedAtMs: 200, durationMs: 30000 } });
    expect(remainingTime(active, 30201, 'raid')).toBe(0);
    expect(totals(active)).toEqual([0, 0]);
    expect(active.activeRaid).not.toBeNull();
    expect(remainingTime(active, 1100)).toBe(899000);
  });

  it('pause freezes both clocks and resume uses fresh anchors', () => {
    const before = startRaid(fixture({ mat: [7, 7] }), { id: 'r', atMs: 1000 });
    const paused = pause(before, { atMs: 4000 });
    expect(remainingTime(paused, 9000, 'raid')).toBe(27000);
    expect(remainingTime(paused, 9000)).toBe(1196000);
    expect(() => applyRaid(paused, event('empty'))).toThrow(/playing/);
    const resumed = resume(paused, { atMs: 10000 });
    expect(remainingTime(resumed, 11000, 'raid')).toBe(26000);
    expect(remainingTime(resumed, 11000)).toBe(1195000);
  });

  it('cancel draft has no award, streak, turn or journal effect', () => {
    const before = fixture();
    const cancelled = cancelRaid(startRaid(before, { id: 'cancel' }));
    expect(cancelled).toEqual(before);
  });

  it('first-half pending raid finishes before second half starts', () => {
    const before = fixture({ mat: [7, 7] });
    const pending = timeUp(startRaid(before, { id: 'last-in-first' }));
    expect(pending.phase).toBe('halfPending');
    expect(() => startHalf(pending)).toThrow();
    const resolved = applyRaid(pending, event('touch', { count: 1 }));
    expect(resolved.phase).toBe('halfTime');
    expect(startHalf(resolved).half).toBe(2);
    const restored = undo(resolved);
    expect(gameplay(restored)).toEqual(gameplay(before));
    // The deadline recorded inside the undone raid cannot resurrect its draft.
    expect(undo(restored).activeRaid).toBeNull();
  });

  it('undoing startHalf explicitly reopens half one before an earlier raid', () => {
    const first = applyRaid(fixture({ mat: [7, 7] }), event('touch', { count: 2 }));
    const second = startHalf(timeUp(first));
    const reopened = undo(second);
    expect(reopened).toMatchObject({ half: 1, phase: 'paused', resumePhase: 'halfTime' });
    const beforeDeadline = undo(reopened);
    expect(beforeDeadline).toMatchObject({ half: 1, phase: 'paused', resumePhase: 'playing' });
    expect(totals(undo(beforeDeadline))).toEqual([18, 18]);
  });

  it('undo restores pre-raid remaining time into paused review, with explicit correction', () => {
    const before = fixture({ mat: [7, 7] });
    const active = startRaid(before, { id: 'timed', atMs: 12000 });
    const restored = undo(applyRaid(active, event('empty')));
    expect(remainingTime(restored, 100000)).toBe(1188000);
    const corrected = correctClock(restored, { halfRemainingMs: 1180000, reason: 'referee clock' });
    expect(remainingTime(corrected, 200000)).toBe(1180000);
    expect(corrected.events.at(-1)).toMatchObject({ action: 'correctClock', reason: 'referee clock' });
    expect(remainingTime(resume(corrected, { atMs: 500000 }), 501000)).toBe(1179000);
    expect(resume(undo(corrected), { atMs: 100 }).phase).toBe('playing');
    expect(() => correctClock(before, { halfRemainingMs: 10, reason: 'clock' })).toThrow(/paused/);
  });

  it('technical forfeit at time-up completes the pending half and cancels its raid', () => {
    const before = fixture();
    const pending = timeUp(startRaid(before, { id: 'pending' }));
    expect(() => applyRaid(pending, event('technical', { to: 0, reason: 'replay', turnEffect: 'replay' }))).toThrow(/deadline/);
    const after = applyRaid(pending, event('technical', { to: 1, reason: 'forfeit', turnEffect: 'forfeit' }));
    expect(after.phase).toBe('halfTime');
    expect(after.activeRaid).toBeNull();
    const restored = undo(after);
    expect(restored.activeRaid).toBeNull();
    expect(gameplay(restored)).toEqual(gameplay(before));
  });

  it('undoing a technical replay leaves its prior clock actions independently undoable', () => {
    const draft = startRaid(fixture(), { id: 'replayed' });
    const paused = pause(draft, { atMs: 100 });
    const resumed = resume(paused, { atMs: 200 });
    const replay = applyRaid(resumed, event('technical', { to: 0, reason: 'interruption', turnEffect: 'replay' }));
    const restored = undo(replay);
    expect(gameplay(restored)).toEqual(gameplay(resumed));
    const previous = undo(cancelRaid(restored));
    expect(previous.events.at(-1).targetId).toBe(resumed.events.at(-1).id);
    expect(gameplay(previous)).toEqual(gameplay(paused));
    expect(previous.activeRaid.id).toBe('replayed');
    expect(previous.activeRaid.raidClock.remainingAtAnchorMs).toBe(29900);
  });

  it('supplemental technical awards remain in one raid and do not create extra revivals', () => {
    const before = fixture();
    const after = applyRaid(before, event('touch', { count: 1, technicalAwards: [{ to: 0, reason: 'delay' }, { to: 1, reason: 'conduct' }] }));
    expect(totals(after)).toEqual([20, 19]);
    expect(counts(after)).toEqual([6, 5]);
    expect(after.events.length - before.events.length).toBe(1);
    expect(gameplay(undo(after))).toEqual(gameplay(before));
  });

  it('a restored draft keeps raid-start eligibility; a post-out strength of four still earns a super tackle', () => {
    const active = copy(startRaid(fixture({ mat: [5, 3] }), { id: 'start-three' }));
    const after = applyRaid(active, event('selfOut', { reason: 'clock ruling' }));
    expect(after.teams[1].score.superTackleExtra).toBe(1);
    expect(counts(after)).toEqual([4, 4]);
    expect(() => startRaid(fixture(), { id: 'out-raider', raiderSlotId: 'A7' })).toThrow(/active/);
  });

  it.each([
    ['touch', { count: 2, bonusAwarded: true, bonusBeforeContact: true }],
    ['bonus', { bonusBeforeContact: true }], ['tackled', {}], ['empty', {}],
    ['selfOut', { reason: 'boundary' }], ['defenderOut', { count: 1, reason: 'boundary' }],
    ['technical', { to: 0, reason: 'delay', turnEffect: 'none' }],
    ['mixed', { reason: 'ordered ruling', dismissals: [
      { team: 1, slotId: 'B1', category: 'defenderOut' },
      { team: 0, slotId: 'A1', category: 'tackleBase' },
    ] }],
  ])('undo %s restores the exact gameplay snapshot and retains audit history', (type, extra) => {
    const before = fixture();
    const after = applyRaid(before, event(type, extra));
    const restored = undo(after);
    expect(gameplay(restored)).toEqual(gameplay(before));
    expect(restored.phase).toBe('paused');
    expect(restored.clock.running).toBe(false);
    expect(restored.events.at(-1)).toMatchObject({ type: 'undo', targetId: 'raid-1' });
    expect(restored.revision).toBe(after.revision + 1);
    expect(copy(restored)).toEqual(restored);
    expect(() => applyRaid(restored, event(type, extra))).toThrow(/undone/);
  });

  it('undo includes both teams awards and all-out; next draft must be cancelled', () => {
    const before = fixture({ mat: [1, 6] });
    const after = applyRaid(before, event('tackled', { bonusAwarded: true, bonusBeforeContact: true }));
    expect(() => undo(startRaid(after, { id: 'next' }))).toThrow(/cancel/i);
    expect(gameplay(undo(after))).toEqual(gameplay(before));
  });

  it.each(['tackled', 'selfOut', 'empty'])('undo restores a super-tackle %s including do-or-die counters', (type) => {
    const before = fixture({ mat: [5, 3], streak: [2, 1] });
    const after = applyRaid(before, event(type, { ...(type === 'selfOut' ? { reason: 'cant lost' } : {}) }));
    expect(after.teams[1].score.superTackleExtra).toBe(1);
    expect(gameplay(undo(after))).toEqual(gameplay(before));
    // A second undo steps to an earlier action; it cannot subtract the award twice.
    expect(undo(undo(after)).events.filter((entry) => entry.type === 'undo' && entry.targetId === 'raid-1')).toHaveLength(1);
  });

  it('finished scoring locks, draw is allowed, reopening is explicit', () => {
    let state = startHalf(timeUp(fixture({ mat: [7, 7] })));
    state = finish(timeUp(state));
    expect(result(state)).toMatchObject({ winner: null, draw: true, margin: 0, final: true });
    expect(() => applyRaid(state, event('empty'))).toThrow(/playing/);
    expect(() => undo(state)).toThrow(/reopen/i);
    expect(reopen(state).phase).toBe('finishReview');
  });
});

describe('reject impossible input without mutating state', () => {
  it.each([
    ['touch', { count: 0 }, /count/], ['touch', { count: 8 }, /count/],
    ['touch', { count: 7 }, /defenders/],
    ['touch', { count: 2, outsInOrder: ['B1', 'B1'] }, /duplicate/],
    ['touch', { count: 1, outsInOrder: ['B7'] }, /active/],
    ['touch', { count: 2, outsInOrder: ['B1'] }, /order/],
    ['bonus', { bonusBeforeContact: false }, /contact/],
    ['touch', { count: 1, bonusAwarded: true }, /contact/],
    ['tackled', { count: 1 }, /touch/],
    ['empty', { bonusAwarded: true, bonusBeforeContact: true }, /empty/i],
    ['selfOut', {}, /reason/], ['technical', { to: 0, reason: 'delay' }, /turnEffect/],
    ['allOut', {}, /outcome/], ['card', {}, /outcome/],
    ['empty', { revive: ['bench'] }, /unsupported/i],
  ])('%s rejects %j', (type, extra, message) => {
    const before = fixture();
    const saved = copy(before);
    expect(() => applyRaid(before, event(type, extra))).toThrow(message);
    expect(before).toEqual(saved);
  });

  it('rejects corrupt score, duplicate/missing slots, restrictions and changed profile', () => {
    for (const corrupt of [
      (s) => { s.teams[0].score.touch = -1; },
      (s) => { s.mat[0][1] = s.mat[0][0]; },
      (s) => { s.outQueue[0].pop(); },
      (s) => { s.unavailable[0].push({ slotId: 'A1', kind: 'yellow' }); },
      (s) => { s.rules.halfMs = 1; },
    ]) {
      const state = fixture();
      corrupt(state);
      expect(() => applyRaid(state, event('empty'))).toThrow();
    }
  });

  it('accepts only the selected club profile; future policy options cannot silently fall back', () => {
    for (const options of [{ profile: 'pkl' }, { rosterMode: 'numbered' }, { superTackleOutcomes: 'physicalOnly' }, { halfMs: 0 }]) expect(() => createKabaddiState(options)).toThrow();
    expect(() => applyRaid(fixture(), event('empty', { technicalAwards: [{ to: 0, reason: '' }] }))).toThrow(/reason/);
  });

  it('rejects wrong raider, stale raid identity and duplicate dismissal in mixed ruling', () => {
    const state = startRaid(fixture(), { id: 'r' });
    expect(() => startRaid(fixture(), { id: 'r', team: 1 })).toThrow(/next/);
    expect(() => applyRaid(state, event('empty', { raidId: 'wrong' }))).toThrow(/raidId/);
    expect(() => applyRaid(state, event('mixed', { reason: 'ruling', dismissals: [
      { team: 1, slotId: 'B1', category: 'defenderOut' },
      { team: 1, slotId: 'B1', category: 'defenderOut' },
    ] }))).toThrow(/duplicate/);
  });

  it('all generated legal outcomes preserve slot partition and JSON state', () => {
    let state = startHalf(createKabaddiState());
    for (let i = 0; i < 250; i += 1) {
      const type = ['touch', 'tackled', 'empty', 'selfOut'][i % 4];
      const before = copy(gameplay(state));
      state = applyRaid(state, event(type, { id: `generated-${i}`, ...(type === 'touch' ? { count: 1 + i % state.mat[1 - nextRaider(state)].length } : {}), ...(type === 'selfOut' ? { reason: 'boundary' } : {}) }));
      expect(assertState(state)).toBeUndefined();
      expect(gameplay(undo(state))).toEqual(before);
    }
    // One final round-trip covers the entire journal, including every snapshot.
    expect(copy(state)).toEqual(state);
  });
});

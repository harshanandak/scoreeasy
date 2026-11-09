// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  applyRaid, correctClock, createKabaddiState, editRaidDraft, pause, remainingTime,
  resume, startHalf, startRaid, teamTotal, timeUp, undo,
} from './kabaddiEngine';
import { reopenRaid, undoMatch } from './kabaddiBoardModel';

const copy = value => JSON.parse(JSON.stringify(value));
const landed = () => {
  let state = startHalf(createKabaddiState(), { atMs: 0 });
  state = applyRaid(state, { id: 'earlier', type: 'tackled', atMs: 1000 });
  state = applyRaid(state, { id: 'previous', type: 'empty', atMs: 2000 });
  state = startRaid(state, { id: 'draft', atMs: 3000 });
  state = editRaidDraft(state, { kind: 'mark', slotId: 'B2', mark: 'touched' });
  return { state: applyRaid(state, { id: 'landed', type: 'touch', count: 1, outsInOrder: ['B2'] }), rosters: [[], []] };
};

describe('ordered kabaddi clock Undo', () => {
  it.each([false, true])('steps through resume and pause before reopening the raid, reload=%s', reload => {
    const before = landed();
    let match = { ...before, state: resume(pause(before.state, { atMs: 5000 }), { atMs: 8000 }) };
    const journal = copy(match.state.events);
    if (reload) match = copy(match);
    const resumeId = match.state.events.at(-1).id;
    match = undoMatch(match);
    expect(match.state.events.at(-1).targetId).toBe(resumeId);
    expect(match.state.teams.map(teamTotal)).toEqual([1, 1]);
    expect(match.state.mat).toEqual(before.state.mat);
    expect(match.state.outQueue).toEqual(before.state.outQueue);
    expect(remainingTime(match.state, 9000)).toBe(1195000);
    if (reload) match = copy(match);
    match = undoMatch(match);
    expect(match.state.events.at(-1).targetId).toBe(journal.at(-2).id);
    expect(match.state.teams.map(teamTotal)).toEqual([1, 1]);
    expect(remainingTime(match.state, 10000)).toBe(1195000);
    if (reload) match = copy(match);
    const reopened = reopenRaid(match, { atMs: 11000 });
    expect(reopened).not.toBeNull();
    expect(reopened.state.teams.map(teamTotal)).toEqual([0, 1]);
    expect(reopened.state.mat).toEqual(journal.find(e => e.id === 'landed').before.mat);
    expect(reopened.state.outQueue).toEqual(journal.find(e => e.id === 'landed').before.outQueue);
    expect(reopened.state.activeRaid.draft.marks).toEqual([{ slot: 'B2', kind: 'touched' }]);
    expect(remainingTime(reopened.state, 11000)).toBe(1197000);
    expect(remainingTime(reopened.state, 11000, 'raid')).toBe(30000);
    expect(reopened.state.events.slice(0, journal.length)).toEqual(journal);
    expect(reopened.state.events.filter(e => e.type === 'undo').map(e => e.targetId)).toEqual([resumeId, journal.at(-2).id, 'landed']);
  });

  it('undoing a pause freezes both clocks at the pause boundary', () => {
    const active = startRaid(startHalf(createKabaddiState()), { id: 'active', atMs: 1000 });
    const paused = pause(active, { atMs: 5000 });
    const restored = undo({ ...paused, activeRaid: null });
    expect(remainingTime(restored, 100000)).toBe(1195000);
    expect(remainingTime(restored, 100000, 'raid')).toBe(26000);
    expect(restored.phase).toBe('paused');
    expect(restored.activeRaid.raidClock.running).toBe(false);
  });

  it('undoes correction and deadline events separately without altering the landed raid', () => {
    const before = landed();
    const paused = pause(before.state, { atMs: 5000 });
    const corrected = correctClock(paused, { halfRemainingMs: 900000, reason: 'referee correction' });
    const correctedBack = undoMatch({ ...before, state: corrected });
    expect(correctedBack.state.events.at(-1).targetId).toBe(corrected.events.at(-1).id);
    expect(remainingTime(correctedBack.state, 20000)).toBe(1195000);
    const deadline = timeUp(before.state);
    const deadlineBack = undoMatch({ ...before, state: deadline });
    expect(deadlineBack.state.events.at(-1).targetId).toBe(deadline.events.at(-1).id);
    expect(deadlineBack.state.teams).toEqual(before.state.teams);
    expect(deadlineBack.state.mat).toEqual(before.state.mat);
    expect(deadlineBack.state.resumePhase).toBe('playing');
    expect(deadlineBack.state.clock).toMatchObject({ running: false, remainingAtAnchorMs: before.state.clock.remainingAtAnchorMs });
  });
});

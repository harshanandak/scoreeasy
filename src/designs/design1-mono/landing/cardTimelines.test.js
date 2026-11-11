import { describe, expect, it } from 'vitest';
import { CARDS, MOMENTS, MOMENT_OPACITY, buildTimeline, longestLoop, momentStack } from './cardTimelines';

const byId = (id) => CARDS.find((card) => card.id === id).timeline;
const stateAt = ({ times, states }, ms) => states[times.filter((time) => time <= ms).length - 1];

describe('Home card timelines', () => {
  it('builds a timeline from merged patches in time order', () => {
    const { times, states } = buildTimeline({ a: 1, b: 1 }, [[500, { b: 2 }], [0, { a: 2 }], [500, { c: 3 }]], 900);
    expect(times).toEqual([0, 500]);
    expect(states).toEqual([{ a: 2, b: 1 }, { a: 2, b: 2, c: 3 }]);
  });

  it('has five cards with a title, a picture label and a clock that runs forward', () => {
    expect(CARDS).toHaveLength(5);
    expect(new Set(CARDS.map((card) => card.id)).size).toBe(5);
    for (const card of CARDS) {
      const { times, states, loopMs, still } = card.timeline;
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.label.length).toBeGreaterThan(0);
      expect(times[0]).toBe(0);
      expect(states).toHaveLength(times.length);
      times.slice(1).forEach((time, i) => expect(time).toBeGreaterThan(times[i]));
      expect(loopMs).toBeGreaterThan(times[times.length - 1]);
      expect(still).toBeDefined();
    }
  });

  it('keeps every card to about 8 seconds', () => {
    for (const card of CARDS) expect(card.timeline.loopMs).toBeLessThanOrEqual(8500);
    expect(longestLoop(CARDS)).toBe(Math.max(...CARDS.map((card) => card.timeline.loopMs)));
  });

  it('plays a tennis game by the rules: deuce at 40 all, advantage, then game with the points back to 0-0', () => {
    const tap = byId('tap');
    const calls = tap.states.map((state) => [state.call, state.pa, state.pb, state.ga, state.gb]).filter(([call], i, all) => call !== all[i - 1]?.[0]);
    expect(calls).toEqual([
      ['Love all', '0', '0', '0', '0'], ['15–0', '15', '0', '0', '0'], ['15 all', '15', '15', '0', '0'], ['30–15', '30', '15', '0', '0'], ['30 all', '30', '30', '0', '0'],
      ['40–30', '40', '30', '0', '0'], ['Deuce', '40', '40', '0', '0'], ['Advantage', 'AD', '40', '0', '0'],
      // The app's board: the game is counted and the points start again.
      ['Game Asha', '0', '0', '1', '0'],
    ]);
    expect(tap.still.call).toBe('Deuce');
  });

  it('never shows a letter as a tennis score, in any frame', () => {
    const tap = byId('tap');
    for (const state of [...tap.states, tap.still]) {
      for (const point of [state.pa, state.pb]) expect(['0', '15', '30', '40', 'AD']).toContain(point);
    }
  });

  it('adds the over up: a six tapped by mistake is undone, and the over ends on 12', () => {
    const undo = byId('undo');
    const nums = undo.states.map((state) => state.num).filter((num, i, all) => num !== all[i - 1]);
    expect(nums).toEqual(['0', '1', '5', '11', '5', '7', '8', '12']);
    const last = undo.states[undo.states.length - 1];
    expect(last.status).toBe('Over done');
    expect(last.balls.map((ball) => ball.t)).toEqual(['1', '4', '2', '0', '1', '4']);
    expect(last.balls.every((ball) => ball.on)).toBe(true);
    expect(last.balls.reduce((sum, ball) => sum + Number(ball.t), 0)).toBe(12);
    // The undo shows the six going and the number falling back, rolling the other way.
    const undone = undo.states.find((state) => state.status === 'Undone');
    expect(undone.num).toBe('5');
    expect(undone.dir).toBe(-1);
    // The real over strip is built from the balls that are left, so the undone ball's slot is empty (not a ghost "6").
    expect(undone.balls[2]).toEqual({ t: '', on: false });
    for (const state of undo.states.filter((s) => s.status === 'Undone')) expect(state.balls.map((ball) => ball.t)).not.toContain('6');
    expect(undo.still.balls[2]).toEqual({ t: '', on: false });
  });

  it('keeps two goals back while there is no signal, then delivers both', () => {
    const live = byId('live');
    const dark = live.states.filter((state) => state.off);
    expect(dark.length).toBeGreaterThan(0);
    // With no signal the friend's phone stays on 1 while the scorer's phone reaches 3.
    expect(dark.map((state) => [state.na, state.nb]).pop()).toEqual(['3', '1']);
    expect(dark.every((state) => state.nb === '1')).toBe(true);
    const end = live.states[live.states.length - 1];
    expect([end.na, end.nb, end.chip]).toEqual(['3', '3', 'Full time']);
    expect(stateAt(live, 0).on).toBe(false);
  });

  it('steps a stack of moments: four on show, newest on top, a fifth waiting above and one leaving below', () => {
    for (let tick = 0; tick < 12; tick += 1) {
      const stack = momentStack(tick);
      expect(stack.map(({ card }) => card).sort()).toEqual([0, 1, 2, 3, 4, 5]);
      expect(stack.map(({ slot }) => slot).sort((a, b) => a - b)).toEqual([-1, 0, 1, 2, 3, 4]);
      for (const { slot } of stack) expect(MOMENT_OPACITY[slot]).toBeDefined();
      const shown = stack.filter(({ slot }) => slot >= 0 && slot <= 3).sort((a, b) => a.slot - b.slot);
      // Newest first: each step down the stack is the moment before.
      const index = (moment) => MOMENTS.indexOf(moment);
      shown.slice(1).forEach(({ moment }, i) => expect((index(moment) + 1) % MOMENTS.length).toBe(index(shown[i].moment)));
    }
    expect(momentStack(0).filter(({ slot }) => slot >= 0 && slot <= 3).sort((a, b) => b.slot - a.slot).map(({ moment }) => moment[1]))
      .toEqual(['Deuce', 'Need 12 off 8', 'Set point', '20 all']);
  });

  it('says what the page shows: nine sports, one moment each, and the all-out line names who scores', () => {
    expect(CARDS.find((card) => card.id === 'moments').title).toBe('Nine sports. The rules built in.');
    expect(new Set(MOMENTS.map(([sportId]) => sportId)).size).toBe(9);
    expect(MOMENTS.find(([sportId]) => sportId === 'kabaddi').slice(1)).toEqual(['All out', 'Two bonus points to the raiding side.']);
    const visibleSports = new Set(byId('moments').states.flatMap(({ tick }) => momentStack(tick)
      .filter(({ slot }) => slot >= 0 && slot <= 3).map(({ moment }) => moment[0])));
    expect(visibleSports.size).toBe(9);
  });

  it('has a card that comes back in at the top with the next moment, out of sight', () => {
    const before = momentStack(1);
    const after = momentStack(2);
    for (const { card, slot, moment } of after) {
      const was = before.find((entry) => entry.card === card);
      if (slot === -1) {
        expect(was.slot).toBe(4);
        expect(moment).not.toBe(was.moment);
      } else {
        expect(slot).toBe(was.slot + 1);
        expect(moment).toBe(was.moment);
      }
    }
  });

  it('wipes the scoresheet into the app at Need 12 off 8, then one six makes it Need 6 off 7', () => {
    const paper = byId('paper');
    expect(paper.states[0]).toMatchObject({ mode: '', hit: false, need: 'Need 12 off 8' });
    const app = paper.states.find((state) => state.mode === 'app');
    expect(app.need).toBe('Need 12 off 8');
    const hit = paper.states.find((state) => state.hit);
    expect(hit).toMatchObject({ mode: 'app', need: 'Need 6 off 7', foot: 'Australia 170/6 · target 176' });
    expect(paper.states[paper.states.length - 1]).toMatchObject({ mode: 'exit', left: true });
    expect(paper.still).toMatchObject({ mode: 'app', need: 'Need 12 off 8' });
  });
});

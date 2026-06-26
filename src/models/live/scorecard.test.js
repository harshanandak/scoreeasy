import { describe, expect, it } from 'vitest';
import { appendPoint, appendUndo } from './scoringEvents';
import {
  statHeader,
  segmentSummary,
  currentRun,
  leaderStrip,
  differential,
} from './scorecard';

/**
 * Builds a point stream from a compact spec of [team, value?, at?] tuples.
 */
function build(spec) {
  let events = [];
  for (const [team, value = 1, at] of spec) {
    events = appendPoint(events, { team, value, at });
  }
  return events;
}

// ─── statHeader ──────────────────────────────────────────────────────────────

describe('statHeader', () => {
  it('returns an empty-stream shape with nulls and zeros', () => {
    expect(statHeader([])).toEqual({
      leader: null,
      margin: 0,
      score: { a: 0, b: 0 },
      leadChanges: 0,
      timesTied: 0,
      largestLead: { team: null, value: 0, at: null },
      biggestRun: { team: null, len: 0 },
      scoringRatePerMin: 0,
      lastScore: null,
    });
  });

  it('reports leader, margin and score', () => {
    const header = statHeader(build([['A'], ['A'], ['B']]));
    expect(header.leader).toBe('A');
    expect(header.margin).toBe(1);
    expect(header.score).toEqual({ a: 2, b: 1 });
  });

  it('reports a tie with a null leader and zero margin', () => {
    const header = statHeader(build([['A'], ['B']]));
    expect(header.leader).toBeNull();
    expect(header.margin).toBe(0);
  });

  it('counts lead changes, ignoring passes through a tie', () => {
    // A leads (1-0) -> tie (1-1) -> B leads (1-2): exactly ONE lead change
    const header = statHeader(build([['A'], ['B'], ['B']]));
    expect(header.leadChanges).toBe(1);
  });

  it('counts every time the score becomes tied', () => {
    // 1-0, 1-1 (tie #1), 2-1, 2-2 (tie #2)
    const header = statHeader(build([['A'], ['B'], ['A'], ['B']]));
    expect(header.timesTied).toBe(2);
  });

  it('tracks the largest lead with the team and timestamp it occurred', () => {
    const header = statHeader(build([['A', 1, 10], ['A', 1, 20], ['A', 1, 30], ['B', 1, 40]]));
    expect(header.largestLead).toEqual({ team: 'A', value: 3, at: 30 });
  });

  it('tracks the biggest run as consecutive points by one team (in points, not events)', () => {
    // A scores 5 then 3 (+N) unanswered = run of 8, then B scores
    const header = statHeader(build([['A', 5, 1], ['A', 3, 2], ['B', 1, 3]]));
    expect(header.biggestRun).toEqual({ team: 'A', len: 8 });
  });

  it('computes scoring rate per minute from timestamps', () => {
    // 4 points over 2 minutes (120000 ms) = 2 / min
    const header = statHeader(build([['A', 1, 0], ['B', 1, 40000], ['A', 1, 80000], ['A', 1, 120000]]));
    expect(header.scoringRatePerMin).toBeCloseTo(2, 5);
  });

  it('returns a zero scoring rate when timestamps are missing or span zero', () => {
    expect(statHeader(build([['A'], ['B']])).scoringRatePerMin).toBe(0);
    expect(statHeader(build([['A', 1, 5], ['B', 1, 5]])).scoringRatePerMin).toBe(0);
  });

  it('exposes the last scoring event', () => {
    const header = statHeader(build([['A'], ['B', 3]]));
    expect(header.lastScore).toEqual({ team: 'B', value: 3 });
  });

  it('reflects an undo in every derived stat', () => {
    let events = build([['A'], ['B']]); // 1-1 tie
    events = appendUndo(events, { at: 99 }); // reverse B -> 1-0
    const header = statHeader(events);
    expect(header.leader).toBe('A');
    expect(header.score).toEqual({ a: 1, b: 0 });
    expect(header.timesTied).toBe(0); // the tie was undone away
  });

  // UNDO POLICY: a reversed point's transient state is erased from summary
  // stats. These pin leadChanges / largestLead / biggestRun under undo so the
  // siblings cannot silently diverge from timesTied.
  it('does not count a lead change that an undo erased', () => {
    // A(1-0) -> A(2-0) -> B... actually take B ahead then undo it back.
    // 1-0, 1-1, 1-2 (B leads = ONE change), undo -> 1-1: the lead change is gone.
    let events = build([['A', 1, 1], ['B', 1, 2], ['B', 1, 3]]);
    expect(statHeader(events).leadChanges).toBe(1);
    events = appendUndo(events, { at: 4 }); // reverse B's go-ahead point -> 1-1
    expect(statHeader(events).leadChanges).toBe(0);
  });

  it('does not count a largest lead or run that an undo erased', () => {
    // A surges to +3 then the surge is undone back to +2.
    let events = build([['A', 1, 1], ['A', 1, 2], ['A', 1, 3]]); // 3-0, lead 3, run 3
    expect(statHeader(events).largestLead).toEqual({ team: 'A', value: 3, at: 3 });
    expect(statHeader(events).biggestRun).toEqual({ team: 'A', len: 3 });
    events = appendUndo(events, { at: 4 }); // -> 2-0
    const header = statHeader(events);
    expect(header.largestLead).toEqual({ team: 'A', value: 2, at: 2 });
    expect(header.biggestRun).toEqual({ team: 'A', len: 2 });
  });
});

// ─── segmentSummary ──────────────────────────────────────────────────────────

describe('segmentSummary', () => {
  it('returns zeroed rows with a caption for an empty stream', () => {
    const summary = segmentSummary([]);
    expect(summary.rows).toHaveLength(2);
    expect(summary.rows.every(r => r.total === 0)).toBe(true);
    expect(typeof summary.caption).toBe('string');
    expect(summary.caption.length).toBeGreaterThan(0);
  });

  it('buckets by equal time when usable timestamps exist', () => {
    // span 0..400; 4 segments of 100 each
    const events = build([
      ['A', 1, 0],    // seg 0
      ['B', 1, 50],   // seg 0
      ['A', 1, 150],  // seg 1
      ['A', 1, 250],  // seg 2
      ['B', 1, 399],  // seg 3
    ]);
    const summary = segmentSummary(events, { segments: 4 });
    expect(summary.mode).toBe('time');
    const teamA = summary.rows.find(r => r.team === 'A');
    const teamB = summary.rows.find(r => r.team === 'B');
    expect(teamA.perSegment).toEqual([1, 1, 1, 0]);
    expect(teamB.perSegment).toEqual([1, 0, 0, 1]);
    expect(teamA.total).toBe(3);
    expect(teamB.total).toBe(2);
    expect(summary.caption).toMatch(/4/);
  });

  it('clamps the final-timestamp event into the last bucket', () => {
    // at === end must not overflow into a 5th bucket
    const events = build([['A', 1, 0], ['B', 1, 100]]);
    const summary = segmentSummary(events, { segments: 4 });
    expect(summary.rows.every(r => r.perSegment.length === 4)).toBe(true);
    const teamB = summary.rows.find(r => r.team === 'B');
    expect(teamB.perSegment[3]).toBe(1);
  });

  it('falls back to equal-count buckets when timestamps are absent', () => {
    const events = build([['A'], ['A'], ['B'], ['B']]); // no `at`
    const summary = segmentSummary(events, { segments: 2 });
    expect(summary.mode).toBe('count');
    const teamA = summary.rows.find(r => r.team === 'A');
    const teamB = summary.rows.find(r => r.team === 'B');
    expect(teamA.perSegment).toEqual([2, 0]);
    expect(teamB.perSegment).toEqual([0, 2]);
    expect(summary.caption).toMatch(/count|points/i);
  });

  it('falls back to count mode when all timestamps are identical (zero span)', () => {
    const events = build([['A', 1, 7], ['B', 1, 7]]);
    expect(segmentSummary(events, { segments: 2 }).mode).toBe('count');
  });

  it('sums custom +N values per segment', () => {
    const events = build([['A', 5], ['A', 2], ['B', 3]]); // count mode
    const summary = segmentSummary(events, { segments: 1 });
    const teamA = summary.rows.find(r => r.team === 'A');
    expect(teamA.perSegment).toEqual([7]);
    expect(teamA.total).toBe(7);
  });
});

// ─── currentRun ──────────────────────────────────────────────────────────────

describe('currentRun', () => {
  it('returns an empty run for an empty stream', () => {
    expect(currentRun([])).toEqual({ team: null, len: 0 });
  });

  it('counts consecutive points by the most recent scorer (in points)', () => {
    const run = currentRun(build([['B'], ['A', 5], ['A', 3]]));
    expect(run).toEqual({ team: 'A', len: 8 });
  });

  it('resets the run when the opponent scores', () => {
    const run = currentRun(build([['A'], ['A'], ['B']]));
    expect(run).toEqual({ team: 'B', len: 1 });
  });

  it('drops an undone point from the current run', () => {
    // A, A, B then undo B -> the surviving run is A's 2 unanswered points.
    let events = build([['A'], ['A'], ['B']]);
    events = appendUndo(events, { at: 9 });
    expect(currentRun(events)).toEqual({ team: 'A', len: 2 });
  });
});

// ─── leaderStrip ─────────────────────────────────────────────────────────────

describe('leaderStrip', () => {
  it('splits shares 0.5/0.5 with no leader for an empty stream', () => {
    expect(leaderStrip([])).toEqual({ leaderTeam: null, aShare: 0.5, bShare: 0.5, margin: 0 });
  });

  it('computes proportional shares and the leader', () => {
    const strip = leaderStrip(build([['A'], ['A'], ['A'], ['B']])); // 3-1
    expect(strip.leaderTeam).toBe('A');
    expect(strip.aShare).toBeCloseTo(0.75, 5);
    expect(strip.bShare).toBeCloseTo(0.25, 5);
    expect(strip.margin).toBe(2);
  });

  it('reports no leader on a tie', () => {
    const strip = leaderStrip(build([['A'], ['B']]));
    expect(strip.leaderTeam).toBeNull();
    expect(strip.margin).toBe(0);
  });
});

// ─── differential ────────────────────────────────────────────────────────────

describe('differential', () => {
  it('returns a zero differential with no leader for an empty stream', () => {
    expect(differential([])).toEqual({ leaderTeam: null, value: 0 });
  });

  it('returns the leader and the absolute point gap', () => {
    expect(differential(build([['A'], ['A'], ['B']]))).toEqual({ leaderTeam: 'A', value: 1 });
  });

  it('returns a zero value with no leader when tied', () => {
    expect(differential(build([['A'], ['B']]))).toEqual({ leaderTeam: null, value: 0 });
  });
});

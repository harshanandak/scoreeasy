import { describe, it, expect } from 'vitest';
import { matchVerdict } from './matchVerdict';

// matchVerdict is a pure, engine-agnostic helper that turns a completed match
// object (sets / goals / cricket shapes) into a plain-language result used by
// the MonoMatchResult screen. These cases pin the headline phrasing, winner
// resolution, primary score line, and per-unit line score across every engine
// plus the honest edge states (draw, tie, abandoned, undecided).

describe('matchVerdict — sets engine', () => {
  const setsMatch = {
    kind: 'sets',
    team1: 'Alpha',
    team2: 'Beta',
    score1: 3,
    score2: 1,
    winnerSide: 'team1',
    sets: [
      { score1: 25, score2: 20, completed: true },
      { score1: 20, score2: 25, completed: true },
      { score1: 25, score2: 18, completed: true },
      { score1: 25, score2: 22, completed: true },
    ],
  };

  it('phrases the winner with sets-won, winner first', () => {
    const v = matchVerdict(setsMatch);
    expect(v.headline).toBe('Alpha win 3–1');
    expect(v.winnerSide).toBe('team1');
    expect(v.winnerName).toBe('Alpha');
    expect(v.isDecided).toBe(true);
    expect(v.isDraw).toBe(false);
    expect(v.status).toBe('completed');
  });

  it('exposes the primary score line and unit', () => {
    const v = matchVerdict(setsMatch);
    expect(v.scoreLine).toBe('3 – 1');
    expect(v.detailLabel).toBe('sets');
  });

  it('builds a per-set line score with en dashes', () => {
    const v = matchVerdict(setsMatch);
    expect(v.lineScore).toEqual(['25–20', '20–25', '25–18', '25–22']);
  });

  it('orders the winner score first even when team2 wins', () => {
    const v = matchVerdict({ ...setsMatch, score1: 1, score2: 3, winnerSide: 'team2' });
    expect(v.headline).toBe('Beta win 3–1');
    expect(v.winnerName).toBe('Beta');
  });

  it('drops not-yet-played sets from the line score', () => {
    const v = matchVerdict({
      ...setsMatch,
      sets: [
        { score1: 25, score2: 20, completed: true },
        { score1: 0, score2: 0, completed: false },
      ],
    });
    expect(v.lineScore).toEqual(['25–20']);
  });
});

describe('matchVerdict — goals engine', () => {
  it('phrases a win by margin', () => {
    const v = matchVerdict({ kind: 'goals', team1: 'Reds', team2: 'Blues', score1: 21, score2: 7, winnerSide: 'team1' });
    expect(v.headline).toBe('Reds win by 14');
    expect(v.scoreLine).toBe('21 – 7');
    expect(v.detailLabel).toBe('goals');
    expect(v.lineScore).toEqual([]);
  });

  it('reports a draw honestly', () => {
    const v = matchVerdict({ kind: 'goals', team1: 'Reds', team2: 'Blues', score1: 2, score2: 2, winnerSide: 'draw' });
    expect(v.headline).toBe('Match drawn');
    expect(v.isDraw).toBe(true);
    expect(v.isDecided).toBe(false);
    expect(v.winnerSide).toBe('draw');
    expect(v.winnerName).toBe(null);
  });

  it('infers the winner from scores when winnerSide is omitted', () => {
    const v = matchVerdict({ kind: 'goals', team1: 'A', team2: 'B', score1: 5, score2: 3 });
    expect(v.winnerSide).toBe('team1');
    expect(v.headline).toBe('A win by 2');
  });
});

describe('matchVerdict — cricket engine', () => {
  const cricket = {
    kind: 'cricket',
    team1: 'Lions',
    team2: 'Tigers',
    team1Score: { runs: 142, wickets: 6, balls: 120 },
    team2Score: { runs: 100, wickets: 10, balls: 98 },
    winnerSide: 'team1',
    winDesc: 'by 42 runs',
  };

  it('uses the win description when provided', () => {
    const v = matchVerdict(cricket);
    expect(v.headline).toBe('Lions won by 42 runs');
    expect(v.winnerName).toBe('Lions');
    expect(v.detailLabel).toBe('runs');
  });

  it('summarises each innings as runs/wickets', () => {
    const v = matchVerdict(cricket);
    expect(v.scoreLine).toBe('142 – 100');
    expect(v.lineScore).toEqual(['Lions 142/6', 'Tigers 100/10']);
  });

  // The engines persist winDesc as a FULL phrase ("Won by 42 runs" from
  // getLimitedOversResult / getTestMatchResult) — NOT the bare "by 42 runs"
  // fragment. Composing "<winner> won <winDesc>" naively double-wraps to
  // "Lions won Won by 42 runs". The headline must read "Lions won by 42 runs".
  it('does not double-wrap a full "Won by ..." win description (limited overs)', () => {
    const v = matchVerdict({
      kind: 'cricket',
      team1: 'Lions',
      team2: 'Tigers',
      team1Score: { runs: 142, wickets: 6, balls: 120 },
      team2Score: { runs: 100, wickets: 10, balls: 98 },
      winnerSide: 'team1',
      winDesc: 'Won by 42 runs',
    });
    expect(v.headline).toBe('Lions won by 42 runs');
    expect(v.headline).not.toContain('won Won');
  });

  it('handles a "Won by N wickets" chase description', () => {
    const v = matchVerdict({
      kind: 'cricket',
      team1: 'Lions',
      team2: 'Tigers',
      team1Score: { runs: 100, wickets: 10, balls: 120 },
      team2Score: { runs: 101, wickets: 4, balls: 90 },
      winnerSide: 'team2',
      winDesc: 'Won by 6 wickets',
    });
    expect(v.headline).toBe('Tigers won by 6 wickets');
  });

  it('handles a "Won by an innings and N runs" test description', () => {
    const v = matchVerdict({
      kind: 'cricket',
      team1: 'England',
      team2: 'Australia',
      team1Id: 't1',
      team2Id: 't2',
      innings: [
        { teamId: 't1', runs: 500, wickets: 10, balls: 900 },
        { teamId: 't2', runs: 200, wickets: 10, balls: 500 },
        { teamId: 't2', runs: 220, wickets: 10, balls: 520 },
      ],
      winnerSide: 'team1',
      winDesc: 'Won by an innings and 80 runs',
    });
    expect(v.headline).toBe('England won by an innings and 80 runs');
    expect(v.headline).not.toContain('won Won');
  });

  it('still composes a headline from a bare fragment win description', () => {
    const v = matchVerdict({ ...cricket, winDesc: 'by 42 runs' });
    expect(v.headline).toBe('Lions won by 42 runs');
  });
});

describe('matchVerdict — cricket shape (derived totals)', () => {
  // Regression: the cricket engines persist team1Score/team2Score (runs) — NOT a
  // duplicated score1/score2. When winnerSide is absent the verdict must be
  // inferred from the innings runs, and the aria/score line must report those
  // runs. Reading score1/score2 alone yields 0–0 → a wrong draw/undecided verdict
  // for a 142–100 win. (CodeRabbit #128, matchVerdict.js resolveWinner/ariaSummary.)
  it('infers the winner from innings runs when winnerSide is omitted (limited overs)', () => {
    const v = matchVerdict({
      kind: 'cricket',
      team1: 'Lions',
      team2: 'Tigers',
      team1Score: { runs: 142, wickets: 6, balls: 120 },
      team2Score: { runs: 100, wickets: 10, balls: 98 },
    });
    expect(v.winnerSide).toBe('team1');
    expect(v.winnerName).toBe('Lions');
    expect(v.isDecided).toBe(true);
    expect(v.isDraw).toBe(false);
    expect(v.headline).toBe('Lions won by 42 runs');
    expect(v.scoreLine).toBe('142 – 100');
  });

  it('reports the real innings runs in the aria summary, never 0–0', () => {
    const v = matchVerdict({
      kind: 'cricket',
      team1: 'Lions',
      team2: 'Tigers',
      team1Score: { runs: 142, wickets: 6, balls: 120 },
      team2Score: { runs: 100, wickets: 10, balls: 98 },
      winnerSide: 'team1',
      winDesc: 'by 42 runs',
    });
    expect(v.ariaSummary).toContain('Lions 142');
    expect(v.ariaSummary).toContain('Tigers 100');
    expect(v.ariaSummary).not.toContain('Lions 0');
    expect(v.ariaSummary).not.toContain('Tigers 0');
  });

  it('infers a team2 chase win from innings runs', () => {
    const v = matchVerdict({
      kind: 'cricket',
      team1: 'Lions',
      team2: 'Tigers',
      team1Score: { runs: 100, wickets: 10, balls: 120 },
      team2Score: { runs: 101, wickets: 4, balls: 118 },
    });
    expect(v.winnerSide).toBe('team2');
    expect(v.winnerName).toBe('Tigers');
    expect(v.headline).toBe('Tigers won by 1 runs');
  });

  it('aggregates a test-cricket innings array (keyed by teamId) into a verdict', () => {
    const v = matchVerdict({
      kind: 'cricket',
      team1: 'England',
      team2: 'Australia',
      team1Id: 't1',
      team2Id: 't2',
      innings: [
        { teamId: 't1', runs: 300, wickets: 10, balls: 540 },
        { teamId: 't2', runs: 250, wickets: 10, balls: 500 },
        { teamId: 't1', runs: 180, wickets: 6, balls: 300 },
        { teamId: 't2', runs: 150, wickets: 10, balls: 400 },
      ],
      winDesc: 'by 80 runs',
    });
    expect(v.winnerSide).toBe('team1');
    expect(v.winnerName).toBe('England');
    expect(v.scoreLine).toBe('480 – 400');
    expect(v.ariaSummary).toContain('England 480');
    expect(v.ariaSummary).toContain('Australia 400');
  });
});

describe('matchVerdict — edge states', () => {
  it('reports an abandoned match', () => {
    const v = matchVerdict({ team1: 'A', team2: 'B', status: 'abandoned' });
    expect(v.headline).toBe('Match abandoned');
    expect(v.isDecided).toBe(false);
    expect(v.isDraw).toBe(false);
    expect(v.winnerSide).toBe('none');
    expect(v.status).toBe('abandoned');
  });

  it('reports a tie', () => {
    const v = matchVerdict({ kind: 'cricket', team1: 'A', team2: 'B', score1: 100, score2: 100, winnerSide: 'tie' });
    expect(v.headline).toBe('Match tied');
    expect(v.isDraw).toBe(true);
    expect(v.winnerSide).toBe('draw');
  });

  it('falls back to FULL TIME when no winner can be resolved', () => {
    const v = matchVerdict({ kind: 'sets', team1: 'A', team2: 'B', score1: 0, score2: 0 });
    expect(v.headline).toBe('Full time');
    expect(v.winnerSide).toBe('none');
    expect(v.isDecided).toBe(false);
  });

  it('defaults missing team names', () => {
    const v = matchVerdict({ kind: 'goals', score1: 3, score2: 1, winnerSide: 'team1' });
    expect(v.winnerName).toBe('Team 1');
    expect(v.headline).toBe('Team 1 win by 2');
  });

  it('produces an aria summary sentence', () => {
    const v = matchVerdict({ kind: 'goals', team1: 'Reds', team2: 'Blues', score1: 21, score2: 7, winnerSide: 'team1' });
    expect(v.ariaSummary).toContain('Reds win by 14');
    expect(v.ariaSummary).toContain('Reds 21');
    expect(v.ariaSummary).toContain('Blues 7');
  });

  it('returns a safe verdict for a null match', () => {
    const v = matchVerdict(null);
    expect(v.headline).toBe('Full time');
    expect(v.isDecided).toBe(false);
    expect(v.winnerSide).toBe('none');
  });
});

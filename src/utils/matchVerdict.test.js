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

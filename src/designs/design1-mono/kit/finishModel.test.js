import { describe, expect, it } from 'vitest';
import { finishFromQuickResult, finishFromVerdict, formatDuration, setChips } from './finishModel';
import { matchVerdict } from '../../../utils/matchVerdict';

// Every sport's Finish must say what the board said (AGENTS.md: the board stays truthful).

describe('finishFromQuickResult: sets sports (volleyball, badminton, table tennis)', () => {
  const result = {
    team1: 'Royals', team2: 'Strikers', score1: 3, score2: 1, setsWon1: 3, setsWon2: 1, winner: 'Royals',
    sets: [
      { score1: 25, score2: 21, completed: true }, { score1: 22, score2: 25, completed: true },
      { score1: 25, score2: 19, completed: true }, { score1: 25, score2: 23, completed: true },
    ],
  };

  it('names the winner, the last set and one chip per set in board order', () => {
    const m = finishFromQuickResult(result, { kind: 'sets' });
    expect(m).toMatchObject({ outcome: 'win', winnerSide: 'team1', headline: 'Royals', detail: 'Took the last set 25–23' });
    expect(m.team2).toEqual({ name: 'Strikers', score: '1', unit: null });
    expect(m.chips.map((c) => [c.label, c.score, c.side])).toEqual([
      ['Set 1', '25–21', 'team1'], ['Set 2', '22–25', 'team2'], ['Set 3', '25–19', 'team1'], ['Set 4', '25–23', 'team1'],
    ]);
    expect(m.ariaSummary).toBe('Royals won. Took the last set 25–23. Royals 3, Strikers 1.');
  });

  it('reads a team 2 win from the scores, winner-first in the detail', () => {
    const m = finishFromQuickResult({
      team1: 'A', team2: 'B', score1: 0, score2: 2, winner: 'B',
      sets: [{ score1: 19, score2: 25, completed: true }, { score1: 23, score2: 25, completed: true }],
    }, { kind: 'sets' });
    expect(m).toMatchObject({ winnerSide: 'team2', headline: 'B', detail: 'Took the last set 25–23' });
  });

  it('keeps a manual Finish mid-set honest: the open set is a chip but not "the last set"', () => {
    const m = finishFromQuickResult({
      team1: 'A', team2: 'B', score1: 1, score2: 0, winner: 'A',
      sets: [{ score1: 25, score2: 20, completed: true }, { score1: 12, score2: 14, completed: false }],
    }, { kind: 'sets' });
    expect(m.chips.map((c) => c.score)).toEqual(['25–20', '12–14']);
    expect(m.detail).toBe('Took the last set 25–20');
  });

  it('a single set to a target has no sets array and no chips', () => {
    const m = finishFromQuickResult({ team1: 'A', team2: 'B', score1: 15, score2: 12, winner: 'A' }, { kind: 'sets' });
    expect(m).toMatchObject({ outcome: 'win', winnerSide: 'team1', detail: null, chips: [] });
  });

  it('a manual Finish level on sets is a tie, not a winner', () => {
    const m = finishFromQuickResult({ team1: 'A', team2: 'B', score1: 10, score2: 10, winner: 'Tie', sets: [] }, { kind: 'sets' });
    expect(m).toMatchObject({ outcome: 'draw', winnerSide: null, headline: 'Match tied' });
  });
});

describe('finishFromQuickResult: goals sports', () => {
  it('a football draw has no winner', () => {
    const m = finishFromQuickResult({ team1: 'City', team2: 'United', score1: 1, score2: 1, winner: 'Draw' }, { kind: 'goals', unit: 'goal' });
    expect(m).toMatchObject({ outcome: 'draw', winnerSide: null, headline: 'Match drawn', chips: [] });
    expect(m.ariaSummary).toBe('Match drawn. City 1, United 1.');
  });

  it('a win carries the margin in the sport unit', () => {
    expect(finishFromQuickResult({ team1: 'A', team2: 'B', score1: 2, score2: 1, winner: 'A' }, { kind: 'goals', unit: 'goal' }).detail)
      .toBe('Won by 1 goal');
    expect(finishFromQuickResult({ team1: 'A', team2: 'B', score1: 40, score2: 52, winner: 'B' }, { kind: 'goals', unit: 'point' }))
      .toMatchObject({ winnerSide: 'team2', detail: 'Won by 12 points' });
  });
});

describe('finishFromQuickResult: limited-overs cricket (team 1 bats first in a quick match)', () => {
  const t1 = { runs: 164, wickets: 6, balls: 120 };

  it('a successful chase wins by wickets, not runs', () => {
    const m = finishFromQuickResult({ team1: 'Lions', team2: 'Tigers', team1Score: t1, team2Score: { runs: 165, wickets: 7, balls: 112 } },
      { kind: 'cricket', maxWickets: 10 });
    expect(m).toMatchObject({ outcome: 'win', winnerSide: 'team2', headline: 'Tigers', detail: 'Won by 3 wickets' });
    expect(m.team2).toEqual({ name: 'Tigers', score: '165/7', unit: '18.4 ov' });
    expect(m.team1).toEqual({ name: 'Lions', score: '164/6', unit: '20 ov' });
  });

  it('defending a total wins by runs', () => {
    const m = finishFromQuickResult({ team1: 'Lions', team2: 'Tigers', team1Score: t1, team2Score: { runs: 150, wickets: 10, balls: 117 } },
      { kind: 'cricket', maxWickets: 10 });
    expect(m).toMatchObject({ winnerSide: 'team1', detail: 'Won by 14 runs' });
  });

  it("uses the quick scorer's own all-out count (gully: 6 players, last man stands)", () => {
    const m = finishFromQuickResult({ team1: 'A', team2: 'B', team1Score: { runs: 30, wickets: 6, balls: 30 }, team2Score: { runs: 31, wickets: 2, balls: 20 } },
      { kind: 'cricket', maxWickets: 6 });
    expect(m.detail).toBe('Won by 4 wickets');
  });

  it('level scores are a tie', () => {
    const m = finishFromQuickResult({ team1: 'A', team2: 'B', team1Score: t1, team2Score: { runs: 164, wickets: 9, balls: 120 } },
      { kind: 'cricket', maxWickets: 10 });
    expect(m).toMatchObject({ outcome: 'draw', headline: 'Match tied', winnerSide: null });
  });
});

describe('finishFromVerdict: tournament sets results', () => {
  it('tennis sets with a tiebreak: games in board order, tiebreak points shown, winner from the sets', () => {
    const sets = [
      { score1: 6, score2: 4, completed: true }, { score1: 3, score2: 6, completed: true },
      { score1: 6, score2: 6, tiebreakPoints1: 5, tiebreakPoints2: 7, isTiebreak: true, completed: true },
    ];
    const verdict = matchVerdict({ kind: 'sets', team1: 'Anya', team2: 'Ravi', winnerSide: 'team2', sets });
    const m = finishFromVerdict(verdict, { team1Name: 'Anya', team2Name: 'Ravi', sets });
    expect(m).toMatchObject({ outcome: 'win', winnerSide: 'team2', headline: 'Ravi', detail: 'Took the last set 6–6' });
    expect(m.team1.score).toBe('1');
    expect(m.team2.score).toBe('2');
    expect(m.chips.map((c) => [c.score, c.side])).toEqual([['6–4', 'team1'], ['3–6', 'team2'], ['6–6 (5–7)', 'team2']]);
  });

  it('an abandoned match has no result', () => {
    const verdict = matchVerdict({ kind: 'sets', status: 'abandoned', team1: 'A', team2: 'B' });
    expect(finishFromVerdict(verdict, { team1Name: 'A', team2Name: 'B' })).toMatchObject({ outcome: 'none', headline: 'Match abandoned' });
  });
});

describe('helpers', () => {
  it('setChips skips unplayed sets', () => {
    expect(setChips([{ score1: 0, score2: 0, completed: false }])).toEqual([]);
    expect(setChips(null)).toEqual([]);
  });

  it('formatDuration', () => {
    expect(formatDuration(4320)).toBe('1h 12m');
    expect(formatDuration(1080)).toBe('18m');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(0)).toBeNull();
  });
});

describe('quick tennis result', () => {
  it('shows completed games and tiebreak points in board order, omitting the unplayed set', () => {
    const m = finishFromQuickResult({ team1Name: 'Ana', team2Name: 'Bea', score1: 2, score2: 0, sets: [
      { games1: 6, games2: 4, completed: true },
      { games1: 7, games2: 6, isTiebreak: true, tiebreakPoints1: 8, tiebreakPoints2: 6, completed: true },
      { games1: 0, games2: 0, completed: false },
    ] }, { kind: 'sets' });
    expect(m).toMatchObject({ winnerSide: 'team1', headline: 'Ana', team1: { score: '2' }, team2: { score: '0' } });
    expect(m.chips.map(c => [c.score, c.side])).toEqual([['6–4', 'team1'], ['7–6 (8–6)', 'team1']]);
    expect(m.detail).toBe('Took the last set 7–6');
  });
});

describe('quick Test cricket result', () => {
  const inn = (teamId, runs, wickets = 10) => ({ teamId, runs, wickets, balls: 60, allOut: wickets === 10 });
  const result = (innings, extra = {}) => ({
    team1: 'Alpha', team2: 'Beta', team1Id: 'A', team2Id: 'B', status: 'completed',
    format: { preset: 'test', totalInnings: 4, players: 11 }, innings,
    currentInningsIndex: 3, ...extra,
  });

  it('shows each innings and a chase margin in wickets', () => {
    const m = finishFromQuickResult(result([inn('A', 200), inn('B', 180), inn('A', 100), inn('B', 121, 3)]), { kind: 'cricket' });
    expect(m).toMatchObject({ outcome: 'win', winnerSide: 'team2', headline: 'Beta', detail: 'Won by 7 wickets' });
    expect(m.team1).toEqual({ name: 'Alpha', score: '200/all & 100/all', unit: 'innings' });
    expect(m.team2).toEqual({ name: 'Beta', score: '180/all & 121/3', unit: 'innings' });
    expect(m.ariaSummary).toContain('Alpha 200/all & 100/all, Beta 180/all & 121/3.');
  });

  it('shows a defended target as a runs margin', () => {
    expect(finishFromQuickResult(result([inn('A', 200), inn('B', 180), inn('A', 100), inn('B', 90)]), { kind: 'cricket' }))
      .toMatchObject({ outcome: 'win', winnerSide: 'team1', detail: 'Won by 30 runs' });
  });

  it('handles a follow-on innings victory without displaying the unplayed innings', () => {
    const m = finishFromQuickResult(result([inn('A', 400), inn('B', 100), inn('B', 150), { teamId: 'A', runs: 0, wickets: 0, balls: 0 }],
      { currentInningsIndex: 2 }), { kind: 'cricket' });
    expect(m).toMatchObject({ winnerSide: 'team1', detail: 'Won by an innings and 150 runs' });
    expect(m.team1.score).toBe('400/all');
    expect(m.team2.score).toBe('100/all & 150/all');
  });

  it('marks declared and all-out innings the way the Test scorer does, including a follow-on', () => {
    const declared = (teamId, runs, wickets) => ({ teamId, runs, wickets, balls: 60, allOut: false, declared: true });
    const m = finishFromQuickResult(result([declared('A', 450, 7), inn('B', 150), inn('B', 200), { teamId: 'A', runs: 0, wickets: 0, balls: 0 }],
      { currentInningsIndex: 2, format: { preset: 'test', totalInnings: 4, players: 11, followOnMargin: 200 } }), { kind: 'cricket' });
    expect(m).toMatchObject({ winnerSide: 'team1', detail: 'Won by an innings and 100 runs' });
    expect(m.team1.score).toBe('450/7d');
    expect(m.team2.score).toBe('150/all & 200/all');
    expect(m.ariaSummary).toContain('Alpha 450/7d, Beta 150/all & 200/all.');
  });

  it('keeps a manual draw truthful when aggregate runs are unequal', () => {
    expect(finishFromQuickResult(result([inn('A', 200), inn('B', 180, 2)],
      { winner: 'Draw', winDesc: 'Match Drawn', currentInningsIndex: 1 }), { kind: 'cricket' }))
      .toMatchObject({ outcome: 'draw', winnerSide: null, headline: 'Match drawn', detail: null });
  });

  it('distinguishes a completed tie from a draw', () => {
    expect(finishFromQuickResult(result([inn('A', 200), inn('B', 180), inn('A', 100), inn('B', 120)],
      { winner: 'Tie' }), { kind: 'cricket' }))
      .toMatchObject({ outcome: 'draw', winnerSide: null, headline: 'Match tied', detail: null });
  });

  it('an explicitly saved draw overrides a computed tie at equal totals', () => {
    expect(finishFromQuickResult(result([inn('A', 200), inn('B', 180), inn('A', 100), inn('B', 120)],
      { winner: 'Draw', winDesc: 'Match Drawn' }), { kind: 'cricket' }))
      .toMatchObject({ outcome: 'draw', winnerSide: null, headline: 'Match drawn', detail: null });
  });
});

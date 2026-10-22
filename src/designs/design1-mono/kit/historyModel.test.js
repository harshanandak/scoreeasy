import { describe, expect, it } from 'vitest';
import { displayScore, groupByMonth, latestMonthSummary, monthLabel, sportCounts, UNDATED, winnerSide } from './historyModel';

const at = (y, m, d) => new Date(y, m - 1, d, 12).toISOString();
const NOW = new Date(2026, 9, 23, 12).getTime();
const entry = (id, sport, date, extra = {}) => ({ id, sport, sportName: sport[0].toUpperCase() + sport.slice(1), date, ...extra });

describe('historyModel', () => {
  const entries = [
    entry('1', 'volleyball', at(2026, 10, 22)),
    entry('2', 'cricket', at(2026, 10, 20)),
    entry('3', 'volleyball', at(2026, 10, 2)),
    entry('4', 'football', at(2026, 9, 30)),
    entry('5', 'hockey', null),
  ];

  it('summarises the newest month: total equals the sum of its per-sport counts', () => {
    const summary = latestMonthSummary(entries, NOW);
    expect(summary.label).toBe('October');
    expect(summary.total).toBe(3);
    expect(summary.sports.map((s) => [s.id, s.count])).toEqual([['volleyball', 2], ['cricket', 1]]);
    expect(summary.sports.reduce((sum, s) => sum + s.count, 0)).toBe(summary.total);
  });

  it('picks the newest month by date, whatever order the list is sorted in', () => {
    expect(latestMonthSummary([...entries].reverse(), NOW).label).toBe('October');
  });

  it('returns no summary when nothing is dated', () => {
    expect(latestMonthSummary([entry('x', 'tennis', null)], NOW)).toBeNull();
    expect(latestMonthSummary([], NOW)).toBeNull();
  });

  it('groups rows by month in list order, and the newest group matches the summary', () => {
    const groups = groupByMonth(entries, NOW);
    expect(groups.map((g) => [g.label, g.entries.length])).toEqual([['October', 3], ['September', 1], ['Undated', 1]]);
    expect(groups[0].entries.length).toBe(latestMonthSummary(entries, NOW).total);
    expect(groups[2].key).toBe(UNDATED);
  });

  it('names other years in full', () => {
    expect(monthLabel('2025-12', NOW)).toBe('December 2025');
    expect(monthLabel('2026-01', NOW)).toBe('January');
  });

  it('counts entries without a sport as Custom', () => {
    expect(sportCounts([{ id: 'l', sportName: 'Custom' }])).toEqual([{ id: 'custom', name: 'Custom', count: 1 }]);
  });

  it('only re-punctuates scores, never changes a number', () => {
    expect(displayScore('25 - 22')).toBe('25–22');
    expect(displayScore('164/6 vs 158/9')).toBe('164/6–158/9');
    expect(displayScore('21 - 18 - 9')).toBe('21–18–9');
    expect(displayScore(undefined)).toBe('--');
  });

  it('marks the winning side, and none for draws, ties or unknown winners', () => {
    expect(winnerSide({ team1: 'A', team2: 'B', winner: 'A' })).toBe('a');
    expect(winnerSide({ team1: 'A', team2: 'B', winner: 'B' })).toBe('b');
    expect(winnerSide({ team1: 'A', team2: 'B', winner: 'Draw' })).toBeNull();
    expect(winnerSide({ team1: 'A', team2: 'B', winner: 'tie' })).toBeNull();
    expect(winnerSide({ team1: 'A', team2: 'B', winner: 'C' })).toBeNull();
    expect(winnerSide({ team1: 'Same', team2: 'Same', winner: 'Same' })).toBeNull();
  });
});

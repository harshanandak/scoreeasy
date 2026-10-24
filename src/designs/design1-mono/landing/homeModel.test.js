import { describe, expect, it } from 'vitest';
import { finishedNewestFirst, homeCountLine, quickStartSports } from './homeModel';

const day = 864e5;
const now = new Date(2026, 9, 24, 12).getTime();
const iso = (msAgo) => new Date(now - msAgo).toISOString();

describe('homeCountLine', () => {
  it('counts finished matches, this week first', () => {
    expect(homeCountLine({ finishedCount: 5, weekCount: 2, inProgressCount: 2 })).toBe('2 matches scored this week');
    expect(homeCountLine({ finishedCount: 1, weekCount: 1, inProgressCount: 0 })).toBe('1 match scored this week');
    expect(homeCountLine({ finishedCount: 3, weekCount: 0, inProgressCount: 0 })).toBe('3 matches scored so far');
  });

  it('says how many are in progress instead of "0 scored"', () => {
    expect(homeCountLine({ finishedCount: 0, weekCount: 0, inProgressCount: 2 })).toBe('2 matches in progress');
    expect(homeCountLine({ finishedCount: 0, weekCount: 0, inProgressCount: 1 })).toBe('1 match in progress');
  });

  it('says nothing when there is nothing to count', () => {
    expect(homeCountLine({ finishedCount: 0, weekCount: 0, inProgressCount: 0 })).toBeNull();
  });
});

describe('finishedNewestFirst', () => {
  it('keeps only finished records, newest first by when they finished', () => {
    const rows = finishedNewestFirst([
      { id: 'a', status: 'completed', date: iso(3 * day) },
      { id: 'open', status: 'in-progress', date: iso(0) },
      { id: 'shell', date: iso(0) },
      { id: 'b', winner: 'X', score1: 2, score2: 1, date: iso(day) },
      { id: 'c', status: 'completed', completedAt: iso(2 * day), date: iso(9 * day) },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('survives a corrupt store', () => {
    expect(finishedNewestFirst({ not: 'an array' })).toEqual([]);
    expect(finishedNewestFirst(null)).toEqual([]);
  });
});

describe('quickStartSports', () => {
  const ids = (list) => list.map((s) => s.id);
  it('prefers favourites', () => {
    expect(ids(quickStartSports({ favoriteIds: ['tennis'], finished: [{ sport: 'cricket' }], inProgress: [] }).sports)).toEqual(['tennis']);
  });

  it('then sports recently finished, then sports in progress, without repeats', () => {
    const { sports, label } = quickStartSports({ favoriteIds: [], finished: [{ sport: 'cricket' }], inProgress: [{ sport: 'kabaddi' }, { sport: 'cricket' }] });
    expect(ids(sports)).toEqual(['cricket', 'kabaddi']);
    expect(label).toBe('Recently played');
  });

  it('ignores unknown sports', () => {
    expect(ids(quickStartSports({ favoriteIds: ['nope'], finished: [{ sport: 'nope' }], inProgress: [{ sport: 'volleyball' }] }).sports)).toEqual(['volleyball']);
  });
});

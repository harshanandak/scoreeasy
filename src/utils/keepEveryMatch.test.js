import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadInProgressMatches } from './appEntry';
import { loadQuickMatches, saveQuickMatch } from './storage';
import { deleteInProgressMatch, inProgressSummary } from './inProgressMatch';

beforeEach(() => localStorage.clear());

describe('every started match stays resumable', () => {
  it('keeps new match identities distinct across reloads with the same device clock', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1792770000000);
    try {
      vi.resetModules();
      const first = (await import('./quickMatchDrafts')).createQuickMatchId();
      vi.resetModules();
      const second = (await import('./quickMatchDrafts')).createQuickMatchId();
      expect(second).not.toBe(first);
    } finally { clock.mockRestore(); }
  });

  it('lists two cricket matches independently, including a draft older than a day', () => {
    for (const [id, runs] of [[101, 12], [102, 29]]) {
      localStorage.setItem(`se_quickmatch_draft_cricket_${id}`, JSON.stringify({
        sport: 'cricket', phase: 'scoring', quickMatchId: id,
        team1Name: 'Royals', team2Name: 'Strikers',
        scores: { team1: { runs, wickets: 1, balls: 10 }, team2: { runs: 0, wickets: 0, balls: 0 } },
        updatedAt: '2020-01-01',
      }));
    }
    const matches = loadInProgressMatches();
    expect(matches.map(m => m.entryPath)).toEqual(expect.arrayContaining(['/cricket/quick?resume=101', '/cricket/quick?resume=102']));
    expect(matches.map(m => m.scores.team1.runs).sort()).toEqual([12, 29]);
  });

  it.each(['cricket', 'volleyball', 'kabaddi'])('migrates the old %s slot once without changing scoring or undo', (sport) => {
    const draft = { phase: 'scoring', sport, quickMatchId: 21, vScore1: 12, vScoreHistory: [{ score1: 11 }], updatedAt: '2020-01-01' };
    localStorage.setItem(`se_quickmatch_draft_${sport}`, JSON.stringify(draft));
    expect(loadInProgressMatches()[0].entryPath).toBe(`/${sport}/quick?resume=21`);
    expect(JSON.parse(localStorage.getItem(`se_quickmatch_draft_${sport}_21`))).toEqual(draft);
    expect(localStorage.getItem(`se_quickmatch_draft_${sport}`)).toBeNull();
    expect(loadInProgressMatches()).toHaveLength(1);
  });

  it('preserves the legacy slot when migration cannot save', () => {
    const draft = { phase: 'scoring', sport: 'cricket', quickMatchId: 21 };
    localStorage.setItem('se_quickmatch_draft_cricket', JSON.stringify(draft));
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    try {
      expect(loadInProgressMatches()[0].entryPath).toBe('/cricket/quick');
      expect(JSON.parse(localStorage.getItem('se_quickmatch_draft_cricket'))).toEqual(draft);
    } finally { write.mockRestore(); }
  });

  it('retains old tennis and Test-cricket drafts in storage and the catalog', () => {
    localStorage.setItem('se_tennis_quick_draft_1', JSON.stringify({ id: 1, sport: 'tennis', status: 'in-progress', updatedAt: '2020-01-01' }));
    saveQuickMatch({ id: 2, sport: 'cricket', status: 'in-progress', format: { totalInnings: 4 }, updatedAt: '2020-01-01', draftState: { history: [1] } });
    expect(loadQuickMatches()).toHaveLength(1);
    expect(loadQuickMatches()[0].draftState.history).toEqual([1]);
    expect(loadInProgressMatches().map(m => m.entryPath)).toEqual(expect.arrayContaining(['/tennis/quick/live/1', '/cricket/quick/test-match/2']));
  });

  it('lists started tournament fixtures individually and deletes only the chosen fixture progress', () => {
    const tournament = { id: 4, name: 'Club cup', teams: [{ id: 'a', name: 'Royals' }, { id: 'b', name: 'Strikers' }], matches: [
      { id: 'm1', team1Id: 'a', team2Id: 'b', status: 'in-progress', draftState: { score1: 12, score2: 9, history: [1], savedAt: '2020-01-01' } },
      { id: 'm2', team1Id: 'b', team2Id: 'a', status: 'in-progress', draftState: { score1: 7, score2: 4, history: [2], savedAt: '2020-01-01' } },
    ] };
    localStorage.setItem('se_kabaddi', JSON.stringify([tournament]));
    const entries = loadInProgressMatches();
    expect(entries.map(m => m.entryPath)).toEqual(['/kabaddi/tournament/4/match/m1/score', '/kabaddi/tournament/4/match/m2/score']);
    expect(inProgressSummary(entries[0])).toMatchObject({ title: 'Royals v Strikers', score: '12–9' });
    expect(deleteInProgressMatch(entries[0])).toBe(true);
    const saved = JSON.parse(localStorage.getItem('se_kabaddi'))[0];
    expect(saved.matches[0]).toMatchObject({ status: 'pending' });
    expect(saved.matches[0].draftState).toBeUndefined();
    expect(saved.matches[1]).toEqual(tournament.matches[1]);
    expect(loadInProgressMatches()).toHaveLength(1);
  });

  it('shows the correct sport score when the generic snapshot also contains unused cricket and goals state', () => {
    const match = { sport: 'volleyball', vScore1: 12, vScore2: 9, gScore1: 0, gScore2: 0, scores: { team1: { runs: 0 }, team2: { runs: 0 } } };
    expect(inProgressSummary(match).score).toBe('12–9');
    expect(inProgressSummary({ ...match, sport: 'kabaddi', gScore1: 29, gScore2: 22 }).score).toBe('29–22');
  });
});

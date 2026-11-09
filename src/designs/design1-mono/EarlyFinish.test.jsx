import { matchStorageKey } from '../../utils/accountStorage';
import { beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MonoQuickMatch from './MonoQuickMatch';
import { MonoStatisticsPanel } from './MonoStatistics';
import { loadQuickMatches } from '../../utils/storage';
import { finishFromQuickResult } from './kit/finishModel';
import { calculateGoalsStandings, calculateSetsStandings } from '../../utils/standingsCalculator';

vi.mock('convex/react', () => ({ useQuery: () => undefined, useMutation: () => vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, cloudAuthAvailable: false }) }));
vi.mock('../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ isLive: false, point: vi.fn(), undo: vi.fn(), finalize: vi.fn(), reset: vi.fn() }) }));

beforeEach(() => { cleanup(); localStorage.clear(); });

it.each(['volleyball', 'badminton', 'tabletennis', 'football', 'basketball', 'hockey', 'kabaddi', 'cricket'])('finishing undecided %s keeps the score without awarding a result', async sport => {
  localStorage.setItem(matchStorageKey(`se_quickmatch_draft_${sport}_41`), JSON.stringify({
    sport, quickMatchId: 41, phase: 'scoring', team1Name: 'Royals', team2Name: 'Strikers',
    vScore1: 2, vScore2: 1, gScore1: 2, gScore2: 1, currentSet: 0,
    sets: [{ score1: 2, score2: 1, completed: false }],
    scores: { team1: { runs: 13, wickets: 1, balls: 6 }, team2: { runs: 0, wickets: 0, balls: 0 } },
    innings: 1, battingTeam: 1, format: sport === 'cricket' ? { overs: 20, players: 11 } : { type: 'single', target: 25, mode: 'timed', timeLimit: 5400 },
    updatedAt: new Date().toISOString(),
  }));
  render(<MemoryRouter initialEntries={[`/${sport}/quick?resume=41`]}><Routes><Route path="/:sport/quick" element={<MonoQuickMatch />} /></Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Finish' }));
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveTextContent(/abandoned.*no result/i);
  fireEvent.click(within(dialog).getByRole('button', { name: 'End match' }));
  expect(loadQuickMatches()).toEqual([expect.objectContaining({ status: 'completed', resultType: 'abandoned', winner: null, score1: sport === 'cricket' ? 13 : 2, score2: sport === 'cricket' ? 0 : 1 })]);
  expect(screen.getByRole('heading', { name: 'Abandoned · no result' })).toBeVisible();
  expect(screen.queryByText(/^Winner$/)).not.toBeInTheDocument();
});

it.each(['sets', 'goals', 'cricket'])('%s abandoned display never promotes the leader to winner', kind => {
  const model = finishFromQuickResult({ resultType: 'abandoned', team1: 'Royals', team2: 'Strikers', winner: null, score1: 13, score2: 0 }, { kind });
  expect(model).toMatchObject({ outcome: 'none', winnerSide: null, headline: 'Abandoned · no result', team1: { score: kind === 'cricket' ? '13/?' : '13' }, team2: { score: kind === 'cricket' ? '0/?' : '0' } });
});

it.each([calculateGoalsStandings, calculateSetsStandings])('abandoned fixtures award no standings win or points', calculate => {
  const rows = calculate([{ id: 1, name: 'Royals' }, { id: 2, name: 'Strikers' }], [{ team1Id: 1, team2Id: 2, status: 'completed', resultType: 'abandoned', score1: 2, score2: 1, sets: [{ score1: 2, score2: 1 }] }], {});
  for (const row of rows) expect(row).toMatchObject({ played: 1, won: 0, lost: 0, noResult: 1 });
  expect(rows[0].points ?? rows[0].matchPoints).toBe(0);
});

it('excludes abandoned leaders from form, streaks and biggest wins', async () => {
  localStorage.setItem(matchStorageKey('se_quickmatches'), JSON.stringify([{ id: 41, sport: 'football', status: 'completed', resultType: 'abandoned', team1: 'Royals', team2: 'Strikers', score1: 2, score2: 1, date: new Date().toISOString() }]));
  render(<MemoryRouter><MonoStatisticsPanel /></MemoryRouter>);
  expect(await screen.findByText('No winner yet')).toBeVisible();
  expect(screen.getByText('No form yet')).toBeVisible();
  expect(screen.getByText('No active streak')).toBeVisible();
  expect(screen.getByText('No big wins yet')).toBeVisible();
});

it('keeps old stored wins and excludes abandoned matches from the win-rate denominator and streak', async () => {
  localStorage.setItem(matchStorageKey('se_quickmatches'), JSON.stringify([
    { id: 42, sport: 'football', status: 'completed', resultType: 'abandoned', team1: 'Royals', team2: 'Strikers', score1: 99, score2: 0, date: '2026-11-09' },
    { id: 41, sport: 'football', status: 'completed', winner: 'Royals', team1: 'Royals', team2: 'Strikers', score1: 2, score2: 1, date: '2026-11-08' },
  ]));
  render(<MemoryRouter><MonoStatisticsPanel /></MemoryRouter>);
  expect(await screen.findByText('Royals 1W / 100%')).toBeVisible();
  expect(screen.getByText('Royals W1')).toBeVisible();
  expect(screen.getByText('Royals over Strikers by 1')).toBeVisible();
  expect(loadQuickMatches().find(match => match.id === 41).winner).toBe('Royals');
});

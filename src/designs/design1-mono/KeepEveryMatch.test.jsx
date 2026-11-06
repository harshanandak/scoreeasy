import { beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import MonoQuickMatch from './MonoQuickMatch';
import MonoHistory from './MonoHistory';
import MonoTennisLiveScore from './scoring/MonoTennisLiveScore';
import DashboardLanding from './landing/DashboardLanding';
import MonoPlayHub from './MonoPlayHub';
import { loadInProgressMatches } from '../../utils/appEntry';
import { loadQuickMatches } from '../../utils/storage';

vi.mock('convex/react', () => ({ useQuery: () => undefined, useMutation: () => vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, cloudAuthAvailable: false }) }));
vi.mock('../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ isLive: false, point: vi.fn(), undo: vi.fn(), finalize: vi.fn(), reset: vi.fn() }) }));
vi.mock('./live/LiveNowStrip', () => ({ default: () => null }));
vi.mock('./MonoStatistics', () => ({ MonoStatisticsPanel: () => null }));

function Navigation() {
  const navigate = useNavigate();
  return <nav><button onClick={() => navigate('/app')}>Test Home</button><button onClick={() => navigate('/history')}>Test History</button><button onClick={() => navigate('/play')}>Test Play</button></nav>;
}
function open(path) {
  return render(<MemoryRouter initialEntries={[path]}><Navigation /><Routes>
    <Route path="/:sport/quick" element={<MonoQuickMatch />} />
    <Route path="/:sport/quick/live/:matchId" element={<MonoTennisLiveScore storageMode="quick" />} />
    <Route path="/history" element={<MonoHistory />} />
    <Route path="/app" element={<DashboardLanding />} />
    <Route path="/play" element={<MonoPlayHub />} />
  </Routes></MemoryRouter>);
}
function seed(sport, id, overrides = {}) {
  const draft = { sport, quickMatchId: id, phase: 'scoring', team1Name: `Royals ${id}`, team2Name: 'Strikers', vScore1: 12, vScore2: 9, gScore1: 12, gScore2: 9, currentSet: 0, sets: [{ score1: 12, score2: 9, completed: false }], format: { type: 'single', target: 25 }, vScoreHistory: [{ vScore1: 11, vScore2: 9, sets: [{ score1: 11, score2: 9, completed: false }], currentSet: 0 }], updatedAt: '2020-01-01', ...overrides };
  localStorage.setItem(`se_quickmatch_draft_${sport}_${id}`, JSON.stringify(draft));
  return draft;
}
beforeEach(() => { cleanup(); localStorage.clear(); });

it.each(['cricket', 'volleyball'])('keeps a scoreless %s match when Finish explicitly completes it', async sport => {
  open(`/${sport}/quick`);
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`Start ${sport}`, 'i') }));
  await waitFor(() => expect(loadInProgressMatches()).toHaveLength(1));
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End match' }));
  expect(loadQuickMatches()).toEqual([expect.objectContaining({ sport, status: 'completed', score1: 0, score2: 0, winner: 'Tie', startedAt: expect.any(String) })]);
  expect(loadInProgressMatches()).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: 'Test History' }));
  const row = sport === 'cricket' ? /Team A 0\/0–0\/0 Team B/ : /Team A 0–0 Team B/;
  expect(await screen.findByRole('button', { name: row })).toBeVisible();
});

it('keeps cricket A when leaving and starting B, and Home and History offer both', async () => {
  open('/cricket/quick');
  fireEvent.click(await screen.findByRole('button', { name: /Start cricket/i }));
  await waitFor(() => expect(loadInProgressMatches()).toHaveLength(1));
  fireEvent.click(screen.getByRole('button', { name: 'Four runs' }));
  const first = loadInProgressMatches()[0];
  fireEvent.click(screen.getByRole('button', { name: 'Test Home' }));
  fireEvent.click(screen.getByRole('button', { name: 'Test Play' }));
  fireEvent.click(screen.getByRole('button', { name: 'Quick match: Cricket' }));
  fireEvent.click(await screen.findByRole('button', { name: /Start cricket/i }));
  await waitFor(() => expect(loadInProgressMatches()).toHaveLength(2));
  fireEvent.click(screen.getByRole('button', { name: 'Six runs' }));
  expect(loadInProgressMatches().find(m => m.entryPath !== first.entryPath).scores.team1.runs).toBe(6);
  expect(loadInProgressMatches().find(m => m.entryPath === first.entryPath).scores.team1.runs).toBe(4);
  fireEvent.click(screen.getByRole('button', { name: 'Test Home' }));
  const homePaths = [...screen.getAllByRole('button', { name: /^Resume / })].map(b => b.getAttribute('data-resume-path'));
  fireEvent.click(screen.getByRole('button', { name: 'Test History' }));
  expect(screen.getAllByRole('button', { name: /^Resume / }).map(b => b.getAttribute('data-resume-path'))).toEqual(homePaths);
});

it('the plain quick route restores the latest started match even at zero, without replacing its peer', async () => {
  const older = seed('volleyball', 31, { updatedAt: '2026-10-22', vScore1: 7 });
  seed('volleyball', 32, { updatedAt: '2026-10-23', vScore1: 0, vScore2: 0, sets: [{ score1: 0, score2: 0 }], vScoreHistory: [] });
  open('/volleyball/quick');
  expect(await screen.findByRole('button', { name: 'Add point for Royals 32' })).toHaveTextContent('0');
  expect(loadInProgressMatches()).toHaveLength(2);
  expect(JSON.parse(localStorage.getItem('se_quickmatch_draft_volleyball_31'))).toEqual(older);
});

it.each(['/app', '/history'])('%s shows named cricket innings, unplayed opponents and the chase target', async path => {
  seed('cricket', 41, { team1Name: 'Royals', team2Name: 'Strikers', innings: 1, battingTeam: 1, scores: { team1: { runs: 12, wickets: 1, balls: 15 }, team2: { runs: 0, wickets: 0, balls: 0 } } });
  seed('cricket', 42, { team1Name: 'Falcons', team2Name: 'Tigers', innings: 2, battingTeam: 2, scores: { team1: { runs: 64, wickets: 3, balls: 48 }, team2: { runs: 29, wickets: 2, balls: 24 } } });
  open(path);
  const first = (await screen.findByRole('button', { name: /Resume Cricket: Royals/ })).closest('article');
  expect(first).toHaveTextContent('Royals 12/1');
  expect(first).toHaveTextContent('Strikers yet to bat');
  const second = screen.getByRole('button', { name: /Resume Cricket: Falcons/ }).closest('article');
  expect(second).toHaveTextContent('Falcons 64/3');
  expect(second).toHaveTextContent('Tigers 29/2');
  expect(second).toHaveTextContent('Chasing 65');
});

it('resumes an old +1/+2 kabaddi match on the raid board with its score kept after leaving', async () => {
  seed('kabaddi', 4, { format: { mode: 'free' }, gScoreHistory: [{ team: 1, value: 1 }] });
  open('/kabaddi/quick?resume=4');
  expect(await screen.findByLabelText('Royals 4 score')).toHaveTextContent('12');
  await waitFor(() => expect(loadInProgressMatches()[0].kabaddi?.carried).toEqual([12, 9]));
  expect(loadInProgressMatches()[0].gScore1).toBe(12);
  fireEvent.click(screen.getByRole('button', { name: 'Test History' }));
  expect(screen.getByText('12–9')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Resume Kabaddi/ }));
  await waitFor(() => expect(document.querySelector('[data-kabaddi-board]')).toHaveTextContent('12'));
});

it('restores old cricket innings and undo independently of another cricket match', async () => {
  const scores = { team1: { runs: 20, wickets: 1, balls: 12 }, team2: { runs: 7, wickets: 0, balls: 4 } };
  const previous = { ...scores, team2: { runs: 6, wickets: 0, balls: 3 } };
  seed('cricket', 4, { scores, innings: 2, battingTeam: 2, format: { overs: 20, players: 11 }, cricketHistory: [{ type: 'runs', key: 'team2', value: 1, innings: 2, battingTeam: 2, freeHit: false, trialBallUsed: false }] });
  seed('cricket', 5, { scores: { ...scores, team1: { runs: 14, wickets: 0, balls: 10 } } });
  open('/cricket/quick?resume=4');
  fireEvent.click(await screen.findByRole('button', { name: /Undo/ }));
  expect(loadInProgressMatches().find(m => m.quickMatchId === 4)).toMatchObject({ innings: 2, battingTeam: 2, scores: previous, cricketHistory: [] });
  expect(loadInProgressMatches().find(m => m.quickMatchId === 5).scores.team1.runs).toBe(14);
});

it('retains old tennis games, current set and Undo on resume, and confirms Discard', async () => {
  const blank = { games1: 0, games2: 0, points1: 0, points2: 0, completed: false, isTiebreak: false };
  const previousSets = [{ ...blank, games1: 6, completed: true }, { ...blank, games1: 2, games2: 1 }, blank];
  const sets = [previousSets[0], { ...previousSets[1], points1: 1 }, blank];
  localStorage.setItem('se_tennis_quick_draft_6', JSON.stringify({ id: 6, sport: 'tennis', status: 'in-progress', team1Name: 'Anya', team2Name: 'Ravi', format: { sets: 3 }, sets, updatedAt: '2020-01-01', draftState: { sets, currentSet: 1, history: [{ sets: previousSets, currentSet: 1 }] } }));
  open('/tennis/quick/live/6');
  expect(await screen.findByRole('button', { name: /^Anya: 15/ })).toHaveTextContent('2 games');
  expect(screen.getByText('Set 2 of 3')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
  expect(screen.getByRole('button', { name: /^Anya: 0/ })).toHaveTextContent('2 games');
  fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
  fireEvent.click(screen.getByRole('button', { name: 'Discard match' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('Anya v Ravi, 2–1 games');
  expect(localStorage.getItem('se_tennis_quick_draft_6')).not.toBeNull();
});

it('requires confirmation before deleting a scoreless tennis match', async () => {
  const blank = { games1: 0, games2: 0, points1: 0, points2: 0, completed: false, isTiebreak: false };
  localStorage.setItem('se_tennis_quick_draft_7', JSON.stringify({ id: 7, sport: 'tennis', status: 'in-progress', team1Name: 'Anya', team2Name: 'Ravi', format: { sets: 3 }, sets: [blank, blank, blank] }));
  open('/tennis/quick/live/7');
  fireEvent.click(await screen.findByRole('button', { name: 'Match options' }));
  fireEvent.click(screen.getByRole('button', { name: 'Discard match' }));
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveTextContent('Anya v Ravi, 0–0 games');
  expect(localStorage.getItem('se_tennis_quick_draft_7')).not.toBeNull();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Keep scoring' }));
  expect(localStorage.getItem('se_tennis_quick_draft_7')).not.toBeNull();
});

it('History confirms with teams and score, cancellation retains both, deletion removes only the chosen draft', async () => {
  seed('volleyball', 1); seed('kabaddi', 2);
  open('/history');
  fireEvent.click(await screen.findByRole('button', { name: /Delete Volleyball: Royals 1/ }));
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveTextContent('Royals 1 v Strikers, 12–9');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Keep match' }));
  expect(loadInProgressMatches()).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: /Delete Volleyball: Royals 1/ }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
  expect(loadInProgressMatches().map(m => m.quickMatchId)).toEqual([2]);
  expect(screen.queryByRole('button', { name: /Resume Volleyball/ })).toBeNull();
});

it('keeps an orphan terminal snapshot when restore cannot find its completed History record', async () => {
  const draft = seed('volleyball', 9, { status: 'completed', winner: 'Royals 9' });
  open('/volleyball/quick?resume=9');
  await screen.findByRole('button', { name: /Delete Volleyball: Royals 9/ });
  expect(loadQuickMatches()).toEqual([]);
  expect(JSON.parse(localStorage.getItem('se_quickmatch_draft_volleyball_9'))).toEqual(draft);
});

it('keeps a legacy numeric zero identity through migration, Resume and Finish', async () => {
  const draft = seed('volleyball', 0);
  localStorage.removeItem('se_quickmatch_draft_volleyball_0');
  localStorage.setItem('se_quickmatch_draft_volleyball', JSON.stringify(draft));
  open('/volleyball/quick');
  expect(await screen.findByRole('button', { name: 'Add point for Royals 0' })).toHaveTextContent('12');
  expect(loadInProgressMatches()[0].quickMatchId).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Test Home' }));
  fireEvent.click(screen.getByRole('button', { name: /Resume Volleyball: Royals 0/ }));
  expect(await screen.findByRole('button', { name: 'Add point for Royals 0' })).toHaveTextContent('12');
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End match' }));
  expect(loadQuickMatches()[0]).toMatchObject({ id: 0, status: 'completed', score1: 12 });
  expect(loadInProgressMatches()).toEqual([]);
});

it('restores the same volleyball score and undo, then Finish moves only it to completed History', async () => {
  seed('volleyball', 1); seed('kabaddi', 2);
  open('/volleyball/quick?resume=1');
  const point = await screen.findByRole('button', { name: 'Add point for Royals 1' });
  expect(point).toHaveTextContent('12');
  fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
  expect(point).toHaveTextContent('11');
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End match' }));
  await waitFor(() => expect(loadQuickMatches()).toHaveLength(1));
  expect(loadQuickMatches()[0]).toMatchObject({ id: 1, score1: 11, status: 'completed' });
  expect(loadInProgressMatches().map(m => m.quickMatchId)).toEqual([2]);
});

it('board Discard always confirms, names the score and deletes only that match', async () => {
  seed('volleyball', 1); seed('volleyball', 2);
  open('/volleyball/quick?resume=1');
  fireEvent.click(await screen.findByRole('button', { name: 'Match options' }));
  fireEvent.click(screen.getByRole('button', { name: 'Discard match' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('Royals 1 v Strikers, 12–9');
  expect(loadInProgressMatches()).toHaveLength(2);
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard' }));
  await waitFor(() => expect(loadInProgressMatches().map(m => m.quickMatchId)).toEqual([2]));
});

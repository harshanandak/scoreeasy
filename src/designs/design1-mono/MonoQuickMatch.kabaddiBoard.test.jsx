import { act } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { contrastReport, deriveTeamColours } from '../../lib/teamColour';
import { sportIdentity } from '../../lib/sportIdentity';
import { assertState, startHalf } from '../../utils/kabaddiEngine';
import { createKabaddiMatch } from '../../utils/kabaddiQuickMatch';

const ctx = vi.hoisted(() => ({ sport: 'kabaddi', draft: null }));
const storage = vi.hoisted(() => ({ saveData: vi.fn(() => true), saveQuickMatch: vi.fn(() => true) }));
const live = vi.hoisted(() => ({ point: vi.fn(), undo: vi.fn(), finalize: vi.fn(), reset: vi.fn() }));
vi.mock('convex/react', () => ({ useMutation: () => vi.fn(), useQuery: () => undefined }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(), useParams: () => ({ sport: ctx.sport }),
  useLocation: () => ({ pathname: `/${ctx.sport}/quick`, search: '' }),
  useSearchParams: () => [new URLSearchParams(''), vi.fn()],
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, cloudAuthAvailable: false }) }));
vi.mock('../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ ...live, isLive: false }) }));
vi.mock('../../lib/live/liveSession', () => ({ getConsent: () => 'unknown', loadSession: () => null, saveSession: vi.fn() }));
vi.mock('../../utils/storage', () => ({
  listDataKeys: () => [],
  loadData: (key, fallback) => key === `se_quickmatch_draft_${ctx.sport}` ? ctx.draft : fallback,
  loadQuickMatch: () => null, saveData: storage.saveData, saveQuickMatch: storage.saveQuickMatch,
  clearData: vi.fn(), isStaleQuickMatchDraft: () => false,
}));
const { default: MonoQuickMatch } = await import('./MonoQuickMatch');

const NOW = new Date('2026-10-24T12:00:00Z').getTime();
const SETUP = { format: { mode: 'timed', timeLimit: 2400 }, names: ['Royals', 'Strikers'], colours: ['#6d28d9', '#f97316'] };
const board = () => document.querySelector('[data-kabaddi-board]');
const button = (name) => screen.getByRole('button', { name });
const scoreOf = (name) => screen.getByLabelText(`${name} score`).textContent;
const matOf = (name) => screen.getByLabelText(new RegExp(`^${name}: \\d of 7 on mat`)).getAttribute('aria-label');
const undo = () => button('Undo last action');
const saved = () => storage.saveData.mock.calls.at(-1)[1];
const tap = (name) => fireEvent.click(button(name));

/** A match in play: score, mat strength, next raider and empty streaks set directly (engine-validated). */
function inPlay({ score = [0, 0], mat = [7, 7], next = 0, streak = [0, 0], half = 1, elapsedMs = 60000 } = {}) {
  const match = createKabaddiMatch(SETUP);
  const state = startHalf(match.state, { atMs: NOW - elapsedMs });
  for (const team of [0, 1]) {
    state.teams[team].score.touch = score[team];
    const slots = [...state.mat[team]];
    state.mat[team] = slots.slice(0, mat[team]);
    state.outQueue[team] = slots.slice(mat[team]).map((slotId, i) => ({ slotId, outEventId: 'fixture', outSequence: team * 7 + i + 1 }));
  }
  state.nextOutSequence = 14;
  state.nextRaidTeam = next;
  state.emptyStreak = streak;
  state.half = half;
  assertState(state);
  return { ...match, state };
}

function seed(kabaddi = createKabaddiMatch(SETUP), extra = {}) {
  ctx.sport = 'kabaddi';
  ctx.draft = {
    phase: 'scoring', sport: 'kabaddi', team1Name: 'Royals', team2Name: 'Strikers',
    team1Color: '#6d28d9', team2Color: '#f97316', quickMatchId: 4101,
    format: SETUP.format, timerElapsed: 0, gScore1: 0, gScore2: 0, gScoreHistory: [], lastAction: '',
    kabaddi: kabaddi && JSON.parse(JSON.stringify(kabaddi)), ...extra,
  };
}

function raid() { tap('Raid by Royals'); }
function confirm() { act(() => { tap('Confirm raid'); }); }

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); vi.clearAllMocks(); seed(); });
afterEach(() => { vi.useRealTimers(); });

describe('Kabaddi raid board', () => {
  it('starts at 0–0 with seven a side, lets the scorer pick the opening raider, and starts the first raid', () => {
    render(<MonoQuickMatch />);
    expect(board()).toBeInTheDocument();
    const colours = deriveTeamColours('#6d28d9', '#f97316');
    expect(board().style.getPropertyValue('--team-a-core')).toBe(colours.A.core);
    expect([scoreOf('Royals'), scoreOf('Strikers')]).toEqual(['0', '0']);
    expect(matOf('Royals')).toBe('Royals: 7 of 7 on mat');
    expect(undo()).toBeDisabled();
    tap('Strikers raid first');
    expect(button('Start · first raid by Strikers')).toBeInTheDocument();
    tap('Royals raid first');
    act(() => { tap('Start · first raid by Royals'); });
    expect(screen.getByRole('heading', { name: 'Raid by Royals' })).toBeInTheDocument();
    expect(screen.getByLabelText('Raid clock')).toHaveTextContent('30');
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByLabelText('Raid clock')).toHaveTextContent('24');
    expect(saved().kabaddi.state.activeRaid.raidingTeam).toBe(0);
    expect(undo()).toBeDisabled();
    expect(undo()).toHaveTextContent('Cancel the raid first');
  });

  it('touch 2 + bonus → preview → confirm moves score and mat, and undo restores score, mat and turn', () => {
    seed(inPlay());
    render(<MonoQuickMatch />);
    raid();
    tap('Touch Defenders put out');
    tap('2');
    tap('Bonus before contact');
    const preview = screen.getByRole('status', { name: 'Raid preview' });
    expect(preview).toHaveTextContent('Royals +3');
    expect(preview).toHaveTextContent('Score 3–0');
    expect(preview).toHaveTextContent('Mat 7–5');
    expect(preview).toHaveTextContent('Strikers raid next');
    expect(scoreOf('Royals')).toBe('0');
    confirm();
    expect([scoreOf('Royals'), scoreOf('Strikers')]).toEqual(['3', '0']);
    expect(matOf('Strikers')).toBe('Strikers: 5 of 7 on mat, 2 out');
    expect(button('Raid by Strikers')).toBeInTheDocument();
    expect(saved()).toMatchObject({ gScore1: 3, gScore2: 0 });
    expect(saved().kabaddi.state.revision).toBeGreaterThan(0);
    expect(undo()).toHaveTextContent('Restore 0–0 · mat 7–7');
    act(() => { fireEvent.click(undo()); });
    expect([scoreOf('Royals'), scoreOf('Strikers')]).toEqual(['0', '0']);
    expect(matOf('Strikers')).toBe('Strikers: 7 of 7 on mat');
    expect(screen.getByRole('status', { name: 'Undo result' })).toHaveTextContent('Raid undone · 0–0 · mat 7–7 · Royals raid next');
    expect(button('Raid by Royals')).toBeInTheDocument();
  });

  it('a raider tackled by three defenders is a super tackle: +2, one revival, a moment', () => {
    seed(inPlay({ score: [18, 18], mat: [5, 3] }));
    render(<MonoQuickMatch />);
    expect(screen.getByText(/Super tackle on/)).toBeInTheDocument();
    raid();
    expect(button(/^Tackled/)).toHaveTextContent('Strikers +2');
    tap(/^Tackled/);
    expect(screen.getByRole('heading', { name: 'Super tackle' })).toBeInTheDocument();
    expect(button('Bonus before contact')).toBeDisabled();
    const preview = screen.getByRole('status', { name: 'Raid preview' });
    expect(preview).toHaveTextContent('Strikers +2');
    expect(preview).toHaveTextContent('Mat 4–4');
    confirm();
    expect([scoreOf('Royals'), scoreOf('Strikers')]).toEqual(['18', '20']);
    expect(screen.getByRole('heading', { name: 'Super tackle!' })).toBeInTheDocument();
    tap('Continue');
    expect(button('Raid by Strikers')).toBeInTheDocument();
  });

  it('touching the last three defenders is an all out: +2, the side comes back, announced', () => {
    seed(inPlay({ score: [16, 18], mat: [5, 3] }));
    render(<MonoQuickMatch />);
    raid();
    tap('Touch Defenders put out');
    expect(button('4')).toBeDisabled();
    tap('3');
    expect(screen.getByRole('status', { name: 'Raid preview' })).toHaveTextContent('All out! Royals +2 · Strikers back to 7');
    confirm();
    expect([scoreOf('Royals'), scoreOf('Strikers')]).toEqual(['21', '18']);
    expect(matOf('Strikers')).toBe('Strikers: 7 of 7 on mat');
    expect(matOf('Royals')).toBe('Royals: 7 of 7 on mat');
    const moment = screen.getByRole('region', { name: 'All out!' });
    expect(moment).toHaveTextContent('Strikers back to 7');
    expect(undo()).toHaveTextContent('Restore 16–18 · mat 5–3');
  });

  it('two empty raids put the next raid in do or die; the third empty is a raider out', () => {
    seed(inPlay({ score: [21, 18], mat: [7, 4], next: 1, streak: [0, 2] }));
    render(<MonoQuickMatch />);
    expect(screen.getByRole('note', { name: 'Do or die' })).toHaveTextContent('Do or die for Strikers');
    tap('Raid by Strikers');
    expect(button(/^Empty/)).toHaveTextContent('Raider out · Royals +1');
    tap(/^Empty/);
    expect(screen.getByRole('status', { name: 'Raid preview' })).toHaveTextContent('Raider out · Royals +1');
    confirm();
    expect([scoreOf('Royals'), scoreOf('Strikers')]).toEqual(['22', '18']);
    expect(matOf('Strikers')).toBe('Strikers: 3 of 7 on mat, 4 out');
    expect(screen.queryByRole('note', { name: 'Do or die' })).toBeNull();
  });

  it('a refresh mid-raid lands on the same raid, score and mat', () => {
    seed(inPlay({ score: [5, 4], mat: [6, 7] }));
    const first = render(<MonoQuickMatch />);
    raid();
    act(() => vi.advanceTimersByTime(4000));
    const draft = saved();
    first.unmount();
    ctx.draft = draft;
    render(<MonoQuickMatch />);
    expect([scoreOf('Royals'), scoreOf('Strikers')]).toEqual(['5', '4']);
    expect(matOf('Royals')).toBe('Royals: 6 of 7 on mat, 1 out');
    expect(screen.getByRole('heading', { name: 'Raid by Royals' })).toBeInTheDocument();
    expect(screen.getByLabelText('Raid clock')).toHaveTextContent('26');
    tap(/^Cancel raid/);
    expect(button('Raid by Royals')).toBeInTheDocument();
  });

  it('migrates an old +1/+2 kabaddi draft: keeps both totals, starts the mat at 7–7 and says so', () => {
    seed(null, { gScore1: 12, gScore2: 9, gScoreHistory: [{ team: 1, value: 2 }], format: { mode: 'free' } });
    render(<MonoQuickMatch />);
    expect([scoreOf('Royals'), scoreOf('Strikers')]).toEqual(['12', '9']);
    expect(matOf('Royals')).toBe('Royals: 7 of 7 on mat');
    expect(screen.getByRole('note', { name: 'Earlier points' })).toHaveTextContent('12–9 kept from before raid scoring');
    expect(undo()).toBeDisabled();
  });

  it('calls half time at 00:00, carries score and mat, and starts half two with the other team', () => {
    seed(inPlay({ score: [21, 18], mat: [7, 4], next: 1, elapsedMs: 1199000 }));
    render(<MonoQuickMatch />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText('Half clock')).toHaveTextContent('0:00');
    act(() => { tap('Call half time'); });
    expect(screen.getByRole('heading', { name: 'Half time' })).toBeInTheDocument();
    expect(screen.getByText('Strikers raid first')).toBeInTheDocument();
    act(() => { tap('Start second half'); });
    expect(screen.getByLabelText('Half clock')).toHaveTextContent('20:00');
    expect(button('Raid by Strikers')).toBeInTheDocument();
    expect(undo()).toHaveTextContent('Back to half time');
    act(() => { fireEvent.click(undo()); });
    expect(screen.getByRole('heading', { name: 'Half time' })).toBeInTheDocument();
  });

  it('time up in half two → full time review with the winner and breakdown → Finish saves the result', async () => {
    seed(inPlay({ score: [32, 28], mat: [6, 5], half: 2, elapsedMs: 1190000 }));
    render(<MonoQuickMatch />);
    raid();
    tap(/^Empty/);
    confirm();
    act(() => vi.advanceTimersByTime(10000));
    act(() => { tap('Call full time'); });
    expect(screen.getByRole('heading', { name: 'Full time' })).toBeInTheDocument();
    expect(screen.getByText('Royals win by 4')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Points by type' });
    expect(within(table).getByRole('row', { name: /Raid points 32 28/ })).toBeInTheDocument();
    expect(undo()).toHaveTextContent('Restore 32–28 · mat 6–5');
    await act(async () => { tap('Finish match'); });
    expect(storage.saveQuickMatch).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed', score1: 32, score2: 28, winner: 'Royals', team1Color: '#6d28d9',
    }));
  });

  it('keeps every confirmed raid in the raid log, newest first, with the score after it', () => {
    seed(inPlay());
    render(<MonoQuickMatch />);
    raid();
    tap(/^Empty/);
    confirm();
    tap('Raid by Strikers');
    tap('Touch Defenders put out');
    confirm();
    tap('Match options');
    const log = screen.getByRole('list', { name: 'Raid log' });
    const rows = within(log).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Raid 2');
    expect(rows[0]).toHaveTextContent('Strikers · 1 touch');
    expect(rows[0]).toHaveTextContent('0–1');
    expect(rows[1]).toHaveTextContent('Royals · Empty');
  });

  it.each([['#6d28d9', '#f97316'], ['#111111', '#facc15'], ['#ffffff', '#ffffff']])('gates every key label and the raider chip with the engine (%s / %s)', (a, b) => {
    const report = contrastReport({ ...deriveTeamColours(a, b), sport: sportIdentity('kabaddi') });
    for (const [label, ratio, minimum] of report) expect(ratio, label).toBeGreaterThanOrEqual(minimum);
  });
});

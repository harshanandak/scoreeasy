import { act } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { contrastReport, deriveTeamColours } from '../../lib/teamColour';
import { sportIdentity } from '../../lib/sportIdentity';

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
  loadData: (key, fallback) => key === `se_quickmatch_draft_${ctx.sport}` ? ctx.draft : fallback,
  loadQuickMatch: () => null, saveData: storage.saveData, saveQuickMatch: storage.saveQuickMatch,
  clearData: vi.fn(), isStaleQuickMatchDraft: () => false,
}));
const { default: MonoQuickMatch } = await import('./MonoQuickMatch');
const board = () => document.querySelector('[data-goals-board]');
const team = (name) => screen.getByRole('group', { name: `Score for ${name}` });
const score = (name) => within(team(name)).getByLabelText(`${name} score`);
const undo = () => screen.getByRole('button', { name: 'Undo last action' });
function seed(extra = {}) {
  ctx.sport = 'kabaddi';
  ctx.draft = {
    phase: 'scoring', sport: ctx.sport, team1Name: 'Raiders', team2Name: 'Titans',
    team1Color: '#111111', team2Color: '#facc15', quickMatchId: 3101,
    format: { mode: 'timed', timeLimit: 2400 }, timerElapsed: 12,
    gScore1: 0, gScore2: 0, gScoreHistory: [], lastAction: '', ...extra,
  };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-23T12:00:00Z')); vi.clearAllMocks(); seed(); });
afterEach(() => { vi.useRealTimers(); });

describe('Kabaddi shared goals board', () => {
  it('restores team colours, places the raider only on the sport chip and ticks the existing countdown', () => {
    render(<MonoQuickMatch />);
    const colours = deriveTeamColours('#111111', '#facc15');
    expect(board().style.getPropertyValue('--team-a-core')).toBe(colours.A.core);
    expect(board().style.getPropertyValue('--team-b-core')).toBe(colours.B.core);
    expect(board().querySelector('.tgb-sport-mark')).toBeInTheDocument();
    expect(team('Raiders').querySelector('.tgb-sport-mark')).toBeNull();
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('39:48');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('39:47');
    expect(undo()).toBeDisabled();
  });

  it.each([
    ['+1', 1], ['Super Tackle (+2)', 2], ['All Out (+2)', 2],
  ])('scores %s for either team, preserves the action name, and undoes to the named score', (label, value) => {
    render(<MonoQuickMatch />);
    for (const name of ['Raiders', 'Titans']) {
      fireEvent.click(within(team(name)).getByRole('button', { name: `Add ${label} for ${name}` }));
      expect(score(name)).toHaveTextContent(String(value));
      expect(screen.getByLabelText('Last action')).toHaveTextContent(label);
      expect(undo()).toHaveTextContent('back to 0–0');
      if (label === 'All Out (+2)') expect(team(name).querySelector('.tgb-moment')).toBeInTheDocument();
      else expect(team(name).querySelector('.tgb-moment')).toBeNull();
      fireEvent.click(undo());
      expect(score(name)).toHaveTextContent('0');
      expect(undo()).toBeDisabled();
      act(() => vi.advanceTimersByTime(200));
    }
  });

  it('keeps the existing history and restores a saved draft including colours and undo', () => {
    const mounted = render(<MonoQuickMatch />);
    fireEvent.click(within(team('Raiders')).getByRole('button', { name: 'Add All Out (+2) for Raiders' }));
    const saved = storage.saveData.mock.calls.at(-1)[1];
    expect(saved).toMatchObject({ gScore1: 2, gScoreHistory: [{ team: 1, value: 2 }], team1Color: '#111111', team2Color: '#facc15' });
    mounted.unmount();
    ctx.draft = saved;
    render(<MonoQuickMatch />);
    expect(score('Raiders')).toHaveTextContent('2');
    expect(screen.getByLabelText('Last action')).toHaveTextContent('All Out (+2)');
    fireEvent.click(undo());
    expect(score('Raiders')).toHaveTextContent('0');
  });

  it('keeps colours and undo scores with their teams after swapping, including a correction', () => {
    seed({ gScore1: 8, gScore2: 3 });
    render(<MonoQuickMatch />);
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Swap sides' }));
    expect([...board().querySelectorAll('.tgb-team')].map(e => e.dataset.team)).toEqual(['b', 'a']);
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Subtract one from Raiders' }));
    expect(score('Raiders')).toHaveTextContent('7');
    expect(undo()).toHaveTextContent('back to 3–8');
    fireEvent.click(undo());
    expect(score('Raiders')).toHaveTextContent('8');
  });

  it('locks all scoring at time up, keeps score undo usable, and finishes through the existing prompt', async () => {
    seed({ timerElapsed: 2400, gScore1: 2, gScoreHistory: [{ team: 1, value: 2 }] });
    render(<MonoQuickMatch />);
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent("Time's up!");
    expect(screen.getByText('Full Time')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep scoring' }));
    for (const button of within(team('Raiders')).getAllByRole('button')) expect(button).toBeDisabled();
    expect(undo()).toHaveTextContent('back to 0–0');
    fireEvent.click(undo());
    expect(score('Raiders')).toHaveTextContent('0');
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await act(async () => fireEvent.click(within(screen.getByRole('dialog', { name: 'End match?' })).getByRole('button', { name: 'End match' })));
    expect(storage.saveQuickMatch).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed', score1: 0, score2: 0, team1Color: '#111111' }));
  });

  it('transitions from a running clock to time up and restores the same expired state after refresh', () => {
    seed({ timerElapsed: 2399 });
    const mounted = render(<MonoQuickMatch />);
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('0:01');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent("Time's up!");
    expect(screen.getByRole('dialog', { name: 'End match?' })).toBeInTheDocument();
    const saved = storage.saveData.mock.calls.at(-1)[1];
    mounted.unmount();
    ctx.draft = saved;
    render(<MonoQuickMatch />);
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent("Time's up!");
    expect(screen.getByText('Full Time')).toBeInTheDocument();
  });

  it('preserves points-target completion and the manual Finish cancellation path', async () => {
    seed({ format: { mode: 'points', target: 3 }, gScore1: 1, gScoreHistory: [{ team: 1, value: 1 }] });
    render(<MonoQuickMatch />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(within(screen.getByRole('dialog', { name: 'End match?' })).getByText('1–0')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep scoring' }));
    expect(score('Raiders')).toHaveTextContent('1');
    await act(async () => fireEvent.click(within(team('Raiders')).getByRole('button', { name: 'Add All Out (+2) for Raiders' })));
    expect(storage.saveQuickMatch).toHaveBeenCalledWith(expect.objectContaining({ score1: 3, score2: 0, status: 'completed' }));
  });

  it.each(['free', 'points'])('supports the existing %s format without an invented half state', (mode) => {
    seed({ format: { mode, target: 20 } });
    render(<MonoQuickMatch />);
    expect(board()).toBeInTheDocument();
    expect(screen.queryByText('Half Time')).toBeNull();
    if (mode === 'points') expect(screen.getByText('First to 20')).toBeInTheDocument();
  });

  it('offers the team colour pickers in Kabaddi setup', () => {
    ctx.draft = null;
    render(<MonoQuickMatch />);
    expect(screen.getByRole('group', { name: 'Team A colour' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Team B colour' })).toBeInTheDocument();
  });

  it.each(['hockey'])('keeps %s on its classic scorer', (sport) => {
    ctx.sport = sport; ctx.draft.sport = sport;
    render(<MonoQuickMatch />);
    expect(board()).toBeNull();
    expect(document.querySelector('.mono-arena-grid')).toBeInTheDocument();
  });

  it.each([['#111111', '#facc15'], ['#e11d74', '#2563eb'], ['#ffffff', '#ffffff']])('gates every key label and the raider chip with the engine (%s / %s)', (a, b) => {
    const report = contrastReport({ ...deriveTeamColours(a, b), sport: sportIdentity('kabaddi') });
    for (const [label, ratio, minimum] of report) expect(ratio, label).toBeGreaterThanOrEqual(minimum);
  });
});

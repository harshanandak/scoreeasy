import { act } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { contrastReport, deriveTeamColours } from '../../lib/teamColour';
import { sportIdentity } from '../../lib/sportIdentity';

vi.mock('convex/react', () => ({ useMutation: () => vi.fn(), useQuery: () => undefined }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(), useParams: () => ({ sport: 'basketball' }),
  useLocation: () => ({ pathname: '/basketball/quick', search: '' }),
  useSearchParams: () => [new URLSearchParams(''), vi.fn()],
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, cloudAuthAvailable: false }) }));
vi.mock('../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ isLive: false, reset: vi.fn(), point: vi.fn(), undo: vi.fn(), finalize: vi.fn() }) }));
const { default: MonoQuickMatch } = await import('./MonoQuickMatch');
const key = 'se_quickmatch_draft_basketball';
const board = () => document.querySelector('[data-goals-board]');
const undo = () => screen.getByRole('button', { name: 'Undo last action' });
const score = name => screen.getByLabelText(`${name} score`);
const add = (name, value) => {
  act(() => vi.advanceTimersByTime(200));
  fireEvent.click(screen.getByRole('button', { name: `Add +${value} for ${name}` }));
};
function seed(extra = {}) {
  localStorage.setItem(key, JSON.stringify({
    phase: 'scoring', sport: 'basketball', team1Name: 'Hoops', team2Name: 'Dunkers',
    team1Color: '#111111', team2Color: '#facc15', quickMatchId: 3101,
    format: { mode: 'timed', timeLimit: 2400 }, timerElapsed: 12,
    gScore1: 52, gScore2: 49, gScoreHistory: [], lastAction: '', ...extra,
  }));
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
  localStorage.clear(); seed();
});
afterEach(() => vi.useRealTimers());

describe('Basketball on the shared goals board', () => {
  it('restores black v yellow, six registry actions, the basketball chip and countdown', () => {
    render(<MonoQuickMatch />);
    const colours = deriveTeamColours('#111111', '#facc15');
    expect(board().style.getPropertyValue('--team-a-core')).toBe(colours.A.core);
    expect(board().style.getPropertyValue('--team-b-core')).toBe(colours.B.core);
    expect(board().style.getPropertyValue('--sport-mark')).toContain('data:image/svg+xml');
    expect(screen.getByText('40 min match · No draws')).toBeInTheDocument();
    for (const name of ['Hoops', 'Dunkers']) {
      const team = screen.getByRole('group', { name: `Score for ${name}` });
      expect(within(team).getAllByRole('button')).toHaveLength(3);
      expect(team.querySelector('.tgb-sport-mark')).toBeNull();
    }
    expect(board().querySelector('.tgb-sport .tgb-sport-mark')).toBeInTheDocument();
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('39:48');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('39:47');
    expect(undo()).toBeDisabled();
  });

  it.each([1, 2, 3])('scores +%i on either team, bumps only its numeral and undoes the exact value', value => {
    render(<MonoQuickMatch />);
    for (const [name, initial] of [['Hoops', 52], ['Dunkers', 49]]) {
      add(name, value);
      expect(score(name)).toHaveTextContent(String(initial + value));
      const totals = name === 'Hoops' ? `${52 + value}–49` : `52–${49 + value}`;
      expect(screen.getByLabelText('Last action')).toHaveTextContent(`${name} +${value} · ${totals}`);
      expect(score(name)).toHaveClass('tgb-moment');
      expect(document.querySelectorAll('.tgb-moment')).toHaveLength(1);
      expect(undo()).toHaveTextContent('back to 52–49');
      fireEvent.click(undo());
      expect(score(name)).toHaveTextContent(String(initial));
      expect(document.querySelector('.tgb-moment')).toBeNull();
      expect(undo()).toBeDisabled();
    }
  });

  it('restarts consecutive score bumps without replacing the focused action', () => {
    render(<MonoQuickMatch />);
    const button = screen.getByRole('button', { name: 'Add +3 for Hoops' });
    button.focus(); add('Hoops', 3);
    const first = score('Hoops');
    add('Hoops', 3);
    expect(score('Hoops')).not.toBe(first);
    expect(score('Hoops')).toHaveClass('tgb-moment');
    expect(score('Hoops')).toHaveTextContent('58');
    expect(button).toHaveFocus();
  });

  it('restores the real saved +3 draft, then corrects and undoes through both history entries', () => {
    const mounted = render(<MonoQuickMatch />);
    add('Hoops', 3);
    expect(JSON.parse(localStorage.getItem(key))).toMatchObject({
      gScore1: 55, gScore2: 49, gScoreHistory: [{ team: 1, value: 3 }],
      team1Color: '#111111', team2Color: '#facc15',
    });
    mounted.unmount(); render(<MonoQuickMatch />);
    expect(score('Hoops')).toHaveTextContent('55');
    expect(screen.getByLabelText('Last action')).toHaveTextContent('Hoops +3 · 55–49');
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Swap sides' }));
    expect([...board().querySelectorAll('.tgb-team')].map(e => e.dataset.team)).toEqual(['b', 'a']);
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Subtract one from Hoops' }));
    expect(score('Hoops')).toHaveTextContent('54');
    expect(document.querySelector('.tgb-moment')).toBeNull();
    expect(undo()).toHaveTextContent('back to 49–55');
    fireEvent.click(undo()); expect(score('Hoops')).toHaveTextContent('55');
    fireEvent.click(undo()); expect(score('Hoops')).toHaveTextContent('52');
    expect(JSON.parse(localStorage.getItem(key)).gScoreHistory).toEqual([]);
  });

  it('walks +3, other-team +2 and Undo in order', () => {
    render(<MonoQuickMatch />);
    add('Hoops', 3); add('Dunkers', 2);
    expect(screen.getByLabelText('Last action')).toHaveTextContent('Dunkers +2 · 55–51');
    expect(undo()).toHaveTextContent('back to 55–49');
    fireEvent.click(undo()); expect(score('Dunkers')).toHaveTextContent('49');
    fireEvent.click(undo()); expect(score('Hoops')).toHaveTextContent('52');
  });

  it('expires, restores the stopped clock, preserves Undo and finishes with the existing winner', async () => {
    seed({ timerElapsed: 2399, gScoreHistory: [{ team: 1, value: 3 }] });
    const mounted = render(<MonoQuickMatch />);
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('0:01');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent("Time's up!");
    mounted.unmount(); render(<MonoQuickMatch />);
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent("Time's up!");
    fireEvent.click(screen.getByRole('button', { name: 'Keep scoring' }));
    for (const button of board().querySelectorAll('.tgb-actions button')) expect(button).toBeDisabled();
    expect(undo()).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'End match' })));
    expect(screen.getByTestId('winner-card')).toHaveTextContent('Hoops');
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('truthfully leaves a level time-up score open for a decider and reopens it on Undo', () => {
    seed({ timerElapsed: 2400, gScore1: 49, gScore2: 49 });
    render(<MonoQuickMatch />);
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent("Time's up!");
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Deciding score needed')).toBeInTheDocument();
    for (const button of board().querySelectorAll('.tgb-actions button')) expect(button).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    fireEvent.click(screen.getByRole('button', { name: 'End match' }));
    expect(screen.getByText('Basketball cannot end tied. Add the deciding score before ending.')).toBeInTheDocument();
    expect(screen.queryByTestId('winner-card')).toBeNull();
    add('Dunkers', 2);
    expect(score('Dunkers')).toHaveTextContent('51');
    fireEvent.click(screen.getByRole('button', { name: 'Keep scoring' }));
    for (const button of board().querySelectorAll('.tgb-actions button')) expect(button).toBeDisabled();
    fireEvent.click(undo());
    expect(score('Dunkers')).toHaveTextContent('49');
    expect(screen.getByRole('button', { name: 'Add +3 for Hoops' })).toBeEnabled();
    expect(document.querySelector('.tgb-moment')).toBeNull();
  });

  it('cancels Finish without losing the score, then undoes a +3 after time up', () => {
    seed({ timerElapsed: 2400, gScore1: 55, gScoreHistory: [{ team: 1, value: 3 }] });
    render(<MonoQuickMatch />);
    fireEvent.click(screen.getByRole('button', { name: 'Keep scoring' }));
    expect(score('Hoops')).toHaveTextContent('55');
    fireEvent.click(undo()); expect(score('Hoops')).toHaveTextContent('52');
  });

  it('carries quick-setup colours into the board and stored draft', () => {
    localStorage.removeItem(key); render(<MonoQuickMatch />);
    fireEvent.click(within(screen.getByRole('group', { name: 'Team A colour' })).getByRole('button', { name: 'Black' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Team B colour' })).getByRole('button', { name: 'Yellow' }));
    fireEvent.change(screen.getByLabelText('Team A name'), { target: { value: 'Hoops' } });
    fireEvent.change(screen.getByLabelText('Team B name'), { target: { value: 'Dunkers' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start basketball' }));
    const saved = JSON.parse(localStorage.getItem(key));
    const colours = deriveTeamColours(saved.team1Color, saved.team2Color);
    expect(board().style.getPropertyValue('--team-a-core')).toBe(colours.A.core);
    expect(board().style.getPropertyValue('--team-b-core')).toBe(colours.B.core);
  });

  it.each([['#111111', '#facc15'], ['#f97316', '#2563eb'], ['#ffffff', '#ffffff']])('gates labels with mark overlays (%s / %s)', (a, b) => {
    for (const [label, ratio, minimum] of contrastReport({ ...deriveTeamColours(a, b), sport: sportIdentity('basketball') })) {
      expect(ratio, label).toBeGreaterThanOrEqual(minimum);
    }
  });
});

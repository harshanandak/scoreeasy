import { act } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { contrastReport, deriveTeamColours } from '../../lib/teamColour';
import { sportIdentity } from '../../lib/sportIdentity';
import { sportMarkMaskUrl } from '../../lib/sportMarks';
import { getGoalsSports, isTeamColourSport } from '../../models/sportRegistry';

const ctx = vi.hoisted(() => ({ sport: 'hockey', draft: null }));
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
const board = () => document.querySelector('[data-goals-board]');
const undo = () => screen.getByRole('button', { name: 'Undo last action' });
function seed(extra = {}) {
  ctx.sport = 'hockey';
  ctx.draft = {
    phase: 'scoring', sport: ctx.sport, team1Name: 'Strikers', team2Name: 'United',
    team1Color: '#111111', team2Color: '#facc15', quickMatchId: 3101,
    format: { mode: 'timed', timeLimit: 600 }, timerElapsed: 12,
    gScore1: 0, gScore2: 0, gScoreHistory: [], lastAction: '', ...extra,
  };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-23T12:00:00Z')); vi.clearAllMocks(); seed(); });
afterEach(() => { vi.useRealTimers(); });

describe('Hockey shared goals board', () => {
  it('finishes the registry rollout for all four quick-match goals sports', () => {
    const sports = getGoalsSports();
    expect(sports.map(s => s.id).sort()).toEqual(['basketball', 'football', 'hockey', 'kabaddi']);
    for (const sport of sports) expect(isTeamColourSport(sport.id), sport.id).toBe(true);
  });

  it('uses the whole team key, picked colours and hockey chip with a running total countdown', () => {
    render(<MonoQuickMatch />);
    expect(board()).toBeInTheDocument();
    const colours = deriveTeamColours('#111111', '#facc15');
    expect(board().style.getPropertyValue('--team-a-core')).toBe(colours.A.core);
    expect(board().style.getPropertyValue('--team-b-core')).toBe(colours.B.core);
    expect(screen.getByText('10 min match \u00b7 Draws allowed')).toBeInTheDocument();
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('9:48');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('9:47');
    expect(board().querySelector('.tgb-sport-mark')).toBeInTheDocument();
    expect(board().style.getPropertyValue('--sport-mark')).toBe(sportMarkMaskUrl('hockey'));
    for (const name of ['Strikers', 'United']) {
      const key = screen.getByRole('button', { name: `Add 1 to ${name}` });
      expect(key).toHaveClass('tgb-team');
      expect(key.querySelector('.tgb-sport-mark')).toBeNull();
    }
    expect(screen.queryByText('Half Time')).toBeNull();
    expect(undo()).toBeDisabled();
  });

  it.each(['Strikers', 'United'])('scores a goal for %s, bumps only its key, and undoes it', (name) => {
    render(<MonoQuickMatch />);
    const key = screen.getByRole('button', { name: `Add 1 to ${name}` });
    fireEvent.click(key);
    expect(within(key).getByLabelText(`${name} score`)).toHaveTextContent('1');
    expect(key).toHaveClass('tgb-moment');
    expect(document.querySelectorAll('.tgb-moment')).toHaveLength(1);
    expect(screen.getByLabelText('Last action')).toHaveTextContent(`${name} +1 goal`);
    expect(undo()).toHaveTextContent('back to 0\u20130');
    fireEvent.click(undo());
    expect(within(key).getByLabelText(`${name} score`)).toHaveTextContent('0');
    expect(key).not.toHaveClass('tgb-moment');
    expect(undo()).toBeDisabled();
  });

  it('restores the saved goal, colours and history, then corrects and undoes after swapping', () => {
    const mounted = render(<MonoQuickMatch />);
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 to Strikers' }));
    const saved = storage.saveData.mock.calls.at(-1)[1];
    expect(saved).toMatchObject({ gScore1: 1, gScoreHistory: [{team: 1, value: 1}], team1Color: '#111111', team2Color: '#facc15' });
    mounted.unmount(); ctx.draft = saved; render(<MonoQuickMatch />);
    expect(screen.getByLabelText('Strikers score')).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Swap sides' }));
    expect([...board().querySelectorAll('.tgb-team')].map(e => e.dataset.team)).toEqual(['b', 'a']);
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Subtract one from Strikers' }));
    expect(screen.getByLabelText('Strikers score')).toHaveTextContent('0');
    expect(undo()).toHaveTextContent('back to 0\u20131');
    fireEvent.click(undo());
    expect(screen.getByLabelText('Strikers score')).toHaveTextContent('1');
    fireEvent.click(undo());
    expect(screen.getByLabelText('Strikers score')).toHaveTextContent('0');
  });

  it.each([[1, 1, 'Match drawn'], [2, 1, 'Strikers']])('finishes %i-%i truthfully after time up', async (gScore1, gScore2, headline) => {
    seed({ timerElapsed: 599, gScore1, gScore2 });
    const mounted = render(<MonoQuickMatch />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent("Time's up!");
    expect(screen.getByText('Full Time')).toBeInTheDocument();
    const saved = storage.saveData.mock.calls.at(-1)[1];
    mounted.unmount(); ctx.draft = saved; render(<MonoQuickMatch />);
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent("Time's up!");
    fireEvent.click(screen.getByRole('button', { name: 'Keep scoring' }));
    expect(screen.getByRole('button', { name: 'Add 1 to Strikers' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await act(async () => fireEvent.click(within(screen.getByRole('dialog', { name: 'End match?' })).getByRole('button', { name: 'End match' })));
    expect(storage.saveQuickMatch).toHaveBeenCalledWith(expect.objectContaining({score1:gScore1, score2:gScore2, status:'completed', team1Color:'#111111'}));
    if (gScore1 === gScore2) expect(screen.getByText(headline)).toBeInTheDocument();
    else expect(screen.getByTestId('winner-card')).toHaveTextContent(headline);
    if (gScore1 === gScore2) expect(screen.queryByTestId('winner-card')).toBeNull();
    else expect(screen.getByTestId('winner-card')).toBeInTheDocument();
  });

  it('keeps Undo at time up and cancels manual Finish without losing a goal', () => {
    seed({timerElapsed:600, gScore1:1, gScoreHistory:[{team:1,value:1}]});
    render(<MonoQuickMatch />);
    fireEvent.click(screen.getByRole('button', {name:'Keep scoring'}));
    fireEvent.click(undo());
    expect(screen.getByLabelText('Strikers score')).toHaveTextContent('0');
    fireEvent.click(screen.getByRole('button', {name:'Finish'}));
    fireEvent.click(screen.getByRole('button', {name:'Keep scoring'}));
    expect(storage.saveQuickMatch).not.toHaveBeenCalled();
  });

  it.each(['free', 'points'])('keeps the existing %s mode', (mode) => {
    seed({format:{mode, target:3}}); render(<MonoQuickMatch />);
    expect(board()).toBeInTheDocument();
    if(mode === 'points') expect(screen.getByText('First to 3')).toBeInTheDocument();
  });

  it('offers team colour selection in hockey setup', () => {
    ctx.draft=null; render(<MonoQuickMatch />);
    fireEvent.click(within(screen.getByRole('group', {name:'Team A colour'})).getByRole('button', {name:'Yellow'}));
    fireEvent.click(within(screen.getByRole('group', {name:'Team B colour'})).getByRole('button', {name:'Blue'}));
    fireEvent.change(screen.getByLabelText('Team A name'), {target:{value:'Strikers'}});
    fireEvent.change(screen.getByLabelText('Team B name'), {target:{value:'United'}});
    fireEvent.click(screen.getByRole('button', {name:'Start hockey'}));
    const saved = storage.saveData.mock.calls.at(-1)[1];
    const colours = deriveTeamColours(saved.team1Color, saved.team2Color);
    expect(board().style.getPropertyValue('--team-a-core')).toBe(colours.A.core);
    expect(board().style.getPropertyValue('--team-b-core')).toBe(colours.B.core);
    expect(saved.team1Color).not.toBe(saved.team2Color);
  });

  it('repeats the goal moment without replacing the focused key', () => {
    render(<MonoQuickMatch />);
    const key=screen.getByRole('button', {name:'Add 1 to Strikers'});
    key.focus(); fireEvent.click(key);
    const first=key.dataset.action;
    act(() => vi.advanceTimersByTime(200));
    fireEvent.click(key);
    expect(key.dataset.action).not.toBe(first);
    expect(key).toHaveFocus();
    expect(key).toHaveClass('tgb-moment');
    expect(screen.getByLabelText('Strikers score')).toHaveTextContent('2');
  });

  it('keeps points-target completion on the existing path', async () => {
    seed({format:{mode:'points',target:3},gScore1:2});
    render(<MonoQuickMatch />);
    await act(async () => fireEvent.click(screen.getByRole('button', {name:'Add 1 to Strikers'})));
    expect(storage.saveQuickMatch).toHaveBeenCalledWith(expect.objectContaining({score1:3,score2:0,status:'completed'}));
  });

  it.each([['#111111','#facc15'],['#16a34a','#2563eb'],['#ffffff','#ffffff']])('gates key labels and the hockey mark (%s / %s)', (a,b) => {
    for(const [label,ratio,minimum] of contrastReport({...deriveTeamColours(a,b),sport:sportIdentity('hockey')})) expect(ratio,label).toBeGreaterThanOrEqual(minimum);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { getSportById } from '../../models/sportRegistry';

const ctx = vi.hoisted(() => ({ sport: 'volleyball' }));
vi.mock('convex/react', () => ({ useQuery: () => undefined, useMutation: () => vi.fn() }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(), useParams: () => ({ sport: ctx.sport }),
  useLocation: () => ({ pathname: `/${ctx.sport}/quick`, search: '' }),
  useSearchParams: () => [new URLSearchParams('resume=3003'), vi.fn()],
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, cloudAuthAvailable: false }) }));
vi.mock('../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ point: vi.fn(), undo: vi.fn(), finalize: vi.fn(), reset: vi.fn(), isLive: false }) }));
vi.mock('../../lib/live/liveSession', () => ({ getConsent: () => 'declined', loadSession: () => null, saveSession: vi.fn() }));

const { default: MonoQuickMatch } = await import('./MonoQuickMatch');
const line = () => document.querySelector('.tsb-last');
const scores = () => [...document.querySelectorAll('.tsb-big')].map(el => el.textContent);
const draftKey = () => `se_quickmatch_draft_${ctx.sport}_3003`;
const savedDraft = () => JSON.parse(localStorage.getItem(draftKey()));
let now;
const point = (team = 'Royals') => {
  now += 200;
  fireEvent.click(screen.getByRole('button', { name: `Add point for ${team}` }));
};
const undo = () => fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
function seed(sport, extra = {}) {
  ctx.sport = sport;
  const target = getSportById(sport).config.pointsPerSet;
  localStorage.setItem(draftKey(), JSON.stringify({
    phase: 'scoring', sport, quickMatchId: 3003, team1Name: 'Royals', team2Name: 'Strikers',
    format: { type: 'best-of', sets: 3 }, updatedAt: new Date().toISOString(),
    sets: [{ score1: target - 2, score2: target - 2, completed: false }], currentSet: 0,
    ...extra,
  }));
  return { target, unit: getSportById(sport).config.setLabel || 'Set' };
}
async function mount() {
  const view = render(<MonoQuickMatch />);
  await screen.findByRole('button', { name: 'Add point for Royals' });
  return view;
}
beforeEach(() => {
  localStorage.clear();
  now = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
});

describe('sets board last-action line', () => {
  it.each(['volleyball', 'badminton', 'tabletennis'])('%s names the completed result, survives remount, and restores the previous point on Undo', async sport => {
    const { target, unit } = seed(sport);
    let view = await mount();
    point();
    const previousLine = `Last: point Royals · ${target - 1}–${target - 2}`;
    expect(line()).toHaveTextContent(previousLine);
    point();
    const resultLine = `${unit} 1 to Royals · ${target}–${target - 2}`;
    expect(line()).toHaveTextContent(resultLine);
    expect(scores()).toEqual(['0', '0']);
    expect(savedDraft()).toMatchObject({ currentSet: 1, sets: [
      { score1: target, score2: target - 2, completed: true },
      { score1: 0, score2: 0, completed: false },
    ] });
    expect(screen.getByRole('button', { name: 'Undo last action' })).toHaveTextContent(`back to ${target - 1}–${target - 2}`);
    view.unmount();
    view = await mount();
    expect(line()).toHaveTextContent(resultLine);
    undo();
    expect(line()).toHaveTextContent(previousLine);
    expect(scores()).toEqual([String(target - 1), String(target - 2)]);
    expect(savedDraft().currentSet).toBe(0);
    view.unmount();
    await mount();
    expect(line()).toHaveTextContent(previousLine);
    point();
    expect(line()).toHaveTextContent(resultLine);
    point('Strikers');
    expect(line()).toHaveTextContent('Last: point Strikers · 0–1');
    undo();
    expect(line()).toHaveTextContent(resultLine);
  });

  it('keeps the winner and score in board order when the other team wins after a side swap', async () => {
    seed('badminton', { sets: [{ score1: 19, score2: 20, completed: false }] });
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Swap sides' }));
    point('Strikers');
    expect(line()).toHaveTextContent('Game 1 to Strikers · 21–19');
    expect([...document.querySelectorAll('.tsb-who')].map(el => el.textContent)).toEqual(['Strikers', 'Royals']);
  });

  it('does not mistake a correction restored by Undo for a scored point', async () => {
    seed('volleyball');
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Subtract one from Royals' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close match options' }));
    point();
    undo();
    expect(line()).toHaveTextContent('Undid last point');
    expect(line()).not.toHaveTextContent('Last: point');
  });

  it.each(['volleyball', 'badminton', 'tabletennis'])('%s keeps the result through the Finish dialog and removes the board line on match completion', async sport => {
    const { target, unit } = seed(sport);
    await mount();
    point(); point();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(line()).toHaveTextContent(`${unit} 1 to Royals · ${target}–${target - 2}`);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'End match?' })).getByRole('button', { name: 'Keep scoring' }));
    // The next game wins this best-of-three match.
    for (let i = 0; i < target; i++) point();
    await screen.findByRole('region', { name: 'Match result' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Winner: Royals');
    expect(line()).toBeNull();
    expect(localStorage.getItem(draftKey())).toBeNull();
    const result = JSON.parse(localStorage.getItem('se_quickmatches'))[0];
    expect(result).toMatchObject({ status: 'completed', setsWon1: 2, setsWon2: 0 });
    expect(result.sets.at(-1)).toMatchObject({ score1: target, score2: 0, completed: true });
  });
});

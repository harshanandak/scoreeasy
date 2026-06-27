import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// scoreeasy-awy: runs scored off a wide/no-ball must be recordable, the extra
// must NOT consume a legal ball, and a no-ball free hit must persist until the
// next *legal* delivery. There is no existing render harness for this scorer,
// so this test drives the real component to verify those invariants.

const h = vi.hoisted(() => ({
  saveSpy: vi.fn(() => true),
  makeTournament: () => ({
    id: 1,
    teams: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }],
    matches: [{
      id: 'm1',
      team1Id: 1,
      team2Id: 2,
      format: {
        preset: 'custom', overs: 5, players: 6, solo: true,
        totalInnings: 2, trackOvers: true, freeHit: true,
        powerplay: [], lastManStands: false, trialBall: false,
        oneTipOneHand: false, declaration: false, followOn: false,
      },
    }],
    knockoutMatches: [],
  }),
}));

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ sport: 'cricket', id: '1', matchId: 'm1' }),
  useLocation: () => ({ pathname: '/cricket/1/m1', search: '' }),
}));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../utils/storage', () => ({
  loadSportTournaments: () => [h.makeTournament()],
  saveSportTournament: h.saveSpy,
  // The live-broadcast path (useLiveBroadcast/outbox + getConsent) reads these;
  // returning the default keeps consent unset so broadcasting stays OFF in tests.
  loadData: vi.fn((_key, def) => def),
  saveData: vi.fn(() => true),
}));

// The scorer computes isTouchDevice once at module load; force a non-touch
// environment so the keyboard handler attaches in jsdom.
try { delete globalThis.ontouchstart; } catch { /* ignore */ }
try {
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
} catch { /* ignore */ }

const { default: MonoCricketLiveScore } = await import('./MonoCricketLiveScore.jsx');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function renderScorer() {
  const utils = render(<MonoCricketLiveScore />);
  // Wait for the load effect to mount the live scorer controls.
  await screen.findByRole('button', { name: 'No Ball (+1)' });
  const main = () => utils.container.querySelector('.mono-scorer-main-score');
  const runs = () => utils.container.querySelector('.mono-scorer-score-value')?.textContent;
  return { ...utils, main, runs };
}

describe('cricket extras — runs off the delivery (scoreeasy-awy)', () => {
  it('records 4 off a no-ball as +5 total, consumes no legal ball, and keeps the free hit until the next legal ball', async () => {
    const { main, runs } = await renderScorer();

    // Baseline: 0/0, no ball bowled yet.
    expect(runs()).toBe('0/0');
    expect(main().textContent).toContain('0 ov');

    // No ball: +1 penalty, free hit armed, still 0 legal balls.
    fireEvent.click(screen.getByRole('button', { name: 'No Ball (+1)' }));
    expect(runs()).toBe('1/0');
    expect(main().textContent).toContain('FREE HIT');
    expect(main().textContent).toContain('0 ov');

    // Follow-up row appears; 4 hit off the no-ball.
    await screen.findByText('Runs off the no ball (off the bat or byes)');
    fireEvent.click(screen.getByRole('button', { name: '+4' }));

    // +5 total (1 + 4), free hit still armed, STILL no legal ball consumed.
    expect(runs()).toBe('5/0');
    expect(main().textContent).toContain('FREE HIT');
    expect(main().textContent).toContain('0 ov');

    // Next *legal* delivery clears the free hit and finally advances the ball count.
    await wait(160); // clear the 150ms rapid-click guard inherited from the no-ball tap
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    expect(runs()).toBe('6/0');
    expect(main().textContent).not.toContain('FREE HIT');
    expect(main().textContent).toContain('0.1 ov');
  });

  it('records 2 off a wide as +3 total without consuming a legal ball or arming a free hit', async () => {
    const { main, runs } = await renderScorer();

    fireEvent.click(screen.getByRole('button', { name: 'Wide (+1)' }));
    expect(runs()).toBe('1/0');
    expect(main().textContent).not.toContain('FREE HIT');

    await screen.findByText('Runs off the wide (off the bat or byes)');
    fireEvent.click(screen.getByRole('button', { name: '+2' }));

    expect(runs()).toBe('3/0');
    expect(main().textContent).not.toContain('FREE HIT');
    expect(main().textContent).toContain('0 ov');
  });

  it('persists pendingExtra in the autosaved draft so a reload mid-extra keeps the follow-up row', async () => {
    h.saveSpy.mockClear();
    await renderScorer();

    fireEvent.click(screen.getByRole('button', { name: 'No Ball (+1)' }));
    await screen.findByText('Runs off the no ball (off the bat or byes)');

    // The continuous autosave should round-trip the pending extra in draftState.
    await vi.waitFor(() => expect(h.saveSpy).toHaveBeenCalled());
    const savedTournament = h.saveSpy.mock.calls.at(-1)[1];
    const savedMatch = savedTournament.matches.find((m) => m.id === 'm1');
    expect(savedMatch.draftState.pendingExtra).toBe('noBall');
  });

  it('routes number keys to off-the-delivery runs while an extra is pending (keyboard path)', async () => {
    const { runs, main } = await renderScorer();

    // Keyboard "e" = extra (wide) on desktop.
    fireEvent.keyDown(globalThis, { key: 'e' });
    expect(runs()).toBe('1/0');
    await screen.findByText('Runs off the wide (off the bat or byes)');

    // While pending, a number key adds runs off the delivery — not a legal ball.
    fireEvent.keyDown(globalThis, { key: '3' });
    expect(runs()).toBe('4/0');
    expect(main().textContent).toContain('0 ov');
  });
});

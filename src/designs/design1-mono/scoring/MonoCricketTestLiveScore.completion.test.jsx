import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { cricketFinishSeed } from '../../../test/cricketFinishFixtures';
import { ScoringCompletionContext } from './scoringCompletionContext';

const live = vi.hoisted(() => ({ point: vi.fn(), undo: vi.fn(), finalize: vi.fn() }));
vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => live }));
vi.mock('../../../lib/live/liveSession', () => ({ getConsent: () => 'accepted' }));
vi.mock('../live/LiveBroadcastBar', () => ({ default: () => null }));

// Keyboard Undo is part of the race; attach the real desktop key handler.
delete globalThis.ontouchstart;
Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
const { default: MonoCricketTestLiveScore } = await import('./MonoCricketTestLiveScore');

const modes = ['test-tournament', 'test-quick'];
const keyFor = (mode) => mode === 'test-quick' ? 'se_quickmatches' : 'se_cricket';
const storedMatch = (mode) => {
  const data = JSON.parse(localStorage.getItem(keyFor(mode)));
  return mode === 'test-quick' ? data[0] : data[0].matches[0];
};

function seed(mode, wickets = 0, amend = () => {}) {
  const data = cricketFinishSeed(mode);
  const match = mode === 'test-quick' ? data.se_quickmatches[0] : data.se_cricket[0].matches[0];
  match.draftState.innings[3].wickets = wickets;
  amend(match);
  Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
}

function rejectResultWrites(mode) {
  const write = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === keyFor(mode)) {
      const data = JSON.parse(value);
      const match = mode === 'test-quick' ? data[0] : data[0].matches[0];
      if (match.status === 'completed') throw new DOMException('Result storage is full', 'QuotaExceededError');
    }
    return write.call(this, key, value);
  });
}

function mount(mode, complete = vi.fn()) {
  const quick = mode === 'test-quick';
  return render(
    <MemoryRouter initialEntries={[quick ? '/cricket/quick/test-match/300' : '/cricket/tournament/100/match/m1/score']}>
      <ScoringCompletionContext.Provider value={complete}>
        <Routes>
          <Route path="/:sport/quick/test-match/:matchId" element={<MonoCricketTestLiveScore storageMode="quick" />} />
          <Route path="/:sport/tournament/:id/match/:matchId/score" element={<MonoCricketTestLiveScore />} />
        </Routes>
      </ScoringCompletionContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-22T12:00:00Z'));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe.each(modes)('%s terminal Test snapshot', (mode) => {
  it('keeps the terminal wicket and winner together when keyboard Undo arrives within 300 ms', () => {
    seed(mode, 9);
    mount(mode);
    fireEvent.click(screen.getByRole('button', { name: 'OUT' }));
    act(() => {
      vi.advanceTimersByTime(299);
      fireEvent.keyDown(globalThis, { key: 'u' });
      vi.advanceTimersByTime(1);
    });

    const saved = storedMatch(mode);
    expect(saved.status).toBe('completed');
    expect(saved.winner).toBe(mode === 'test-quick' ? 'Alpha' : 'A');
    expect(saved.innings[3]).toMatchObject({ runs: 0, wickets: 10, balls: 1, allOut: true });
    expect(saved.draftState).toBeUndefined();
    expect(live.undo).not.toHaveBeenCalled();
    expect(live.finalize).toHaveBeenCalledOnce();
    expect(live.point.mock.calls.at(-1)[0].snapshot.periodLabel).toContain('0/10');
    expect(screen.queryByRole('button', { name: 'OUT' })).not.toBeInTheDocument();
  });

  it('restores a failed winning save as locked pending completion and retries the preserved innings', () => {
    seed(mode);
    const complete = vi.fn();
    const first = mount(mode, complete);
    const failedSave = rejectResultWrites(mode);
    fireEvent.click(screen.getByRole('button', { name: '2 runs' }));
    expect(storedMatch(mode)).toMatchObject({ status: 'in-progress', draftState: { innings: expect.any(Array) } });
    expect(storedMatch(mode).draftState.innings[3].runs).toBe(2);
    expect(live.finalize).not.toHaveBeenCalled();
    first.unmount();
    failedSave.mockRestore();

    mount(mode, complete);
    fireEvent.keyDown(globalThis, { key: '4' });
    const four = screen.queryByRole('button', { name: 'Four runs' });
    if (four) fireEvent.click(four);
    const recovered = storedMatch(mode);
    expect((recovered.draftState?.innings || recovered.innings)[3].runs).toBe(2);
    expect(recovered.status).toBe('in-progress');
    expect(screen.queryByRole('button', { name: 'Four runs' })).not.toBeInTheDocument();
    expect(screen.getByText('Result not saved. Save & Return to retry.')).toBeInTheDocument();
    expect(live.finalize).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save & Return' }));
    const saved = storedMatch(mode);
    expect(saved.status).toBe('completed');
    expect(saved.innings[3].runs).toBe(2);
    expect(saved.draftState).toBeUndefined();
    expect(live.finalize).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledExactlyOnceWith(mode === 'test-quick' ? '/cricket/quick?result=300' : '/cricket/tournament/100');
  });

  it.each([
    { name: 'all out', innings: { wickets: 10, allOut: true } },
    { name: 'declared innings', innings: { declared: true } },
    { name: 'declared draw', result: { winner: 'draw', desc: 'Match Drawn' } },
  ])('restores an unsaved $name as terminal before exposing input', ({ innings, result }) => {
    seed(mode, 0, match => {
      Object.assign(match.draftState.innings[3], innings);
      match.draftState.result = result;
    });
    mount(mode);
    expect(screen.getByText('Result not saved. Save & Return to retry.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Four runs' })).not.toBeInTheDocument();
    fireEvent.keyDown(globalThis, { key: '4' });
    expect(storedMatch(mode).status).toBe('in-progress');
    fireEvent.click(screen.getByRole('button', { name: 'Save & Return' }));
    const saved = storedMatch(mode);
    expect(saved.status).toBe('completed');
    expect(saved.innings[3].runs).toBe(0);
    expect(saved.winner).toBe(result ? (mode === 'test-quick' ? 'Draw' : 'draw') : (mode === 'test-quick' ? 'Alpha' : 'A'));
    expect(live.finalize).toHaveBeenCalledOnce();
  });

  it('retains a declared draw without scoring history when its result save fails', () => {
    seed(mode);
    const first = mount(mode);
    const failedSave = rejectResultWrites(mode);
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'End as draw' }));
    fireEvent.click(screen.getByRole('button', { name: 'End as draw' }));
    expect(storedMatch(mode).draftState.result).toEqual({ winner: 'draw', desc: 'Match Drawn' });
    expect(storedMatch(mode).draftState.history).toEqual([]);
    first.unmount();
    failedSave.mockRestore();
    mount(mode);
    expect(screen.getByText('Match Drawn')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Four runs' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save & Return' }));
    expect(storedMatch(mode).status).toBe('completed');
    expect(storedMatch(mode).winner).toBe(mode === 'test-quick' ? 'Draw' : 'draw');
  });
});

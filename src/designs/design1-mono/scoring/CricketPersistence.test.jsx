import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { cricketFinishSeed } from '../../../test/cricketFinishFixtures';
import { ScoringCompletionContext } from './scoringCompletionContext';
import MonoCricketGuidedScorerRoute from './MonoCricketGuidedScorerRoute';
import { createInnings, applyDelivery, makeDelivery, makeFormat } from '../../../utils/cricketEngine';

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }));

delete globalThis.ontouchstart;
Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 });
const { default: MonoCricketTestLiveScore } = await import('./MonoCricketTestLiveScore');

const keyFor = kind => kind === 'test-quick' ? 'se_quickmatches' : 'se_cricket';
const stored = kind => {
  const data = JSON.parse(localStorage.getItem(keyFor(kind)));
  return kind === 'test-quick' ? data[0] : data[0].matches[0];
};
function seed(kind, amend = () => {}) {
  const data = cricketFinishSeed(kind);
  if (kind === 'guided') {
    const match = data.se_cricket[0].matches[0];
    match.draftState.innings1 = applyDelivery(createInnings({ striker: 'A1', nonStriker: 'A2', bowler: 'B1' }), makeDelivery({ batsmanRuns: 1 }), makeFormat(match.format));
  }
  amend(kind === 'test-quick' ? data.se_quickmatches[0] : data.se_cricket[0].matches[0]);
  Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
}
function mount(kind, complete = vi.fn()) {
  const quick = kind === 'test-quick';
  return render(<MemoryRouter initialEntries={[quick ? '/cricket/quick/test-match/300' : '/cricket/tournament/100/match/m1/score']}>
    <ScoringCompletionContext.Provider value={complete}><Routes>
      <Route path="/:sport/quick/test-match/:matchId" element={<MonoCricketTestLiveScore storageMode="quick" />} />
      <Route path="/:sport/tournament/:id/match/:matchId/score" element={kind === 'guided' ? <MonoCricketGuidedScorerRoute /> : <MonoCricketTestLiveScore />} />
    </Routes></ScoringCompletionContext.Provider>
  </MemoryRouter>);
}
function rejectResults(kind) {
  const write = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === keyFor(kind)) {
      const data = JSON.parse(value);
      if ((kind === 'test-quick' ? data[0] : data[0].matches[0]).status === 'completed') {
        throw new DOMException('Storage full', 'QuotaExceededError');
      }
    }
    return write.call(this, key, value);
  });
}
function manualFinish() {
  fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Finish & save' }));
}
function expectVisibleInnings(runs, overs) {
  const score = document.querySelector('.mono-scorer-score-value');
  expect(score).toBeVisible();
  expect(score.children[0]).toHaveTextContent(new RegExp(`^${runs}$`));
  expect(score.children[1]).toHaveTextContent('/0');
  expect(score.children[2]).toHaveTextContent(`(${overs} ov)`);
}
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-22T12:00:00Z'));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('cricket persistence transactions', () => {
  it('guided failed final save stays open, retains the winning ball on refresh, and retries once', () => {
    seed('guided');
    const complete = vi.fn();
    const first = mount('guided', complete);
    const failure = rejectResults('guided');
    fireEvent.click(screen.getByRole('button', { name: 'Four' }));
    expect(complete).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/save failed/i);
    expect(stored('guided').draftState.guidedInnings.deliveries).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Undo last ball' }));
    expect(stored('guided').draftState.guidedInnings.deliveries).toHaveLength(1);
    first.unmount();
    const second = mount('guided', complete);
    expect(complete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Retry save' })).toBeInTheDocument();
    failure.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Retry save' }));
    expect(stored('guided')).toMatchObject({ status: 'completed', team2Score: { runs: 4 } });
    expect(complete).toHaveBeenCalledExactlyOnceWith('/cricket/tournament/100');
    second.unmount();
  });

  it('guided completion archives both raw engine innings before clearing the draft', () => {
    seed('guided');
    const firstInnings = stored('guided').draftState.innings1;
    mount('guided');
    fireEvent.click(screen.getByRole('button', { name: 'Four' }));
    const saved = stored('guided');
    expect(saved.status).toBe('completed');
    expect(saved.guidedInnings).toEqual([firstInnings, expect.objectContaining({ deliveries: expect.any(Array) })]);
    expect(saved.guidedInnings[1].deliveries).toHaveLength(1);
    expect(saved.draftState).toBeUndefined();
  });

  it.each(['test-tournament', 'test-quick'])('%s manual finish persists an unfinished match as a draw', (kind) => {
    // Illegal post-Finish inputs must not trigger a separate natural-completion lock.
    seed(kind, match => { match.draftState.innings[0].runs = 20; });
    const complete = vi.fn();
    mount(kind, complete);
    fireEvent.keyDown(globalThis, { key: '1' });
    expectVisibleInnings(1, '0.1');
    expect(stored(kind).draftState.innings[3]).toMatchObject({ runs: 1, balls: 1 });
    manualFinish();
    expect(stored(kind)).toMatchObject({ status: 'completed', winner: kind === 'test-quick' ? 'Draw' : 'draw', completedAt: expect.any(String) });
    expect(stored(kind).innings[3]).toMatchObject({ runs: 1, balls: 1 });
    expect(stored(kind).draftState).toBeUndefined();
    expect(complete).toHaveBeenCalledExactlyOnceWith(kind === 'test-quick' ? '/cricket/quick?result=300' : '/cricket/tournament/100');
    vi.setSystemTime(new Date('2026-10-22T12:00:01Z'));
    fireEvent.keyDown(globalThis, { key: '4' });
    expectVisibleInnings(1, '0.1');
    expect(stored(kind).innings[3]).toMatchObject({ runs: 1, balls: 1 });
    vi.setSystemTime(new Date('2026-10-22T12:00:02Z'));
    fireEvent.click(screen.getByRole('button', { name: '1 run', exact: true }));
    expectVisibleInnings(1, '0.1');
    expect(stored(kind).innings[3]).toMatchObject({ runs: 1, balls: 1 });
    manualFinish();
    expect(stored(kind).innings[3]).toMatchObject({ runs: 1, balls: 1 });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it.each(['test-tournament', 'test-quick'])('%s failed manual finish preserves scoring and Undo before retry', (kind) => {
    seed(kind);
    const complete = vi.fn();
    const first = mount(kind, complete);
    fireEvent.click(screen.getByRole('button', { name: '1 run', exact: true }));
    const failure = rejectResults(kind);
    manualFinish();
    expect(complete).not.toHaveBeenCalled();
    expect(screen.getByText(/Save failed/)).toBeInTheDocument();
    first.unmount();
    mount(kind, complete);
    fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
    expectVisibleInnings(0, '0');
    expect(screen.getByRole('button', { name: 'Undo last action' })).toBeDisabled();
    vi.setSystemTime(new Date('2026-10-22T12:00:01Z'));
    fireEvent.click(screen.getByRole('button', { name: '0 runs', exact: true }));
    expectVisibleInnings(0, '0.1');
    expect(stored(kind).draftState.innings[3]).toMatchObject({ runs: 0, balls: 1 });
    failure.mockRestore();
    manualFinish();
    expectVisibleInnings(0, '0.1');
    expect(stored(kind).innings[3]).toMatchObject({ runs: 0, balls: 1 });
    expect(stored(kind).status).toBe('completed');
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('guided retains both played innings through lineups, break, refresh, and completion', () => {
    const data = cricketFinishSeed('guided');
    const match = data.se_cricket[0].matches[0];
    delete match.team1Score;
    match.format.oversPerInnings = 1;
    match.draftState = { phase: 'setup1' };
    localStorage.setItem('se_cricket', JSON.stringify(data.se_cricket));
    const complete = vi.fn();
    const first = mount('guided', complete);
    const lineup = (a, b, bowler) => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Striker', exact: true }), { target: { value: a } });
      fireEvent.change(screen.getByRole('textbox', { name: 'Non-striker' }), { target: { value: b } });
      fireEvent.change(screen.getByRole('textbox', { name: 'Opening bowler' }), { target: { value: bowler } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirm line-up' }));
    };
    lineup('A1', 'A2', 'B1');
    fireEvent.click(screen.getByRole('button', { name: 'Single' }));
    for (let ball = 0; ball < 5; ball++) fireEvent.click(screen.getByRole('button', { name: 'Dot', exact: true }));
    expect(screen.getByTestId('innings-break')).toHaveTextContent('2');
    const firstInnings = stored('guided').draftState.innings1;
    expect(firstInnings.deliveries).toHaveLength(6);
    first.unmount();
    mount('guided', complete);
    lineup('B1', 'B2', 'A1');
    fireEvent.click(screen.getByRole('button', { name: 'Wide', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Four' }));
    const saved = stored('guided');
    expect(saved.guidedInnings[0]).toEqual(firstInnings);
    expect(saved.guidedInnings[1].deliveries).toHaveLength(2);
    expect(saved.guidedInnings[1].deliveries[0].extras).toEqual([{ type: 'wide', runs: 1 }]);
    expect(saved.guidedInnings[1].deliveries[1]).toMatchObject({ striker: 'B1', nonStriker: 'B2', bowler: 'A1', batsmanRuns: 4 });
    expect(saved).toMatchObject({ status: 'completed', team1Score: { runs: 1, balls: 6 }, team2Score: { runs: 5, balls: 1 } });
    expect(complete).toHaveBeenCalledTimes(1);
  });
});

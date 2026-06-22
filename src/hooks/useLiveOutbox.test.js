import { renderHook, act } from '@testing-library/react';
import { useLiveOutbox } from './useLiveOutbox';
import { enqueue, load, clientEventIdFor } from '../lib/live/outbox';

beforeEach(() => {
  localStorage.clear();
});

function queue(matchId, seq) {
  enqueue({ matchId, seq, clientEventId: clientEventIdFor(matchId, seq), at: seq });
}

describe('useLiveOutbox', () => {
  it('flush() drains the queue through sendFn', async () => {
    queue('m1', 1);
    queue('m1', 2);
    const sendFn = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useLiveOutbox(sendFn));
    await act(async () => {
      await result.current.flush();
    });

    expect(sendFn).toHaveBeenCalledTimes(2);
    expect(load()).toEqual([]);
  });

  it('drains on the window "online" event', async () => {
    queue('m1', 1);
    const sendFn = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useLiveOutbox(sendFn));

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(load()).toEqual([]);
  });

  it('does nothing when disabled (kill-switch)', async () => {
    queue('m1', 1);
    const sendFn = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useLiveOutbox(sendFn, { enabled: false }));
    await act(async () => {
      await result.current.flush();
      window.dispatchEvent(new Event('online'));
    });

    expect(sendFn).not.toHaveBeenCalled();
    expect(load()).toHaveLength(1);
  });

  it('in-flight guard prevents double-drain from concurrent triggers', async () => {
    queue('m1', 1);
    queue('m1', 2);
    let resolveFirst;
    const gate = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    let calls = 0;
    const sendFn = vi.fn(async () => {
      calls += 1;
      if (calls === 1) await gate; // hold the first drain open
    });

    const { result } = renderHook(() => useLiveOutbox(sendFn));

    await act(async () => {
      const first = result.current.flush();
      // Second trigger fires while the first is still in flight.
      const second = result.current.flush();
      expect(await second).toBeNull(); // guarded out
      resolveFirst();
      await first;
    });

    // Only the first drain ran; it processed both items exactly once each.
    expect(sendFn).toHaveBeenCalledTimes(2);
    expect(load()).toEqual([]);
  });
});

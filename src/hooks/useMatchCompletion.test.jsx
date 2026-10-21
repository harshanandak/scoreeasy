import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useMatchCompletion } from './useMatchCompletion';

afterEach(() => vi.useRealTimers());

it('locks synchronously, commits once, and keeps the lock throughout navigation', () => {
  vi.useFakeTimers();
  const { result } = renderHook(useMatchCompletion);
  const stale = result.current;
  const commit = vi.fn(() => true);
  const navigate = vi.fn();
  act(() => {
    stale.complete(commit, navigate, 300);
    expect(stale.locked).toBe(true);
    stale.complete(commit, navigate, 300);
    vi.advanceTimersByTime(299);
  });
  expect(commit).toHaveBeenCalledOnce();
  expect(navigate).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(navigate).toHaveBeenCalledOnce();
  expect(stale.locked).toBe(true);
});

it('releases a failed save for retry and cancels navigation on unmount', () => {
  vi.useFakeTimers();
  const { result, unmount } = renderHook(useMatchCompletion);
  const navigate = vi.fn();
  act(() => result.current.complete(() => false, navigate, 300));
  expect(result.current.locked).toBe(false);
  act(() => result.current.complete(() => true, navigate, 300));
  unmount();
  act(() => vi.advanceTimersByTime(300));
  expect(navigate).not.toHaveBeenCalled();
});

it('can save an automatic result now and leave it exactly once later', () => {
  const { result } = renderHook(useMatchCompletion);
  const navigate = vi.fn();
  act(() => result.current.complete(() => true));
  expect(navigate).not.toHaveBeenCalled();
  act(() => {
    result.current.leave(navigate);
    result.current.leave(navigate);
  });
  expect(navigate).toHaveBeenCalledOnce();
});

it('locks a winning action synchronously before committing its settled snapshot', () => {
  const { result } = renderHook(useMatchCompletion);
  const stale = result.current;
  const commit = vi.fn(() => true);
  act(() => {
    stale.lock();
    expect(stale.locked).toBe(true);
    expect(stale.committed).toBe(false);
  });
  act(() => {
    result.current.complete(commit);
    result.current.complete(commit);
  });
  expect(commit).toHaveBeenCalledOnce();
  expect(result.current.committed).toBe(true);
});

import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimer } from './useTimer';

const wrapper = ({ children }) => <StrictMode>{children}</StrictMode>;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useTimer under the app StrictMode lifecycle', () => {
  it('ticks after effect replay, pauses, resumes, resets and clears its interval on unmount', () => {
    const { result, unmount } = renderHook(useTimer, { wrapper });
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.formatted).toBe('0:02');
    act(() => result.current.pause());
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.elapsed).toBe(2);
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.elapsed).toBe(3);
    act(() => result.current.reset());
    expect(result.current.elapsed).toBe(0);
    expect(result.current.isRunning).toBe(false);
    act(() => result.current.start());
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restores elapsed time and keeps running after effect replay', () => {
    const { result } = renderHook(useTimer, { wrapper });
    act(() => result.current.restore(18 * 60, true));
    expect(result.current.formatted).toBe('18:00');
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.formatted).toBe('18:02');
  });
});

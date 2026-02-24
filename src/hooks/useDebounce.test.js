import { renderHook, act } from '@testing-library/react';
import { useDebounce } from './useDebounce';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('useDebounce', () => {
  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello'));
    expect(result.current).toBe('hello');
  });

  it('does not update before delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'a' } }
    );
    rerender({ value: 'b' });
    act(() => { vi.advanceTimersByTime(499); });
    expect(result.current).toBe('a');
  });

  it('updates after delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'a' } }
    );
    rerender({ value: 'b' });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe('b');
  });

  it('uses default delay of 300ms', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: 'x' } }
    );
    rerender({ value: 'y' });
    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe('x');
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe('y');
  });

  it('only fires once for rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } }
    );
    rerender({ value: 'b' });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ value: 'c' });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ value: 'd' });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe('d');
  });

  it('cleans up on unmount without errors', () => {
    const { rerender, unmount } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } }
    );
    rerender({ value: 'b' });
    unmount();
    // Should not throw after unmount
    act(() => { vi.advanceTimersByTime(300); });
  });
});

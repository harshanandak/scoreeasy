import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom has no Convex provider, so `useConvexConnectionState` would throw.
// Mock it and drive the connection-state shape per test.
vi.mock('convex/react', () => ({
  useConvexConnectionState: vi.fn(),
}));

import { useConvexConnectionState } from 'convex/react';
import ConvexReconnectingFallback from './ConvexReconnectingFallback';

const CONNECTED = {
  isWebSocketConnected: true,
  hasEverConnected: true,
  connectionRetries: 0,
};

const RECONNECTING = {
  isWebSocketConnected: false,
  hasEverConnected: true,
  connectionRetries: 2,
};

describe('ConvexReconnectingFallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.mocked(useConvexConnectionState).mockReset();
  });

  it('renders nothing while the socket is connected', () => {
    vi.mocked(useConvexConnectionState).mockReturnValue(CONNECTED);

    const { container } = render(<ConvexReconnectingFallback />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a compact Kit status only after a four-second drop', () => {
    vi.mocked(useConvexConnectionState).mockReturnValue(RECONNECTING);

    render(<ConvexReconnectingFallback />);

    act(() => vi.advanceTimersByTime(3999));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveClass('kit-connection-status');
    expect(status).not.toHaveClass('mono-alert');
    expect(status).toHaveTextContent(/^Reconnecting$/);
    expect(status.textContent.trim().length).toBeLessThanOrEqual(32);
    // Calm variant: no action buttons.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('never flashes for a short drop, and starts a fresh delay for the next drop', () => {
    vi.mocked(useConvexConnectionState).mockReturnValue(RECONNECTING);
    const { rerender } = render(<ConvexReconnectingFallback />);
    act(() => vi.advanceTimersByTime(3000));
    vi.mocked(useConvexConnectionState).mockReturnValue(CONNECTED);
    rerender(<ConvexReconnectingFallback />);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    vi.mocked(useConvexConnectionState).mockReturnValue(RECONNECTING);
    rerender(<ConvexReconnectingFallback />);
    act(() => vi.advanceTimersByTime(3999));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('hides immediately on reconnect and debounces a later drop again', () => {
    vi.mocked(useConvexConnectionState).mockReturnValue(RECONNECTING);
    const { rerender } = render(<ConvexReconnectingFallback />);
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByRole('status')).toBeInTheDocument();

    vi.mocked(useConvexConnectionState).mockReturnValue(CONNECTED);
    rerender(<ConvexReconnectingFallback />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    vi.mocked(useConvexConnectionState).mockReturnValue(RECONNECTING);
    rerender(<ConvexReconnectingFallback />);
    act(() => vi.advanceTimersByTime(3999));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps the delay running across retries and cancels it on unmount', () => {
    vi.mocked(useConvexConnectionState).mockReturnValue(RECONNECTING);
    const { rerender, unmount } = render(<ConvexReconnectingFallback />);
    act(() => vi.advanceTimersByTime(2000));
    vi.mocked(useConvexConnectionState).mockReturnValue({ ...RECONNECTING, connectionRetries: 3 });
    rerender(<ConvexReconnectingFallback />);
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole('status')).toBeInTheDocument();
    unmount();

    render(<ConvexReconnectingFallback />);
    expect(vi.getTimerCount()).toBe(1);
    cleanup();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stays quiet once retries exceed the calm cap', () => {
    vi.mocked(useConvexConnectionState).mockReturnValue({
      isWebSocketConnected: false,
      hasEverConnected: true,
      connectionRetries: 8,
    });

    const { container } = render(<ConvexReconnectingFallback />);

    expect(container).toBeEmptyDOMElement();
  });

  it('stays quiet before the client has ever connected', () => {
    vi.mocked(useConvexConnectionState).mockReturnValue({
      isWebSocketConnected: false,
      hasEverConnected: false,
      connectionRetries: 1,
    });

    const { container } = render(<ConvexReconnectingFallback />);

    expect(container).toBeEmptyDOMElement();
  });
});

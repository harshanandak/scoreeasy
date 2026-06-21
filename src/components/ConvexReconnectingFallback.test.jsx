import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  afterEach(() => {
    vi.mocked(useConvexConnectionState).mockReset();
  });

  it('renders nothing while the socket is connected', () => {
    vi.mocked(useConvexConnectionState).mockReturnValue(CONNECTED);

    const { container } = render(<ConvexReconnectingFallback />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('surfaces a calm reconnecting status while retrying within bounds', () => {
    vi.mocked(useConvexConnectionState).mockReturnValue(RECONNECTING);

    render(<ConvexReconnectingFallback />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveClass('mono-alert', 'mono-alert-info');
    expect(screen.getByText(/Reconnecting to cloud/i)).toBeInTheDocument();
    // Calm variant: no action buttons.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
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

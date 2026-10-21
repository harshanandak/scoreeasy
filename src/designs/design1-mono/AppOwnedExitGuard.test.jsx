import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { preloadAppRoutes } from '../../test/preloadAppRoutes';
import Design1Mono from './index';

// Renders the real app shell, which code-splits routes via React.lazy. Load every
// route chunk during module collection so no test pays a cold dynamic import()
// inside its findBy/waitFor window (see preloadAppRoutes).
await preloadAppRoutes();

const nativeBackButtonMock = vi.hoisted(() => ({
  installNativeBackButtonGuard: vi.fn(() => vi.fn()),
}));

// The scorer route renders real Convex hooks. Before route chunks were preloaded
// these tests usually finished before the lazy scorer mounted, hiding the
// missing provider; now that it mounts immediately, give it the same inert
// Convex surface the sibling app-shell tests use instead of letting it crash
// into the ErrorBoundary.
vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => [],
  useConvexConnectionState: () => ({
    isWebSocketConnected: true,
    hasEverConnected: true,
    connectionRetries: 0,
  }),
}));

vi.mock('../../mobile/backButton', async (importOriginal) => ({
  ...(await importOriginal()),
  installNativeBackButtonGuard: nativeBackButtonMock.installNativeBackButtonGuard,
}));

describe('app-owned scoring exit guard', () => {
  beforeEach(() => {
    nativeBackButtonMock.installNativeBackButtonGuard.mockClear();
    nativeBackButtonMock.installNativeBackButtonGuard.mockReturnValue(vi.fn());
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
      callback(0);
      return 1;
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the app popstate guard without registering browser beforeunload prompts', async () => {
    const addEventListener = vi.spyOn(globalThis, 'addEventListener');
    const removeEventListener = vi.spyOn(globalThis, 'removeEventListener');

    const { unmount } = render(
      <MemoryRouter initialEntries={['/volleyball/quick']}>
        <Design1Mono />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(addEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
    });

    expect(addEventListener).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));

    unmount();

    expect(removeEventListener).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('lets confirmed native back navigation pass the protected popstate guard once', async () => {
    const historyBack = vi.spyOn(globalThis.history, 'back').mockImplementation(() => {});
    const pushState = vi.spyOn(globalThis.history, 'pushState');

    const { unmount } = render(
      <MemoryRouter initialEntries={['/volleyball/quick']}>
        <Design1Mono />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(nativeBackButtonMock.installNativeBackButtonGuard).toHaveBeenCalledWith(expect.objectContaining({
        goBack: expect.any(Function),
        navigateFallback: expect.any(Function),
      }));
    });

    const options = nativeBackButtonMock.installNativeBackButtonGuard.mock.calls[0][0];
    pushState.mockClear();

    options.goBack();
    globalThis.dispatchEvent(new Event('popstate'));

    expect(historyBack).toHaveBeenCalledTimes(1);
    expect(pushState).not.toHaveBeenCalled();

    unmount();
  });

  it('unwinds the protected scorer entry for confirmed native fallback navigation', async () => {
    const historyBack = vi.spyOn(globalThis.history, 'back').mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={['/volleyball/quick']}>
        <Design1Mono />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(nativeBackButtonMock.installNativeBackButtonGuard).toHaveBeenCalledWith(expect.objectContaining({
        navigateFallback: expect.any(Function),
      }));
    });

    const options = nativeBackButtonMock.installNativeBackButtonGuard.mock.calls[0][0];
    options.navigateFallback('/play?sport=volleyball', {
      replace: true,
      unwindProtectedEntry: true,
    });

    expect(historyBack).toHaveBeenCalledTimes(1);
  });

  it('does not install scoring exit guards on game resume recovery routes', async () => {
    const addEventListener = vi.spyOn(globalThis, 'addEventListener');

    render(
      <MemoryRouter initialEntries={['/game/stale-draft']}>
        <Design1Mono />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Resume link unavailable' })).toBeInTheDocument();
    expect(nativeBackButtonMock.installNativeBackButtonGuard).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalledWith('popstate', expect.any(Function));
  });
});

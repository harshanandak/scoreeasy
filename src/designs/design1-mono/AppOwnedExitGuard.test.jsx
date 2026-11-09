import { matchStorageKey } from '../../utils/accountStorage';
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
  useConvex: () => ({ query: async () => null }),
  useMutation: () => vi.fn(),
  useQuery: () => [],
  useConvexConnectionState: () => ({
    isWebSocketConnected: true,
    hasEverConnected: true,
    connectionRetries: 0,
  }),
}));

// Capture the completion callback the app shell hands to the scorers, so a test can
// call it the way a finishing scorer does (and again after the shell is gone).
const completionCapture = vi.hoisted(() => ({ complete: null }));
vi.mock('./scoring/scoringCompletionContext', async (importOriginal) => {
  const actual = await importOriginal();
  const { createElement } = await import('react');
  const RealContext = actual.ScoringCompletionContext;
  const CapturingProvider = ({ value, children }) => {
    completionCapture.complete = value;
    return createElement(RealContext.Provider, { value }, children);
  };
  return { ...actual, ScoringCompletionContext: { ...RealContext, Provider: CapturingProvider } };
});

vi.mock('../../mobile/backButton', async (importOriginal) => ({
  ...(await importOriginal()),
  installNativeBackButtonGuard: nativeBackButtonMock.installNativeBackButtonGuard,
}));

describe('app-owned scoring exit guard', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(matchStorageKey('se_quickmatch_draft_volleyball'), JSON.stringify({
      sport: 'volleyball', phase: 'scoring', team1Name: 'Red', team2Name: 'Blue',
      sets: [{ score1: 1, score2: 0, completed: false }], updatedAt: new Date().toISOString(),
    }));
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

  describe('pending fallback navigation after the guard is gone', () => {
    const mountScorer = async () => {
      const view = render(
        <MemoryRouter initialEntries={['/volleyball/quick']}>
          <Design1Mono />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(nativeBackButtonMock.installNativeBackButtonGuard).toHaveBeenCalled();
      });
      const { goBack } = nativeBackButtonMock.installNativeBackButtonGuard.mock.calls.at(-1)[0];
      return { ...view, goBack };
    };

    afterEach(() => {
      vi.useRealTimers();
    });

    it('clears a pending fallback timer and popstate listener when the scorer unmounts', async () => {
      vi.spyOn(globalThis.history, 'back').mockImplementation(() => {});
      const { goBack, unmount } = await mountScorer();

      vi.useFakeTimers();
      goBack();
      expect(vi.getTimerCount()).toBe(1);

      const removeEventListener = vi.spyOn(globalThis, 'removeEventListener');
      unmount();

      expect(vi.getTimerCount()).toBe(0);
      expect(removeEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    });

    it('starts no fallback timer or popstate listener when a stale exit callback runs after unmount', async () => {
      vi.spyOn(globalThis.history, 'back').mockImplementation(() => {});
      const { goBack, unmount } = await mountScorer();
      unmount();

      vi.useFakeTimers();
      const addEventListener = vi.spyOn(globalThis, 'addEventListener');
      goBack();

      expect(vi.getTimerCount()).toBe(0);
      expect(addEventListener).not.toHaveBeenCalledWith('popstate', expect.any(Function), expect.anything());
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    });
  });

  describe('pending completion unwind after the app shell is gone', () => {
    const mountWithIndexedHistory = async () => {
      // A numeric history index makes the completion unwind (history.go + fallback).
      Object.defineProperty(globalThis.history, 'state', { configurable: true, get: () => ({ idx: 1 }) });
      vi.spyOn(globalThis.history, 'go').mockImplementation(() => {});
      completionCapture.complete = null;
      const view = render(
        <MemoryRouter initialEntries={['/volleyball/quick']}>
          <Design1Mono />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(completionCapture.complete).toBeTypeOf('function');
      });
      return { ...view, complete: completionCapture.complete };
    };

    afterEach(() => {
      delete globalThis.history.state;
      vi.useRealTimers();
    });

    it('clears a pending completion timer and popstate listener when the shell unmounts', async () => {
      const { complete, unmount } = await mountWithIndexedHistory();

      vi.useFakeTimers();
      complete('/volleyball/result');
      expect(vi.getTimerCount()).toBe(1);

      const removeEventListener = vi.spyOn(globalThis, 'removeEventListener');
      unmount();

      expect(vi.getTimerCount()).toBe(0);
      expect(removeEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    });

    it('starts no completion timer or popstate listener when it is called after unmount', async () => {
      const { complete, unmount } = await mountWithIndexedHistory();
      unmount();

      vi.useFakeTimers();
      const addEventListener = vi.spyOn(globalThis, 'addEventListener');
      complete('/volleyball/result');

      expect(vi.getTimerCount()).toBe(0);
      expect(addEventListener).not.toHaveBeenCalledWith('popstate', expect.any(Function), expect.anything());
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    });
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

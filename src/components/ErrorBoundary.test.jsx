import { createRef, lazy, Suspense } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/react';
import ErrorBoundary from './ErrorBoundary';
import { CHUNK_RELOAD_KEY, clearChunkReloadAttempt } from '../utils/chunkReload';
import { markSaveFailed, resetSaveHealth } from '../utils/saveHealth';

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

const CHUNK_MESSAGE = 'Failed to fetch dynamically imported module: https://scoreeasy.app/assets/MonoPlayHub-deadbeef.js';

// Module level on purpose: a lazy() created inside render is a new component every render and
// would suspend forever instead of surfacing the rejection.
const StaleRoute = lazy(() => Promise.reject(new TypeError(CHUNK_MESSAGE)));

function Thrower({ message }) {
  throw new Error(message);
}

describe('ErrorBoundary', () => {
  let reload;
  let assign;

  beforeEach(() => {
    reload = vi.fn();
    assign = vi.fn();
    vi.stubGlobal('location', { ...globalThis.location, reload, assign });
    globalThis.sessionStorage.clear();
    resetSaveHealth();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetSaveHealth();
    vi.mocked(Sentry.captureException).mockClear();
  });

  it('lets users retry after a recoverable route crash', () => {
    const boundaryRef = createRef();
    render(
      <ErrorBoundary ref={boundaryRef}>
        <p>Recovered content</p>
      </ErrorBoundary>,
    );

    act(() => {
      boundaryRef.current.setState({ hasError: true, error: new Error('test crash') });
    });

    expect(screen.getByText('This screen hit a problem')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('Recovered content')).toBeInTheDocument();
  });

  it('reloads once on a stale chunk and never shows the crash screen', async () => {
    render(
      <Suspense fallback={<p>Loading</p>}>
        <ErrorBoundary>
          <StaleRoute />
        </ErrorBoundary>
      </Suspense>,
    );

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('This screen hit a problem')).not.toBeInTheDocument();
    expect(screen.queryByText('A new version of Score Easy is ready')).not.toBeInTheDocument();
    expect(globalThis.sessionStorage.getItem(CHUNK_RELOAD_KEY)).toMatch(/^\d+$/);
    // An auto-reloaded chunk error is not a crash.
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('shows the new-version screen when the chunk still fails right after a reload', async () => {
    globalThis.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now() - 2000));

    render(
      <Suspense fallback={<p>Loading</p>}>
        <ErrorBoundary>
          <StaleRoute />
        </ErrorBoundary>
      </Suspense>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('A new version of Score Easy is ready');
    expect(reload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('shows the new-version screen when the same failure comes back 12 seconds after the reload', async () => {
    globalThis.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now() - 12_000));

    render(
      <Suspense fallback={<p>Loading</p>}>
        <ErrorBoundary>
          <StaleRoute />
        </ErrorBoundary>
      </Suspense>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('A new version of Score Easy is ready');
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads again after a successful startup clears the attempt', async () => {
    globalThis.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now() - 60_000));
    clearChunkReloadAttempt();

    render(
      <Suspense fallback={<p>Loading</p>}>
        <ErrorBoundary>
          <StaleRoute />
        </ErrorBoundary>
      </Suspense>,
    );

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('does not auto-reload while a local save failure is outstanding, and warns instead of promising', async () => {
    markSaveFailed('se_quickmatch_draft_volleyball_1');

    render(
      <Suspense fallback={<p>Loading</p>}>
        <ErrorBoundary>
          <StaleRoute />
        </ErrorBoundary>
      </Suspense>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('A new version of Score Easy is ready');
    expect(alert).toHaveTextContent('may not be saved');
    expect(alert).not.toHaveTextContent('Your scores are saved');
    expect(reload).not.toHaveBeenCalled();
    expect(globalThis.sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull();
  });

  it('Reload clears the recorded attempt before reloading', async () => {
    globalThis.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));

    render(
      <Suspense fallback={<p>Loading</p>}>
        <ErrorBoundary>
          <StaleRoute />
        </ErrorBoundary>
      </Suspense>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Reload' }));
    expect(globalThis.sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('Try again clears the recorded attempt', () => {
    globalThis.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    const boundaryRef = createRef();
    render(
      <ErrorBoundary ref={boundaryRef}>
        <p>Recovered content</p>
      </ErrorBoundary>,
    );
    act(() => {
      boundaryRef.current.setState({ hasError: true, error: new Error('test crash') });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(globalThis.sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull();
  });

  it('shows the Kit crash screen for a normal error, with Try again and Home', () => {
    render(
      <ErrorBoundary>
        <Thrower message="boom" />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('This screen hit a problem');
    expect(alert).toHaveTextContent('Try again, or go Home.');
    expect(alert).not.toHaveTextContent(/saved/i);
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(assign).toHaveBeenCalledWith('/app');
  });

  it('keeps a silent fallback boundary silent on a chunk error', () => {
    render(
      <ErrorBoundary fallback={<p>quiet</p>} captureToSentry={false}>
        <Thrower message={CHUNK_MESSAGE} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('quiet')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });
});

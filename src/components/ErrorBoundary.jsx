import { AuthContext } from '../auth/AuthContext';
import { getHomePath } from '../utils/appEntry';
import React from 'react';
import PropTypes from 'prop-types';
import * as Sentry from '@sentry/react';
import { clearChunkReloadAttempt, isChunkLoadError, reloadOnceForNewVersion } from '../utils/chunkReload';
import { hasOutstandingSaveFailure } from '../utils/saveHealth';
import { AppScoringConfirmDialog } from '../designs/design1-mono/components/AppScoringPrompt';
import '../designs/design1-mono/kit/kit.css';
import '../designs/design1-mono/kit/history.css';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
  static contextType = AuthContext;
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, reloading: false, confirmingDiscard: false, discardFailed: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // A stale chunk after a deploy is not a crash: reload once to pick up the new
    // build. Only full-screen boundaries do this; a silent-fallback widget keeps
    // isolating its own failure. The live match draft is saved on every change, so the
    // reload restores it. reloadOnceForNewVersion refuses when a reload was already tried
    // (it must reach a successful startup first) or when a local save failed and the newest
    // score may exist only in memory; the screen below then takes over.
    if (this.props.fallback === undefined && isChunkLoadError(error) && reloadOnceForNewVersion()) {
      this.setState({ reloading: true });
      return;
    }

    if (this.props.captureToSentry !== false) {
      Sentry.captureException(error, {
        extra: {
          componentStack: errorInfo?.componentStack,
        },
      });
    }

    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }
  }

  handleReload = () => {
    clearChunkReloadAttempt();
    globalThis.location.reload();
  };

  handleRetry = () => {
    clearChunkReloadAttempt();
    this.setState({ hasError: false, error: null, reloading: false, confirmingDiscard: false, discardFailed: false });
  };

  handleHome = () => {
    globalThis.location.assign(getHomePath(this.context?.isAuthenticated));
  };

  // The kept match behind a crashed scoring board, if there is one. Looked up only when the crash
  // screen renders, and never allowed to break it.
  getDiscard() {
    try {
      return this.props.getDiscard?.() || null;
    } catch {
      return null;
    }
  }

  handleDiscard = () => {
    const discard = this.getDiscard();
    if (discard && discard.run() !== false) {
      this.handleHome();
      return;
    }
    this.setState({ confirmingDiscard: false, discardFailed: true });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    // A caller can opt into a custom (or silent `null`) fallback instead of the
    // full-page panel — used to isolate a non-critical widget (e.g. the home
    // "Live now" strip) so its failure never takes down the surrounding page.
    if (this.props.fallback !== undefined) return this.props.fallback;

    if (this.state.reloading) {
      return (
        <div className="se-crash">
          <p className="se-crash-status" role="status">Updating Score Easy…</p>
        </div>
      );
    }

    const isStale = isChunkLoadError(this.state.error);
    const title = isStale
      ? 'A new version of Score Easy is ready'
      : this.props.title || 'This screen hit a problem';
    // No promise that scores are saved: a failed local save can leave the newest point in memory
    // only. Say what is true, and warn when a save failure is outstanding.
    let message = this.props.message || 'Try again, or go Home.';
    if (isStale) {
      message = hasOutstandingSaveFailure()
        ? 'Your latest score may not be saved on this device. Reloading can lose it.'
        : 'Reload to get it.';
    }

    const discard = isStale ? null : this.getDiscard();
    return (
      <div className="se-crash">
        <section className="kit-card kit-empty se-crash-card" role="alert" aria-labelledby="se-crash-title">
          <h2 id="se-crash-title">{title}</h2>
          <p>{message}</p>
          {import.meta.env.DEV && this.state.error?.message && (
            <pre className="se-crash-detail">{this.state.error.message}</pre>
          )}
          <div className="kit-btnstack">
            {isStale ? (
              <button type="button" className="se-go" onClick={this.handleReload}>
                Reload
              </button>
            ) : (
              <button type="button" className="se-go" onClick={this.handleRetry}>
                Try again
              </button>
            )}
            <button type="button" className="se-ctl" onClick={this.handleHome}>
              Home
            </button>
            {discard && (
              <button type="button" className="se-crash-quiet" aria-label={discard.name} onClick={() => this.setState({ confirmingDiscard: true, discardFailed: false })}>
                {discard.label}
              </button>
            )}
          </div>
          {discard && this.state.discardFailed && (
            <p className="se-crash-status" role="status">Could not remove this match. Try again.</p>
          )}
          {discard && this.state.confirmingDiscard && (
            <AppScoringConfirmDialog
              {...discard.prompt}
              onCancel={() => this.setState({ confirmingDiscard: false })}
              onConfirm={this.handleDiscard}
            />
          )}
        </section>
      </div>
    );
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node,
  title: PropTypes.string,
  message: PropTypes.string,
  // When provided (including `null`), render this instead of the default panel.
  fallback: PropTypes.node,
  onError: PropTypes.func,
  // Returns { label, name, prompt, run } when a kept match sits behind this screen; adds a quiet Discard action.
  getDiscard: PropTypes.func,
  captureToSentry: PropTypes.bool,
};

export default ErrorBoundary;

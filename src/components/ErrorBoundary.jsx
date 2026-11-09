import React from 'react';
import PropTypes from 'prop-types';
import * as Sentry from '@sentry/react';
import { isChunkLoadError, reloadOnceForNewVersion } from '../utils/chunkReload';
import '../designs/design1-mono/kit/kit.css';
import '../designs/design1-mono/kit/history.css';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, reloading: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // A stale chunk after a deploy is not a crash: reload once to pick up the new
    // build. Only full-screen boundaries do this; a silent-fallback widget keeps
    // isolating its own failure. The live match is saved on every change, so the
    // reload restores it.
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
    globalThis.location.reload();
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, reloading: false });
  };

  handleHome = () => {
    globalThis.location.assign('/app');
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
    const message = isStale
      ? 'Reload to get it. Your scores are saved.'
      : this.props.message || 'Your scores are saved.';

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
          </div>
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
  captureToSentry: PropTypes.bool,
};

export default ErrorBoundary;

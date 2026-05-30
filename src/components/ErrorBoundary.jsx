import React from 'react';
import PropTypes from 'prop-types';
import * as Sentry from '@sentry/react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
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
    this.setState({ hasError: false, error: null });
  };

  handleHome = () => {
    globalThis.location.assign('/');
  };

  handlePlay = () => {
    globalThis.location.assign('/play');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen px-6 py-10 flex items-center justify-center">
        <div className="mono-table-panel w-full max-w-lg" style={{ padding: '20px 24px' }}>
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#888' }}>
            Something went wrong
          </p>
          <h2 className="text-lg font-semibold mb-2" style={{ color: '#111' }}>
            {this.props.title || 'Unexpected application error'}
          </h2>
          <p className="text-sm mb-4" style={{ color: '#666' }}>
            {this.props.message || 'A crash was caught so the app can keep running.'}
          </p>
          {import.meta.env.DEV && this.state.error?.message && (
            <pre
              className="text-xs mb-4"
              style={{
                color: '#dc2626',
                background: 'var(--se-color-surface)',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius)',
                padding: '10px',
                overflowX: 'auto',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="mono-btn-primary flex-1"
              style={{ minWidth: 120, padding: '10px 12px', fontSize: '0.8125rem' }}
              onClick={this.handleRetry}
            >
              Try again
            </button>
            <button
              type="button"
              className="mono-btn flex-1"
              style={{ minWidth: 120, padding: '10px 12px', fontSize: '0.8125rem' }}
              onClick={this.handlePlay}
            >
              Play
            </button>
            <button
              type="button"
              className="mono-btn flex-1"
              style={{ minWidth: 120, padding: '10px 12px', fontSize: '0.8125rem' }}
              onClick={this.handleReload}
            >
              Reload
            </button>
            <button
              type="button"
              className="mono-btn flex-1"
              style={{ minWidth: 120, padding: '10px 12px', fontSize: '0.8125rem' }}
              onClick={this.handleHome}
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node,
  title: PropTypes.string,
  message: PropTypes.string,
  onError: PropTypes.func,
  captureToSentry: PropTypes.bool,
};

export default ErrorBoundary;

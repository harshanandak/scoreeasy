import PropTypes from 'prop-types';

/**
 * Renders the branded loading state while app routes or auth state initialize.
 */
export default function AppLoading({ message = 'Loading Score Easy', compact = false }) {
  return (
    <div className={`app-loading${compact ? ' app-loading-compact' : ''}`} role="status" aria-live="polite">
      <div className="app-loading-panel" aria-label={message}>
        <div className="app-loading-brand">
          <span>SCORE</span>
          <span>EASY</span>
        </div>

        <div className="app-loading-progress" aria-hidden="true">
          <span />
        </div>

        <p>{message}</p>
      </div>
    </div>
  );
}

AppLoading.propTypes = {
  message: PropTypes.string,
  compact: PropTypes.bool,
};

import PropTypes from 'prop-types';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '../../../hooks/useAuth';
import ErrorBoundary from '../../../components/ErrorBoundary';
import '../kit/live.css';

function FeedButton({ children, ...props }) {
  const matches = useQuery(api.live.listLiveFeed, {});
  const count = Array.isArray(matches) ? matches.length : 0;
  return (
    <button {...props} aria-label={count ? `Live, ${count} ${count === 1 ? 'match' : 'matches'} now` : undefined}>
      {children}
      {count > 0 && <span className="kit-nav-live-dot" aria-hidden="true" />}
    </button>
  );
}
FeedButton.propTypes = { children: PropTypes.node };

// A missing discovery endpoint must never take down the navigation shell.
export default function LiveNavButton({ children, ...props }) {
  const { cloudAuthAvailable } = useAuth();
  const plain = <button {...props}>{children}</button>;
  if (!cloudAuthAvailable) return plain;
  return (
    <ErrorBoundary fallback={plain} captureToSentry={false}>
      <FeedButton {...props}>{children}</FeedButton>
    </ErrorBoundary>
  );
}
LiveNavButton.propTypes = { children: PropTypes.node };

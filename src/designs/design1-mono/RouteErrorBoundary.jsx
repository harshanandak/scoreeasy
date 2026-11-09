import { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useLocation } from 'react-router-dom';
import ErrorBoundary from '../../components/ErrorBoundary';
import { findKeptMatchForUrl } from '../../utils/appEntry';
import { deleteInProgressMatch, discardMatchPrompt, inProgressSummary } from '../../utils/inProgressMatch';

/* The route-level crash boundary. When a scoring board crashes and a kept match lives at this URL, the
   crash screen can discard it, so a board that cannot open never strands its Home row. */
export default function RouteErrorBoundary({ children }) {
  const { pathname, search } = useLocation();
  const getDiscard = useCallback(() => {
    const match = findKeptMatchForUrl(pathname, search);
    if (!match) return null;
    return {
      label: 'Discard this match',
      name: `Discard this match: ${inProgressSummary(match).title}`,
      prompt: discardMatchPrompt(match),
      run: () => deleteInProgressMatch(match),
    };
  }, [pathname, search]);
  return <ErrorBoundary getDiscard={getDiscard}>{children}</ErrorBoundary>;
}

RouteErrorBoundary.propTypes = { children: PropTypes.node };

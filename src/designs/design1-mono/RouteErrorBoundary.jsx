import { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useLocation } from 'react-router-dom';
import ErrorBoundary from '../../components/ErrorBoundary';
import { findKeptMatchForUrl } from '../../utils/appEntry';
import { deleteInProgressMatch, discardMatchPrompt, inProgressTitle } from '../../utils/inProgressMatch';

/* The route-level crash boundary. When a scoring board crashes and a kept match lives at this URL, the
   crash screen can discard it, so a board that cannot open never strands its Home row. */
export default function RouteErrorBoundary({ children, ...boundaryProps }) {
  const { pathname, search, state } = useLocation();
  const getDiscard = useCallback(() => {
    const match = findKeptMatchForUrl(pathname, search, state);
    if (!match) return null;
    return {
      label: 'Discard this match',
      name: `Discard this match: ${inProgressTitle(match)}`,
      prompt: discardMatchPrompt(match),
      run: () => deleteInProgressMatch(match),
    };
  }, [pathname, search, state]);
  return <ErrorBoundary {...boundaryProps} getDiscard={getDiscard}>{children}</ErrorBoundary>;
}

RouteErrorBoundary.propTypes = { children: PropTypes.node, title: PropTypes.string, message: PropTypes.string };

import { useEffect, useState } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { useConvexReconnecting } from '../auth/useConvexReconnecting';
import '../designs/design1-mono/kit/history.css';

/**
 * Calm, low-emphasis status surfaced while the Convex WebSocket is briefly
 * reconnecting (dropped after connecting, still retrying within bounds).
 *
 * Provider safety: this calls `useConvexReconnecting`, which calls
 * `useConvexConnectionState()` — that THROWS outside a ConvexProvider. The
 * component is therefore only ever rendered in cloud mode (gated by
 * `authMode === 'cloud'` at the call site). The hook is still called
 * unconditionally here so React's hook rules hold.
 *
 * Spectator page: `/live/:token` shows its own "Reconnecting to live updates"
 * banner, so this pill stays out of the DOM there instead of repeating it. The
 * route is checked here, not with a CSS class set by the page, so a hidden pill
 * also does not announce a second `role="status"` to screen readers. The
 * component always renders inside the router.
 */
const WATCH_ROUTE = { path: '/live/:token', end: true };

export default function ConvexReconnectingFallback() {
  const isReconnecting = useConvexReconnecting();
  const { pathname } = useLocation();
  const [showStatus, setShowStatus] = useState(false);
  const onWatchPage = matchPath(WATCH_ROUTE, pathname) !== null;

  useEffect(() => {
    if (!isReconnecting) {
      setShowStatus(false);
      return;
    }

    const timeout = setTimeout(() => setShowStatus(true), 4000);
    return () => clearTimeout(timeout);
  }, [isReconnecting]);

  if (onWatchPage || !isReconnecting || !showStatus) return null;

  return (
    <div
      className="kit-connection-status"
      role="status"
      aria-live="polite"
    >
      Reconnecting
    </div>
  );
}

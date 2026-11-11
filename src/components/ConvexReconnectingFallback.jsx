import { useEffect, useState } from 'react';
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
 */
export default function ConvexReconnectingFallback() {
  const isReconnecting = useConvexReconnecting();
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    if (!isReconnecting) {
      setShowStatus(false);
      return;
    }

    const timeout = setTimeout(() => setShowStatus(true), 4000);
    return () => clearTimeout(timeout);
  }, [isReconnecting]);

  if (!isReconnecting || !showStatus) return null;

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

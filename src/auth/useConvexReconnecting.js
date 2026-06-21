import { useConvexConnectionState } from 'convex/react';

/**
 * Returns true only while the Convex WebSocket has dropped *after* having
 * connected at least once and the client is actively retrying within a bounded
 * window. The `connectionRetries < 8` cap keeps the indicator calm: once the
 * client has retried past the cap (a sustained outage), we go quiet instead of
 * showing a never-ending banner. The offline UI already covers hard offline.
 *
 * MUST be called inside a ConvexProvider — `useConvexConnectionState()` throws
 * otherwise — so the consuming component is only ever mounted in cloud mode.
 */
export function useConvexReconnecting() {
  const state = useConvexConnectionState();

  return (
    !state.isWebSocketConnected &&
    state.hasEverConnected &&
    state.connectionRetries > 0 &&
    state.connectionRetries < 8
  );
}

export default useConvexReconnecting;

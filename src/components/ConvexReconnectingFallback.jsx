import { useConvexReconnecting } from '../auth/useConvexReconnecting';

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

  if (!isReconnecting) return null;

  return (
    <div
      className="mono-alert mono-alert-info"
      style={{
        margin: '8px auto 0',
        maxWidth: '640px',
        padding: '12px',
      }}
      role="status"
      aria-live="polite"
    >
      <p className="text-xs uppercase tracking-widest" style={{ marginBottom: '4px' }}>
        Reconnecting
      </p>
      <p className="text-sm" style={{ color: 'var(--se-color-ink-soft)', margin: 0 }}>
        Reconnecting to cloud&hellip; Your scores stay saved on this device while the
        connection is restored.
      </p>
    </div>
  );
}

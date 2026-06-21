# PR9 — Auth Runtime Verification Runbook

Date: 2026-06-20
Covers: **ngb.4 / I-060** (Clerk→Convex 404) and the runtime half of **ngb.5 / I-061** (Convex WebSocket 1006).

This runbook documents how to *close* the two auth-runtime issues by verifying behavior in a live deployment. The code fixes are already merged; what remains is runtime confirmation against the deployed Convex + Clerk configuration.

---

## ngb.4 / I-060 — Clerk → Convex token 404

### Status
The code fix (Clerk issuer normalization) is **merged via #74**. `convex/auth.config.ts` reads `CLERK_JWT_ISSUER_DOMAIN` (primary) or `CLERK_FRONTEND_API_URL` (fallback), defaulting to `https://clerk.scoreeasy.app`, normalized to `https` with no trailing slash, and sets `applicationID: "convex"`.

### Runtime verification steps
1. **Set the Convex deployment env var.** In the Convex dashboard (or via CLI) for the target deployment, set:
   ```
   CLERK_JWT_ISSUER_DOMAIN = https://clerk.scoreeasy.app
   ```
   (or `CLERK_FRONTEND_API_URL` if that is the channel in use). It must be exactly `https://`, **no trailing slash**. A trailing slash or `http://` is the classic cause of the 404 loop.
2. **Confirm the Clerk JWT template.** In the Clerk dashboard, ensure a JWT template exists whose **name / audience is `convex`** so the minted token's `aud` claim matches Convex's `applicationID: "convex"`.
3. **Run a signed-in session.** Sign in to the deployed app. Open DevTools → Network and watch the Clerk token endpoint (`.../tokens` and the Convex auth handshake).
4. **Inspect the JWT.** Copy the issued JWT (from the token response or `await window.Clerk.session.getToken({ template: 'convex' })`) and decode it (jwt.io or `atob` the payload). Confirm:
   - `aud` === `convex`
   - `iss` === `https://clerk.scoreeasy.app` (matches the normalized issuer)

### Close-condition
A clean signed-in trace: **no repeating 404** on the Clerk/Convex token endpoint, and the JWT `aud` is `convex`. When observed, close ngb.4 / I-060.

---

## ngb.5 / I-061 — Convex WebSocket 1006 (abnormal closure)

WebSocket close code `1006` means the connection dropped without a clean close frame. It can be **genuine network/WS instability** or a **downstream symptom of the auth 404** above (token rejected → socket torn down → reconnect). This PR adds a calm reconnecting indicator (`ConvexReconnectingFallback`) so transient instability is surfaced gracefully rather than silently.

### Discriminating test — which cause is it?
Use `useConvexConnectionState()` to watch the live connection fields while reproducing the drop. Paste this in the browser console of a signed-in session (it polls the client's connection state):

```js
// Logs Convex connection-state fields once a second.
// `client` is the ConvexReactClient instance; if not exposed globally,
// read these inside a component via useConvexConnectionState() instead.
const log = () => {
  const s = window.__convexClient?.connectionState?.();
  if (!s) return;
  console.log('[convex]', {
    online: navigator.onLine,
    isWebSocketConnected: s.isWebSocketConnected,
    hasEverConnected: s.hasEverConnected,
    connectionRetries: s.connectionRetries,
    connectionCount: s.connectionCount,
    hasInflightRequests: s.hasInflightRequests,
    at: new Date().toISOString(),
  });
};
const id = setInterval(log, 1000); // clearInterval(id) to stop
```

Equivalent React snippet (drop into any component mounted in cloud mode):

```jsx
import { useEffect } from 'react';
import { useConvexConnectionState } from 'convex/react';

function ConnectionTrace() {
  const s = useConvexConnectionState();
  useEffect(() => {
    console.log('[convex]', {
      online: navigator.onLine,
      isWebSocketConnected: s.isWebSocketConnected,
      hasEverConnected: s.hasEverConnected,
      connectionRetries: s.connectionRetries,
    });
  }, [s.isWebSocketConnected, s.connectionRetries]);
  return null;
}
```

### Interpreting the trace
- **Genuine WS instability:** `connectionRetries` climbs and `isWebSocketConnected` flaps **while `navigator.onLine === true`**. The drops are not correlated with token lifetime. → This PR's indicator surfaces it calmly (the AC for *graceful handling* is met). The banner appears during retries within the bounded window (`connectionRetries < 8`) and goes quiet on a sustained outage to avoid noise.
- **Auth-driven (the ngb.4 cause):** drops **correlate with token expiry / refresh**, retries stay **low**, and you also see the 404 from ngb.4 in the Network tab. → Not real WS instability; resolved by the ngb.4 env-var fix. After applying that fix, the 1006 loop should stop.

### Close-condition
The `1006` close **no longer loops after the ngb.4 env fix** (auth-driven case resolved). OR — if instability persists independently of auth — the `ConvexReconnectingFallback` indicator provides the calm, graceful handling the AC requires (the reconnecting state is surfaced to the user without a noisy never-ending banner). Either outcome closes ngb.5 / I-061.

---

## Reference — what this PR added (frontend half of ngb.5)
- `src/auth/useConvexReconnecting.js` — hook returning `true` only while dropped-after-connected and retrying within the `< 8` calm cap.
- `src/components/ConvexReconnectingFallback.jsx` — calm `role="status"` / `aria-live="polite"` mono-alert (info variant), copy "Reconnecting to cloud…", no action buttons.
- Wired into `src/designs/design1-mono/index.jsx` beside `OfflineFallback`, gated by `authMode === 'cloud'` so the Convex-only hook never mounts outside a ConvexProvider.

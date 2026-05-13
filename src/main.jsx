import React, { lazy, Suspense, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import App from './App.jsx';
import { LocalAuthProvider } from './auth/AuthContext';
import {
  getAuthBootstrapMode,
  shouldShowNativeCloudProbeLoading,
  shouldUseCloudAuthRoot,
} from './auth/bootstrap';
import { setupNativeChrome } from './mobile/nativeChrome';
import './index.css';

const CloudAuthRoot = lazy(() => import('./auth/CloudAuthRoot'));
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;
const NATIVE_CLOUD_RETRY_DELAY_MS = 5000;

const localConvex = new ConvexReactClient('https://offline-placeholder.convex.cloud');

function isNativeRuntime() {
  return Capacitor.isNativePlatform();
}

function getCurrentOnlineState() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function getCurrentPathname() {
  return typeof globalThis.location?.pathname === 'string'
    ? globalThis.location.pathname
    : '/';
}

function subscribeToPathnameChanges(onChange) {
  if (typeof globalThis.addEventListener !== 'function') {
    return () => {};
  }

  const notify = () => onChange(getCurrentPathname());
  const history = globalThis.history;
  const originalPushState = history?.pushState;
  const originalReplaceState = history?.replaceState;

  if (history && originalPushState && originalReplaceState) {
    history.pushState = function pushState(...args) {
      const result = originalPushState.apply(this, args);
      notify();
      return result;
    };
    history.replaceState = function replaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      notify();
      return result;
    };
  }

  globalThis.addEventListener('popstate', notify);

  return () => {
    globalThis.removeEventListener('popstate', notify);
    if (history?.pushState !== originalPushState && originalPushState) {
      history.pushState = originalPushState;
    }
    if (history?.replaceState !== originalReplaceState && originalReplaceState) {
      history.replaceState = originalReplaceState;
    }
  };
}

async function cleanupNativeServiceWorkerCache() {
  if (!isNativeRuntime() || !('serviceWorker' in navigator)) {
    return;
  }

  const hadController = Boolean(navigator.serviceWorker.controller);
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ('caches' in globalThis) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }

  if (hadController && !sessionStorage.getItem('se-native-sw-cleared')) {
    sessionStorage.setItem('se-native-sw-cleared', '1');
    globalThis.location.reload();
  }
}

function registerWebServiceWorker() {
  if (
    isNativeRuntime() ||
    !import.meta.env.PROD ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }

  globalThis.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

function initSentryAfterStartup() {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (!sentryDsn) {
    return;
  }

  const init = () => {
    import('@sentry/react')
      .then((Sentry) => {
        Sentry.init({
          dsn: sentryDsn,
          environment: import.meta.env.MODE,
          tracesSampleRate: 0.1,
        });
      })
      .catch(() => {});
  };

  if ('requestIdleCallback' in globalThis) {
    globalThis.requestIdleCallback(init, { timeout: 5000 });
    return;
  }

  globalThis.addEventListener('load', () => setTimeout(init, 0), { once: true });
}

// Load React Grab in development mode
if (import.meta.env.DEV) {
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/react-grab/dist/index.global.js';
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}

void setupNativeChrome();
void cleanupNativeServiceWorkerCache();
registerWebServiceWorker();
initSentryAfterStartup();

function RootApp() {
  const [authBootstrap, setAuthBootstrap] = useState(() => getAuthBootstrapMode({
    clerkPublishableKey: PUBLISHABLE_KEY,
    convexUrl: CONVEX_URL,
    isOnline: getCurrentOnlineState(),
  }));
  const [pathname, setPathname] = useState(getCurrentPathname);
  const shouldProbeNativeCloud =
    authBootstrap.mode === 'cloud' && isNativeRuntime();
  const [nativeProbeStatus, setNativeProbeStatus] = useState('idle');
  const [nativeProbeAttempt, setNativeProbeAttempt] = useState(0);

  useEffect(() => {
    const updateAuthBootstrap = () => {
      setAuthBootstrap((currentBootstrap) => {
        if (currentBootstrap.mode === 'cloud') {
          return currentBootstrap;
        }

        return getAuthBootstrapMode({
          clerkPublishableKey: PUBLISHABLE_KEY,
          convexUrl: CONVEX_URL,
          isOnline: getCurrentOnlineState(),
        });
      });
    };

    globalThis.addEventListener('online', updateAuthBootstrap);
    globalThis.addEventListener('offline', updateAuthBootstrap);

    return () => {
      globalThis.removeEventListener('online', updateAuthBootstrap);
      globalThis.removeEventListener('offline', updateAuthBootstrap);
    };
  }, []);

  useEffect(() => subscribeToPathnameChanges(setPathname), []);

  useEffect(() => {
    if (!shouldProbeNativeCloud) {
      setNativeProbeStatus('idle');
      setNativeProbeAttempt(0);
      return;
    }

    setNativeProbeStatus('probing');
    const controller = new AbortController();
    let settled = false;
    let retryTimeout;
    let cancelled = false;

    const finishProbe = (status) => {
      if (cancelled || settled) {
        return;
      }

      settled = true;
      setNativeProbeStatus(status === 'unreachable' ? 'retrying' : status);

      if (status === 'unreachable') {
        retryTimeout = setTimeout(() => {
          setNativeProbeAttempt((attempt) => attempt + 1);
        }, NATIVE_CLOUD_RETRY_DELAY_MS);
      }
    };

    const timeout = setTimeout(() => {
      controller.abort();
      finishProbe('unreachable');
    }, 2500);

    fetch(CONVEX_URL, {
      cache: 'no-store',
      mode: 'no-cors',
      signal: controller.signal,
    })
      .then(() => {
        finishProbe('reachable');
      })
      .catch(() => {
        finishProbe('unreachable');
      })
      .finally(() => {
        clearTimeout(timeout);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      clearTimeout(retryTimeout);
      controller.abort();
    };
  }, [nativeProbeAttempt, shouldProbeNativeCloud]);

  const shouldRenderCloudAuthRoot = shouldUseCloudAuthRoot({
    authMode: authBootstrap.mode,
    shouldProbeNativeCloud,
    nativeProbeStatus,
    nativeProbeAttempt,
    pathname,
  });

  if (shouldRenderCloudAuthRoot) {
    return (
      <Suspense fallback={null}>
        <CloudAuthRoot convexUrl={CONVEX_URL} publishableKey={PUBLISHABLE_KEY}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </CloudAuthRoot>
      </Suspense>
    );
  }

  if (
    shouldShowNativeCloudProbeLoading({
      shouldProbeNativeCloud,
      nativeProbeStatus,
      nativeProbeAttempt,
      pathname,
    })
  ) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
        Loading...
      </div>
    );
  }

  return (
    <ConvexProvider client={localConvex}>
      <LocalAuthProvider
        reason={shouldProbeNativeCloud ? 'native-offline' : authBootstrap.reason}
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </LocalAuthProvider>
    </ConvexProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
);

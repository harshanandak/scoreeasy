import React, { lazy, Suspense, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import App from './App.jsx';
import { LocalAuthProvider } from './auth/AuthContext';
import { getAuthBootstrapMode } from './auth/bootstrap';
import { setupNativeChrome } from './mobile/nativeChrome';
import './index.css';

const CloudAuthRoot = lazy(() => import('./auth/CloudAuthRoot'));
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;

const localConvex = new ConvexReactClient('https://offline-placeholder.convex.cloud');

function isNativeRuntime() {
  return Capacitor.isNativePlatform();
}

function getCurrentOnlineState() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
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
  const [isOnlineState, setIsOnlineState] = useState(getCurrentOnlineState);
  const authBootstrap = getAuthBootstrapMode({
    clerkPublishableKey: PUBLISHABLE_KEY,
    convexUrl: CONVEX_URL,
    isOnline: isOnlineState,
  });
  const shouldProbeNativeCloud =
    authBootstrap.mode === 'cloud' && isNativeRuntime();
  const [nativeProbeStatus, setNativeProbeStatus] = useState('idle');

  useEffect(() => {
    const updateOnlineState = () => setIsOnlineState(getCurrentOnlineState());

    globalThis.addEventListener('online', updateOnlineState);
    globalThis.addEventListener('offline', updateOnlineState);

    return () => {
      globalThis.removeEventListener('online', updateOnlineState);
      globalThis.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!shouldProbeNativeCloud) {
      setNativeProbeStatus('idle');
      return;
    }

    setNativeProbeStatus('probing');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    fetch(CONVEX_URL, {
      cache: 'no-store',
      mode: 'no-cors',
      signal: controller.signal,
    })
      .then(() => {
        setNativeProbeStatus('reachable');
      })
      .catch(() => {
        setNativeProbeStatus('unreachable');
      })
      .finally(() => {
        clearTimeout(timeout);
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [shouldProbeNativeCloud]);

  if (
    authBootstrap.mode === 'cloud' &&
    (!shouldProbeNativeCloud || nativeProbeStatus === 'reachable')
  ) {
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

  if (shouldProbeNativeCloud && nativeProbeStatus !== 'unreachable') {
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

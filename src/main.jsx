import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import * as Sentry from '@sentry/react';
import App from './App.jsx';
import { CloudAuthProvider, LocalAuthProvider } from './auth/AuthContext';
import { getAuthBootstrapMode } from './auth/bootstrap';
import { setupNativeChrome } from './mobile/nativeChrome';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;
const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
const authBootstrap = getAuthBootstrapMode({
  clerkPublishableKey: PUBLISHABLE_KEY,
  convexUrl: CONVEX_URL,
  isOnline,
});

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}

const convex = new ConvexReactClient(
  authBootstrap.mode === 'cloud'
    ? CONVEX_URL
    : 'https://offline-placeholder.convex.cloud',
);

// Load React Grab in development mode
if (import.meta.env.DEV) {
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/react-grab/dist/index.global.js';
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}

void setupNativeChrome();

function RootApp() {
  if (authBootstrap.mode === 'cloud') {
    return (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <ConvexProviderWithClerk client={convex} useAuth={useClerkAuth}>
          <CloudAuthProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </CloudAuthProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    );
  }

  return (
    <ConvexProvider client={convex}>
      <LocalAuthProvider reason={authBootstrap.reason}>
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

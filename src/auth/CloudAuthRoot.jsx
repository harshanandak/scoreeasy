import PropTypes from 'prop-types';
import { useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { ClerkProvider, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import CloudAuthProvider from './CloudAuthProvider';

function navigateInApp(to, replace = false) {
  const target = new URL(to, globalThis.location.origin);

  if (target.origin !== globalThis.location.origin) {
    if (replace) {
      globalThis.location.replace(target.href);
    } else {
      globalThis.location.assign(target.href);
    }
    return;
  }

  const nextUrl = `${target.pathname}${target.search}${target.hash}`;
  if (replace) {
    globalThis.history.replaceState({}, '', nextUrl);
  } else {
    globalThis.history.pushState({}, '', nextUrl);
  }
  globalThis.dispatchEvent(new PopStateEvent('popstate'));
}

export default function CloudAuthRoot({ children, convexUrl, publishableKey }) {
  const convex = useMemo(() => new ConvexReactClient(convexUrl), [convexUrl]);
  const isNative = Capacitor.isNativePlatform();

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl="/"
      signInUrl="/login"
      signUpUrl="/signup"
      signInForceRedirectUrl="/"
      signUpForceRedirectUrl="/"
      standardBrowser={!isNative}
      telemetry={false}
      routerPush={(to) => navigateInApp(to)}
      routerReplace={(to) => navigateInApp(to, true)}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useClerkAuth}>
        <CloudAuthProvider>{children}</CloudAuthProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

CloudAuthRoot.propTypes = {
  children: PropTypes.node,
  convexUrl: PropTypes.string.isRequired,
  publishableKey: PropTypes.string.isRequired,
};

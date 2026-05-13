import PropTypes from 'prop-types';
import { useMemo } from 'react';
import { ClerkProvider, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import CloudAuthProvider from './CloudAuthProvider';

export default function CloudAuthRoot({ children, convexUrl, publishableKey }) {
  const convex = useMemo(() => new ConvexReactClient(convexUrl), [convexUrl]);

  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
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

import PropTypes from 'prop-types';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const LOCAL_AUTH_STATE = {
  authMode: 'local',
  authModeReason: 'missing-config',
  cloudAuthAvailable: false,
  isAuthenticated: false,
  isLoading: false,
  isUserReady: true,
  user: null,
  clerkUser: null,
  needsUsername: false,
  needsOnboarding: false,
};

const AuthContext = createContext(LOCAL_AUTH_STATE);

function getClerkSyncFingerprint(isAuthenticated, isClerkLoaded, clerkUser) {
  if (!isAuthenticated || !isClerkLoaded || !clerkUser) {
    return null;
  }

  return [
    clerkUser.id,
    clerkUser.imageUrl ?? '',
    clerkUser.fullName ?? '',
    clerkUser.primaryEmailAddress?.emailAddress ?? '',
  ].join('|');
}

export function LocalAuthProvider({ children, reason = 'missing-config' }) {
  return (
    <AuthContext.Provider
      value={{
        ...LOCAL_AUTH_STATE,
        authModeReason: reason,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

LocalAuthProvider.propTypes = {
  children: PropTypes.node,
  reason: PropTypes.string,
};

export function CloudAuthProvider({ children }) {
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const storeUser = useMutation(api.users.store);
  const [isBootstrappingUser, setIsBootstrappingUser] = useState(false);
  const lastStoreFingerprintRef = useRef(null);
  const convexUser = useQuery(
    api.users.getCurrent,
    isAuthenticated ? {} : 'skip',
  );
  const clerkSyncFingerprint = getClerkSyncFingerprint(
    isAuthenticated,
    isClerkLoaded,
    clerkUser,
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setIsBootstrappingUser(false);
      lastStoreFingerprintRef.current = null;
      return;
    }

    if (
      !isClerkLoaded ||
      convexUser === undefined ||
      !clerkSyncFingerprint ||
      isBootstrappingUser ||
      lastStoreFingerprintRef.current === clerkSyncFingerprint
    ) {
      return;
    }

    let cancelled = false;
    setIsBootstrappingUser(true);

    storeUser()
      .then(() => {
        if (!cancelled) {
          lastStoreFingerprintRef.current = clerkSyncFingerprint;
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setIsBootstrappingUser(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    clerkSyncFingerprint,
    convexUser,
    isAuthenticated,
    isBootstrappingUser,
    isClerkLoaded,
    storeUser,
  ]);

  const isUserReady = !isAuthenticated || Boolean(convexUser);
  const isLoading =
    isConvexAuthLoading ||
    !isClerkLoaded ||
    (isAuthenticated &&
      (convexUser === undefined ||
        (convexUser === null && isBootstrappingUser)));

  return (
    <AuthContext.Provider
      value={{
        authMode: 'cloud',
        authModeReason: 'available',
        cloudAuthAvailable: true,
        isAuthenticated,
        isLoading,
        isUserReady,
        user: convexUser ?? null,
        clerkUser,
        needsUsername: Boolean(
          isAuthenticated && convexUser && !convexUser.username,
        ),
        needsOnboarding: Boolean(
          isAuthenticated && convexUser && !convexUser.onboardedAt,
        ),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

CloudAuthProvider.propTypes = {
  children: PropTypes.node,
};

export function useAuth() {
  return useContext(AuthContext);
}

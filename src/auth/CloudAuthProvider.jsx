import PropTypes from 'prop-types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { AuthContext } from './AuthContext';

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

export default function CloudAuthProvider({ children }) {
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const storeUser = useMutation(api.users.store);
  const [isBootstrappingUser, setIsBootstrappingUser] = useState(false);
  const [storeRetryTick, setStoreRetryTick] = useState(0);
  const isStoreUserInFlightRef = useRef(false);
  const lastStoreFingerprintRef = useRef(null);
  const nextStoreAttemptAtRef = useRef(0);
  const storeRetryTimerRef = useRef(null);
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
      isStoreUserInFlightRef.current = false;
      setIsBootstrappingUser(false);
      lastStoreFingerprintRef.current = null;
      nextStoreAttemptAtRef.current = 0;
      if (storeRetryTimerRef.current) {
        clearTimeout(storeRetryTimerRef.current);
        storeRetryTimerRef.current = null;
      }
      return;
    }

    if (
      !isClerkLoaded ||
      convexUser === undefined ||
      !clerkSyncFingerprint ||
      isStoreUserInFlightRef.current ||
      Date.now() < nextStoreAttemptAtRef.current ||
      lastStoreFingerprintRef.current === clerkSyncFingerprint
    ) {
      return;
    }

    let cancelled = false;
    isStoreUserInFlightRef.current = true;
    setIsBootstrappingUser(true);

    storeUser()
      .then(() => {
        if (!cancelled) {
          lastStoreFingerprintRef.current = clerkSyncFingerprint;
          nextStoreAttemptAtRef.current = 0;
          if (storeRetryTimerRef.current) {
            clearTimeout(storeRetryTimerRef.current);
            storeRetryTimerRef.current = null;
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          nextStoreAttemptAtRef.current = Date.now() + 5000;
          console.warn(
            '[ScoreEasy] Convex user bootstrap failed; retrying later.',
            error,
          );
          if (storeRetryTimerRef.current) {
            clearTimeout(storeRetryTimerRef.current);
          }
          storeRetryTimerRef.current = setTimeout(() => {
            storeRetryTimerRef.current = null;
            setStoreRetryTick((tick) => tick + 1);
          }, 5000);
        }
      })
      .finally(() => {
        if (!cancelled) {
          isStoreUserInFlightRef.current = false;
          setIsBootstrappingUser(false);
        }
      });

    return () => {
      cancelled = true;
      isStoreUserInFlightRef.current = false;
    };
  }, [
    clerkSyncFingerprint,
    convexUser,
    isAuthenticated,
    isClerkLoaded,
    storeRetryTick,
    storeUser,
  ]);

  useEffect(
    () => () => {
      if (storeRetryTimerRef.current) {
        clearTimeout(storeRetryTimerRef.current);
        storeRetryTimerRef.current = null;
      }
    },
    [],
  );

  const isUserReady = !isAuthenticated || Boolean(convexUser);
  const isLoading =
    isConvexAuthLoading ||
    !isClerkLoaded ||
    (isAuthenticated &&
      (convexUser === undefined ||
        (convexUser === null && isBootstrappingUser)));
  const value = useMemo(
    () => ({
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
    }),
    [clerkUser, convexUser, isAuthenticated, isLoading, isUserReady],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

CloudAuthProvider.propTypes = {
  children: PropTypes.node,
};

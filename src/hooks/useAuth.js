import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";

function getClerkSyncFingerprint(isAuthenticated, isClerkLoaded, clerkUser) {
  if (!isAuthenticated || !isClerkLoaded || !clerkUser) {
    return null;
  }

  return [
    clerkUser.id,
    clerkUser.imageUrl ?? "",
    clerkUser.fullName ?? "",
    clerkUser.primaryEmailAddress?.emailAddress ?? "",
  ].join("|");
}

export function useAuth() {
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const storeUser = useMutation(api.users.store);
  const [isBootstrappingUser, setIsBootstrappingUser] = useState(false);
  const lastStoreFingerprintRef = useRef(null);
  const convexUser = useQuery(
    api.users.getCurrent,
    isAuthenticated ? {} : "skip"
  );
  const clerkSyncFingerprint = getClerkSyncFingerprint(
    isAuthenticated,
    isClerkLoaded,
    clerkUser
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
    (isAuthenticated && (convexUser === undefined || (convexUser === null && isBootstrappingUser)));

  return {
    isAuthenticated,
    isLoading,
    isUserReady,
    user: convexUser ?? null,
    clerkUser,
    needsUsername: Boolean(isAuthenticated && convexUser && !convexUser.username),
    needsOnboarding: Boolean(isAuthenticated && convexUser && !convexUser.onboardedAt),
  };
}

import { useConvexAuth } from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";

export function useAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user: clerkUser } = useUser();
  const storeUser = useMutation(api.users.store);
  const convexUser = useQuery(
    api.users.getMe,
    isAuthenticated ? {} : "skip"
  );

  useEffect(() => {
    if (isAuthenticated) storeUser();
  }, [isAuthenticated, storeUser]);

  return {
    isAuthenticated,
    isLoading,
    user: convexUser,
    clerkUser,
    needsUsername: isAuthenticated && convexUser && !convexUser.username,
    needsOnboarding: isAuthenticated && convexUser && !convexUser.onboardedAt,
  };
}

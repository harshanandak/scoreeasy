import { SignIn } from "@clerk/clerk-react";
import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { getAuthReturnToFromSearch, rememberAuthReturnTo } from "../../utils/authRedirect";
import { monoClerkAppearance } from "./clerkTheme";
import MonoAuthPageFrame from "./MonoAuthPageFrame";
import CloudAuthOnly from "./components/CloudAuthOnly";

export default function MonoLogin() {
  const location = useLocation();
  const redirectTarget = useMemo(
    () => getAuthReturnToFromSearch(location.search, "/"),
    [location.search]
  );

  useEffect(() => {
    rememberAuthReturnTo(redirectTarget);
  }, [redirectTarget]);

  return (
    <CloudAuthOnly>
      <MonoAuthPageFrame subtitle="Sign in to continue">
        <SignIn
          appearance={monoClerkAppearance}
          routing="path"
          path="/login"
          signUpUrl={`/signup?returnTo=${encodeURIComponent(redirectTarget)}`}
          forceRedirectUrl={redirectTarget}
          fallbackRedirectUrl={redirectTarget}
          oauthFlow="redirect"
        />
      </MonoAuthPageFrame>
    </CloudAuthOnly>
  );
}

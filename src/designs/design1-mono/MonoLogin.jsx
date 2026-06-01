import { SignIn } from "@clerk/clerk-react";
import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { APP_ENTRY_RESOLVER_PATH } from "../../utils/appEntry";
import { getAuthReturnToFromSearch, rememberAuthReturnTo } from "../../utils/authRedirect";
import { monoClerkAppearance } from "./clerkTheme";
import MonoAuthPageFrame from "./MonoAuthPageFrame";
import CloudAuthOnly from "./components/CloudAuthOnly";

export default function MonoLogin() {
  const location = useLocation();
  const redirectTarget = useMemo(
    () => getAuthReturnToFromSearch(location.search, APP_ENTRY_RESOLVER_PATH),
    [location.search]
  );

  useEffect(() => {
    rememberAuthReturnTo(redirectTarget);
  }, [redirectTarget]);

  return (
    <CloudAuthOnly>
      <MonoAuthPageFrame
        subtitle="Sign in to continue"
        helperText="Use email recovery from the password step if you cannot sign in. You can keep scoring locally as a guest anytime."
      >
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

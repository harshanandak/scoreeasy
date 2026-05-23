import { SignUp } from "@clerk/clerk-react";
import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { getAuthReturnToFromSearch, rememberAuthReturnTo } from "../../utils/authRedirect";
import { monoClerkAppearance } from "./clerkTheme";
import MonoAuthPageFrame from "./MonoAuthPageFrame";
import CloudAuthOnly from "./components/CloudAuthOnly";

export default function MonoSignUp() {
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
      <MonoAuthPageFrame
        subtitle="Create your account"
        helperText="Accounts add sync and recovery. Guest scoring stays available before you sign up."
      >
        <SignUp
          appearance={monoClerkAppearance}
          routing="path"
          path="/signup"
          signInUrl={`/login?returnTo=${encodeURIComponent(redirectTarget)}`}
          forceRedirectUrl={redirectTarget}
          fallbackRedirectUrl={redirectTarget}
          oauthFlow="redirect"
        />
      </MonoAuthPageFrame>
    </CloudAuthOnly>
  );
}

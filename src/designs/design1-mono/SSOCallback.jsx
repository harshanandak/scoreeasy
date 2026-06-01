import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { APP_ENTRY_RESOLVER_PATH } from "../../utils/appEntry";
import { consumeAuthReturnTo } from "../../utils/authRedirect";
import CloudAuthOnly from "./components/CloudAuthOnly";

export default function SSOCallback() {
  const [redirectTarget, setRedirectTarget] = useState(null);

  useEffect(() => {
    setRedirectTarget(consumeAuthReturnTo(APP_ENTRY_RESOLVER_PATH));
  }, []);

  if (redirectTarget === null) {
    return (
      <CloudAuthOnly>
        <p className="text-sm font-swiss" style={{ color: "#888" }}>
          Finishing sign in...
        </p>
      </CloudAuthOnly>
    );
  }

  return (
    <CloudAuthOnly>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl={redirectTarget}
        signUpFallbackRedirectUrl={redirectTarget}
      />
    </CloudAuthOnly>
  );
}

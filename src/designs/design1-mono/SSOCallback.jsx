import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import { consumeAuthReturnTo } from "../../utils/authRedirect";
import CloudAuthOnly from "./components/CloudAuthOnly";

export default function SSOCallback() {
  const redirectTarget = consumeAuthReturnTo("/");

  return (
    <CloudAuthOnly>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl={redirectTarget}
        signUpFallbackRedirectUrl={redirectTarget}
      />
    </CloudAuthOnly>
  );
}

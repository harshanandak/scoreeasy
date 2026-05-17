import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import { useRef } from "react";
import { consumeAuthReturnTo } from "../../utils/authRedirect";
import CloudAuthOnly from "./components/CloudAuthOnly";

export default function SSOCallback() {
  const redirectTargetRef = useRef(null);
  if (redirectTargetRef.current === null) {
    redirectTargetRef.current = consumeAuthReturnTo("/");
  }
  const redirectTarget = redirectTargetRef.current;

  return (
    <CloudAuthOnly>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl={redirectTarget}
        signUpFallbackRedirectUrl={redirectTarget}
      />
    </CloudAuthOnly>
  );
}

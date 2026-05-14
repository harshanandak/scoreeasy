import { SignUp } from "@clerk/clerk-react";
import { monoClerkAppearance } from "./clerkTheme";
import MonoAuthPageFrame from "./MonoAuthPageFrame";
import CloudAuthOnly from "./components/CloudAuthOnly";

export default function MonoSignUp() {
  return (
    <CloudAuthOnly>
      <MonoAuthPageFrame subtitle="Create your account">
        <SignUp
          appearance={monoClerkAppearance}
          routing="path"
          path="/signup"
          signInUrl="/login"
          forceRedirectUrl="/"
          fallbackRedirectUrl="/"
          oauthFlow="redirect"
        />
      </MonoAuthPageFrame>
    </CloudAuthOnly>
  );
}

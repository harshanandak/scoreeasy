import { SignIn } from "@clerk/clerk-react";
import { monoClerkAppearance } from "./clerkTheme";
import MonoAuthPageFrame from "./MonoAuthPageFrame";
import CloudAuthOnly from "./components/CloudAuthOnly";

export default function MonoLogin() {
  return (
    <CloudAuthOnly>
      <MonoAuthPageFrame subtitle="Sign in to continue">
        <SignIn
          appearance={monoClerkAppearance}
          routing="path"
          path="/login"
          signUpUrl="/signup"
          forceRedirectUrl="/"
          fallbackRedirectUrl="/"
          oauthFlow="redirect"
        />
      </MonoAuthPageFrame>
    </CloudAuthOnly>
  );
}

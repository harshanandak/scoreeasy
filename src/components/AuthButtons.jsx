import {
  SignInButton,
  SignUpButton,
  UserButton,
  SignedIn,
  SignedOut,
  GoogleOneTap,
} from "@clerk/clerk-react";

export function AuthSignInButton({ children, ...props }) {
  return (
    <SignInButton mode="modal" {...props}>
      {children}
    </SignInButton>
  );
}

export function AuthSignUpButton({ children, ...props }) {
  return (
    <SignUpButton mode="modal" {...props}>
      {children}
    </SignUpButton>
  );
}

export function AuthUserButton(props) {
  return <UserButton {...props} />;
}

export function AuthGoogleOneTap(props) {
  return <GoogleOneTap {...props} />;
}

export { SignedIn, SignedOut };

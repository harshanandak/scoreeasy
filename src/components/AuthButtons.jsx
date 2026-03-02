import PropTypes from 'prop-types';
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

AuthSignInButton.propTypes = {
  children: PropTypes.node,
};

export function AuthSignUpButton({ children, ...props }) {
  return (
    <SignUpButton mode="modal" {...props}>
      {children}
    </SignUpButton>
  );
}

AuthSignUpButton.propTypes = {
  children: PropTypes.node,
};

export function AuthUserButton(props) {
  return <UserButton {...props} />;
}

AuthUserButton.propTypes = {};

export function AuthGoogleOneTap(props) {
  return <GoogleOneTap {...props} />;
}

AuthGoogleOneTap.propTypes = {};

export { SignedIn, SignedOut };

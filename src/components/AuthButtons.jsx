import PropTypes from 'prop-types';
import {
  SignInButton,
  SignUpButton,
  UserButton,
  GoogleOneTap,
} from "@clerk/clerk-react";
import { useAuth } from '../hooks/useAuth';

export function AuthSignInButton({ children, ...props }) {
  const { cloudAuthAvailable } = useAuth();

  if (!cloudAuthAvailable) {
    return null;
  }

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
  const { cloudAuthAvailable } = useAuth();

  if (!cloudAuthAvailable) {
    return null;
  }

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
  const { cloudAuthAvailable } = useAuth();

  if (!cloudAuthAvailable) {
    return null;
  }

  return <UserButton {...props} />;
}

AuthUserButton.propTypes = {};

export function AuthGoogleOneTap(props) {
  const { cloudAuthAvailable } = useAuth();

  if (!cloudAuthAvailable) {
    return null;
  }

  return <GoogleOneTap {...props} />;
}

AuthGoogleOneTap.propTypes = {};

export function SignedIn({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return children;
}

SignedIn.propTypes = {
  children: PropTypes.node,
};

export function SignedOut({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading || isAuthenticated) {
    return null;
  }

  return children;
}

SignedOut.propTypes = {
  children: PropTypes.node,
};

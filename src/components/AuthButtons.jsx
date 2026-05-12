import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

let clerkComponentsPromise;

function loadClerkComponents() {
  if (!clerkComponentsPromise) {
    clerkComponentsPromise = import('@clerk/clerk-react');
  }

  return clerkComponentsPromise;
}

function useClerkComponents(enabled) {
  const [components, setComponents] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setComponents(null);
      return;
    }

    let cancelled = false;
    loadClerkComponents().then((module) => {
      if (!cancelled) {
        setComponents(module);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return components;
}

export function AuthSignInButton({ children, ...props }) {
  const { cloudAuthAvailable } = useAuth();
  const clerkComponents = useClerkComponents(cloudAuthAvailable);

  if (!cloudAuthAvailable || !clerkComponents) {
    return null;
  }

  const { SignInButton } = clerkComponents;
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
  const clerkComponents = useClerkComponents(cloudAuthAvailable);

  if (!cloudAuthAvailable || !clerkComponents) {
    return null;
  }

  const { SignUpButton } = clerkComponents;
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
  const clerkComponents = useClerkComponents(cloudAuthAvailable);

  if (!cloudAuthAvailable || !clerkComponents) {
    return null;
  }

  const { UserButton } = clerkComponents;
  return <UserButton {...props} />;
}

AuthUserButton.propTypes = {};

export function AuthGoogleOneTap(props) {
  const { cloudAuthAvailable } = useAuth();
  const clerkComponents = useClerkComponents(cloudAuthAvailable);

  if (!cloudAuthAvailable || !clerkComponents) {
    return null;
  }

  const { GoogleOneTap } = clerkComponents;
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
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return null;
  }

  return children;
}

SignedOut.propTypes = {
  children: PropTypes.node,
};

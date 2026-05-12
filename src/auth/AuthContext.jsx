import PropTypes from 'prop-types';
import { createContext, useContext, useMemo } from 'react';

const LOCAL_AUTH_STATE = {
  authMode: 'local',
  authModeReason: 'missing-config',
  cloudAuthAvailable: false,
  isAuthenticated: false,
  isLoading: false,
  isUserReady: true,
  user: null,
  clerkUser: null,
  needsUsername: false,
  needsOnboarding: false,
};

export const AuthContext = createContext(LOCAL_AUTH_STATE);

export function LocalAuthProvider({ children, reason = 'missing-config' }) {
  const value = useMemo(
    () => ({
      ...LOCAL_AUTH_STATE,
      authModeReason: reason,
    }),
    [reason],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

LocalAuthProvider.propTypes = {
  children: PropTypes.node,
  reason: PropTypes.string,
};

export function useAuth() {
  return useContext(AuthContext);
}

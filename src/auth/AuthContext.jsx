import PropTypes from 'prop-types';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { LAST_ACCOUNT, lastSignedInAccount } from './localAccount';

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

export function LocalAuthProvider({
  children,
  reason = 'missing-config',
  cloudAuthAvailable = false,
}) {
  const [localAccountId, setLocalAccountId] = useState(lastSignedInAccount);
  useEffect(() => {
    const refresh = () => setLocalAccountId(lastSignedInAccount());
    const onStorage = event => { if (event.key === LAST_ACCOUNT || event.key === null) refresh(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    refresh();
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const value = useMemo(
    () => ({
      ...LOCAL_AUTH_STATE,
      cloudAuthAvailable,
      authModeReason: reason,
      localAccountId,
    }),
    [cloudAuthAvailable, reason, localAccountId],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

LocalAuthProvider.propTypes = {
  children: PropTypes.node,
  cloudAuthAvailable: PropTypes.bool,
  reason: PropTypes.string,
};

export function useAuth() {
  return useContext(AuthContext);
}

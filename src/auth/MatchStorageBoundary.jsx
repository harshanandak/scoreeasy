import { Fragment, useLayoutEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from './AuthContext';
import { getMatchStorageScope, setMatchStorageScope } from '../utils/accountStorage';
import AppLoading from '../components/AppLoading';

export default function MatchStorageBoundary({ children }) {
  const auth = useAuth();
  // Clerk survives a Convex reconnect; a missing Convex token does not mean sign-out.
  const owner = auth.clerkUser?.id || (auth.isAuthenticated ? auth.user?._id : null) || null;
  const [mountedOwner, setMountedOwner] = useState(getMatchStorageScope);
  useLayoutEffect(() => {
    setMatchStorageScope(owner, auth.user?._id);
    setMountedOwner(owner);
  }, [owner, auth.user?._id]);
  // Unmount the old board before mounting the new namespace, including cached History state.
  if (mountedOwner !== owner || (!owner && auth.isLoading)) return <AppLoading />;
  return <Fragment key={owner || 'guest'}>{children}</Fragment>;
}
MatchStorageBoundary.propTypes = { children: PropTypes.node };

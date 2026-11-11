import { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import PublicHome from './designs/design1-mono/landing/PublicHome';
import AppLoading from './components/AppLoading';
import { usePendingMatchSaves } from './hooks/usePendingMatchSaves';
import { usePendingLiveFinalizations } from './hooks/usePendingLiveFinalizations';
import { useGuestMatchUploads } from './hooks/useGuestMatchUploads';
import GuestUploadNotice from './components/GuestUploadNotice';
import MatchStorageBoundary from './auth/MatchStorageBoundary';

const Design = lazy(() => import('./designs/design1-mono/index'));

export default function App() {
  const { isLoading } = useAuth();
  const { pathname } = useLocation();
  // Home reads no private match data; scoring stays behind the account storage boundary.
  if (pathname === '/' && isLoading) return <PublicHome />;
  return <MatchStorageBoundary><AccountApp /></MatchStorageBoundary>;
}

function AccountApp() {
  const matchQueue = usePendingMatchSaves();
  const guestUploadNotice = useGuestMatchUploads(matchQueue);
  const liveErrors = usePendingLiveFinalizations();
  return (
    <Suspense fallback={<AppLoading />}>
      <GuestUploadNotice message={guestUploadNotice} />
      {liveErrors.length > 0 && <p role="alert">Live sharing could not sync. Your local scores are saved.</p>}
      <Routes>
        <Route path="/*" element={<Design />} />
      </Routes>
    </Suspense>
  );
}

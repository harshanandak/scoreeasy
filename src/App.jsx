import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import AppLoading from './components/AppLoading';
import { usePendingMatchSaves } from './hooks/usePendingMatchSaves';
import { usePendingLiveFinalizations } from './hooks/usePendingLiveFinalizations';
import { useGuestMatchUploads } from './hooks/useGuestMatchUploads';

const Design = lazy(() => import('./designs/design1-mono/index'));

export default function App() {
  const matchQueue = usePendingMatchSaves();
  const guestUploadNotice = useGuestMatchUploads(matchQueue);
  const liveErrors = usePendingLiveFinalizations();
  return (
    <Suspense fallback={<AppLoading />}>
      {guestUploadNotice && <p role="status" className="kit-toast">{guestUploadNotice}</p>}
      {liveErrors.length > 0 && <p role="alert">Live sharing could not sync. Your local scores are saved.</p>}
      <Routes>
        <Route path="/*" element={<Design />} />
      </Routes>
    </Suspense>
  );
}

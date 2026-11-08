import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import AppLoading from './components/AppLoading';
import { usePendingMatchSaves } from './hooks/usePendingMatchSaves';
import { usePendingLiveFinalizations } from './hooks/usePendingLiveFinalizations';

const Design = lazy(() => import('./designs/design1-mono/index'));

export default function App() {
  usePendingMatchSaves();
  const liveErrors = usePendingLiveFinalizations();
  return (
    <Suspense fallback={<AppLoading />}>
      {liveErrors.length > 0 && <p role="alert">Live sharing could not sync. Your local scores are saved.</p>}
      <Routes>
        <Route path="/*" element={<Design />} />
      </Routes>
    </Suspense>
  );
}

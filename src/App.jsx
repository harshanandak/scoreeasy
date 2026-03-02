import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

const Design = lazy(() => import('./designs/design1-mono/index'));

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-gray-400 text-sm font-light tracking-wider animate-pulse font-swiss">
        Loading...
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/*" element={<Design />} />
      </Routes>
    </Suspense>
  );
}

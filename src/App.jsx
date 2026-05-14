import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import AppLoading from './components/AppLoading';

const Design = lazy(() => import('./designs/design1-mono/index'));

export default function App() {
  return (
    <Suspense fallback={<AppLoading />}>
      <Routes>
        <Route path="/*" element={<Design />} />
      </Routes>
    </Suspense>
  );
}

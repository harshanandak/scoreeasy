import { lazy, Suspense } from 'react';
import { SignedIn, SignedOut } from '../../components/AuthButtons';

const GuestLanding = lazy(() => import('./landing/GuestLanding'));
const DashboardLanding = lazy(() => import('./landing/DashboardLanding'));

const Loader = () => (
  <div style={{ padding: 60, textAlign: 'center', color: '#999', fontSize: '0.875rem' }}>Loading...</div>
);

export default function MonoLanding() {
  return (
    <Suspense fallback={<Loader />}>
      <SignedOut>
        <GuestLanding />
      </SignedOut>
      <SignedIn>
        <DashboardLanding />
      </SignedIn>
    </Suspense>
  );
}

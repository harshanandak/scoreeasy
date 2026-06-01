import { lazy, Suspense } from 'react';
import { SignedIn, SignedOut } from '../../components/AuthButtons';
import AppLoading from '../../components/AppLoading';
import { useAuth } from '../../hooks/useAuth';
import GuestLanding from './landing/GuestLanding';

const DashboardLanding = lazy(() => import('./landing/DashboardLanding'));

export default function MonoLanding() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <AppLoading compact message="Checking cloud sign in" />;
  }

  return (
    <>
      <SignedOut>
        <GuestLanding />
      </SignedOut>
      <Suspense fallback={<AppLoading compact message="Opening dashboard" />}>
        <SignedIn>
          <DashboardLanding />
        </SignedIn>
      </Suspense>
    </>
  );
}

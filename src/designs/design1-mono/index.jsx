import { useEffect, Suspense, lazy } from 'react';
import PropTypes from 'prop-types';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import MonoLanding from './MonoLanding';
import MonoSportHome from './MonoSportHome';
import MonoHistory from './MonoHistory';
import MonoTournamentList from './MonoTournamentList';
import MonoTournamentLiveScore from './MonoTournamentLiveScore';
import { getSportById } from '../../models/sportRegistry';
import { useAuth } from '../../hooks/useAuth';
import ErrorBoundary from '../../components/ErrorBoundary';
import OfflineFallback from '../../components/OfflineFallback';
import { installNativeBackButtonGuard } from '../../mobile/backButton';
import './mono.css';

// Lazy-loaded tournament components (loaded on demand per sport type)
const MonoCricketTournament = lazy(() => import('./MonoCricketTournament'));
const GenericSetsTournament = lazy(() => import('./GenericSetsTournament'));
const GenericGoalsTournament = lazy(() => import('./GenericGoalsTournament'));
const MonoStatistics = lazy(() => import('./MonoStatistics'));
const MonoTournamentSetup = lazy(() => import('./MonoTournamentSetup'));
const MonoQuickMatch = lazy(() => import('./MonoQuickMatch'));
const MonoCricketTestLiveScore = lazy(() => import('./scoring/MonoCricketTestLiveScore'));

// Lazy-loaded showcase components (rarely visited)
const MonoMatchCardShowcase = lazy(() => import('./MonoMatchCardShowcase'));
const MonoSetDisplayShowcase = lazy(() => import('./MonoSetDisplayShowcase'));
const BrutalistColorShowcase = lazy(() => import('./landing-designs/BrutalistColorShowcase'));
const DashboardShowcase = lazy(() => import('./landing/DashboardShowcase'));

// Lazy-loaded auth pages (not needed for guests)
const MonoLogin = lazy(() => import('./MonoLogin'));
const MonoSignUp = lazy(() => import('./MonoSignUp'));
const SSOCallback = lazy(() => import('./SSOCallback'));
const MonoOnboarding = lazy(() => import('./MonoOnboarding'));
const MonoProfile = lazy(() => import('./MonoProfile'));
const MonoUserSearch = lazy(() => import('./MonoUserSearch'));

function LazyFallback() {
  return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Loading...</div>
  );
}

// Redirects authenticated users who haven't completed onboarding
const GUARD_BYPASS_PREFIXES = ['/onboarding', '/login', '/signup', '/sso-callback', '/showcase'];
function OnboardingGuard({ children }) {
  const { needsOnboarding, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <LazyFallback />;
  const bypassed = GUARD_BYPASS_PREFIXES.some((p) => location.pathname.startsWith(p));
  if (needsOnboarding && !bypassed) {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}

OnboardingGuard.propTypes = {
  children: PropTypes.node,
};

// Dispatcher component that routes to the correct tournament component based on engine
function TournamentDispatcher() {
  const { sport } = useParams();
  const sportConfig = getSportById(sport);

  if (!sportConfig) {
    return (
      <div className="min-h-screen px-6 py-10 flex items-center justify-center">
        <p style={{ color: '#888' }}>Sport not found</p>
      </div>
    );
  }

  if (sportConfig.engine === 'custom-cricket') {
    return <MonoCricketTournament />;
  }

  if (sportConfig.engine === 'sets') {
    return <GenericSetsTournament />;
  }

  if (sportConfig.engine === 'goals') {
    return <GenericGoalsTournament />;
  }

  return (
    <div className="min-h-screen px-6 py-10 flex items-center justify-center">
      <p style={{ color: '#888' }}>Engine type not supported</p>
    </div>
  );
}

export default function Design1Mono() {
  const location = useLocation();

  // Browser back button protection for active game/scoring routes
  useEffect(() => {
    const isGameRoute = /\/(?:game\/|.*\/tournament\/\d+\/match\/.*\/score|.*\/quick)/.test(location.pathname);

    if (!isGameRoute) return;

    globalThis.history.pushState({ gameProtection: true }, '');

    const handlePopState = () => {
      const leave = globalThis.confirm('Leave this page? Your unsaved scoring progress may be lost.');
      if (!leave) {
        globalThis.history.pushState({ gameProtection: true }, '');
      }
    };

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    globalThis.addEventListener('popstate', handlePopState);
    globalThis.addEventListener('beforeunload', handleBeforeUnload);
    const cleanupNativeBackButton = installNativeBackButtonGuard({
      getPathname: () => globalThis.location.pathname,
    });

    return () => {
      globalThis.removeEventListener('popstate', handlePopState);
      globalThis.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupNativeBackButton();
    };
  }, [location.pathname]);

  return (
    <div className="min-h-screen font-swiss" style={{ background: '#fafafa', color: '#111' }}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <OfflineFallback />
      <main id="main-content">
        <Suspense fallback={<LazyFallback />}>
          <ErrorBoundary title="App route crashed" message="The route tree failed to render.">
            <OnboardingGuard>
              <Routes>
                <Route path="" element={<MonoLanding />} />

                <Route path="login/*" element={<MonoLogin />} />
                <Route path="signup/*" element={<MonoSignUp />} />
                <Route path="sso-callback" element={<SSOCallback />} />
                <Route path="onboarding" element={<MonoOnboarding />} />

                <Route path="profile" element={<MonoProfile />} />
                <Route path="profile/:username" element={<MonoProfile />} />
                <Route path="users/search" element={<MonoUserSearch />} />

                <Route path="play" element={<MonoSportHome />} />

                <Route path=":sport/tournament" element={<MonoTournamentList />} />
                <Route path=":sport/tournament/new" element={<MonoTournamentSetup />} />
                <Route path=":sport/tournament/:id" element={<TournamentDispatcher />} />
                <Route path=":sport/tournament/:id/match/:matchId/score" element={<MonoTournamentLiveScore />} />
                <Route path=":sport/quick" element={<MonoQuickMatch />} />
                <Route path=":sport/quick/test/:matchId" element={<MonoCricketTestLiveScore storageMode="quick" />} />

                <Route path="statistics" element={<MonoStatistics />} />

                <Route path="showcase/match-card" element={<MonoMatchCardShowcase />} />
                <Route path="showcase/set-display" element={<MonoSetDisplayShowcase />} />
                <Route path="showcase/brutalist-colors" element={<BrutalistColorShowcase />} />
                <Route path="showcase/dashboard-variants" element={<DashboardShowcase />} />

                <Route path="history" element={<MonoHistory />} />
              </Routes>
            </OnboardingGuard>
          </ErrorBoundary>
        </Suspense>
      </main>
    </div>
  );
}

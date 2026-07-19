import { useCallback, useEffect, Suspense, lazy, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Routes, Route, Navigate, useParams, useLocation, useNavigate } from 'react-router-dom';
import MonoLanding from './MonoLanding';
import { getSportById } from '../../models/sportRegistry';
import { loadData, loadQuickMatch } from '../../utils/storage';
import { getTennisQuickDraftKey } from '../../utils/tennisQuickMatch';
import { useAuth } from '../../hooks/useAuth';
import {
  APP_ENTRY_PATH,
  PUBLIC_MARKETING_PATH,
  getAppEntryTarget,
  loadAppEntryState,
} from '../../utils/appEntry';
import { AuthUserButton } from '../../components/AuthButtons';
import ErrorBoundary from '../../components/ErrorBoundary';
import OfflineFallback from '../../components/OfflineFallback';
import ConvexReconnectingFallback from '../../components/ConvexReconnectingFallback';
import {
  getProtectedScoringBackFallback,
  installNativeBackButtonGuard,
  isProtectedScoringRoute,
} from '../../mobile/backButton';
import { installNativeDeepLinkHandler } from '../../mobile/deepLinks';
import CloudAuthOnly from './components/CloudAuthOnly';
import { handleAppConfirmKeyDown } from './components/appConfirmUtils';
import RouteRecoveryActions from './components/RouteRecoveryActions';
import './mono.css';

// Lazy-loaded primary app routes (not needed for the initial landing view)
const MonoPlayHub = lazy(() => import('./MonoPlayHub'));
const DashboardLanding = lazy(() => import('./landing/DashboardLanding'));
const MonoHistory = lazy(() => import('./MonoHistory'));
const MonoTournamentList = lazy(() => import('./MonoTournamentList'));
const MonoTournamentLiveScore = lazy(() => import('./MonoTournamentLiveScore'));
const MonoMatchResult = lazy(() => import('./components/MonoMatchResult'));

// Lazy-loaded tournament components (loaded on demand per sport type)
const MonoCricketTournament = lazy(() => import('./MonoCricketTournament'));
const GenericSetsTournament = lazy(() => import('./GenericSetsTournament'));
const GenericGoalsTournament = lazy(() => import('./GenericGoalsTournament'));
const MonoTournamentSetup = lazy(() => import('./MonoTournamentSetup'));
const MonoQuickMatch = lazy(() => import('./MonoQuickMatch'));
const MonoCricketTestLiveScore = lazy(() => import('./scoring/MonoCricketTestLiveScore'));
const MonoTennisLiveScore = lazy(() => import('./scoring/MonoTennisLiveScore'));

// Public, no-sign-in spectator page (/live/:token). Renders no app dock.
const MonoWatchMatch = lazy(() => import('./MonoWatchMatch'));

// Lazy-loaded showcase components (rarely visited)
const MonoMatchCardShowcase = lazy(() => import('./MonoMatchCardShowcase'));
const MonoSetDisplayShowcase = lazy(() => import('./MonoSetDisplayShowcase'));
const BrutalistColorShowcase = lazy(() => import('./landing-designs/BrutalistColorShowcase'));
const DashboardShowcase = lazy(() => import('./landing/DashboardShowcase'));
const LegalPage = lazy(() => import('./landing/LegalPage'));

// Lazy-loaded auth pages (not needed for guests)
const MonoLogin = lazy(() => import('./MonoLogin'));
const MonoSignUp = lazy(() => import('./MonoSignUp'));
const SSOCallback = lazy(() => import('./SSOCallback'));
const MonoOnboarding = lazy(() => import('./MonoOnboarding'));
const MonoProfile = lazy(() => import('./MonoProfile'));
const MonoUserSearch = lazy(() => import('./MonoUserSearch'));

const SHOW_INTERNAL_ROUTES = import.meta.env.DEV || import.meta.env.VITE_SHOW_INTERNAL_ROUTES === 'true';

// Lightweight inline skeleton shown while a lazy route chunk loads. The nav
// shell (header + bottom nav) lives OUTSIDE the route <Suspense>, so chunk loads
// no longer flash the full branded splash — only this content placeholder swaps
// in, keeping the surrounding shell stable. Exported for direct unit testing.
export function LazyFallback() {
  return (
    <div className="route-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="route-skeleton-label">Loading…</span>
      <div className="route-skeleton-block route-skeleton-title" aria-hidden="true" />
      <div className="route-skeleton-block route-skeleton-line" aria-hidden="true" />
      <div className="route-skeleton-block route-skeleton-line route-skeleton-line-short" aria-hidden="true" />
      <div className="route-skeleton-block route-skeleton-card" aria-hidden="true" />
      <style>{`
        .route-skeleton {
          box-sizing: border-box;
          width: 100%;
          max-width: 720px;
          margin: 0 auto;
          padding: 24px 20px 40px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .route-skeleton-label {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .route-skeleton-block {
          border-radius: var(--se-radius-button);
          background: linear-gradient(
            90deg,
            color-mix(in oklch, var(--se-color-line) 16%, var(--se-color-surface)) 25%,
            color-mix(in oklch, var(--se-color-line) 28%, var(--se-color-surface)) 37%,
            color-mix(in oklch, var(--se-color-line) 16%, var(--se-color-surface)) 63%
          );
          background-size: 400% 100%;
          animation: route-skeleton-shimmer 1.4s ease-in-out infinite;
        }

        .route-skeleton-title { height: 28px; width: 60%; }
        .route-skeleton-line { height: 14px; width: 100%; }
        .route-skeleton-line-short { width: 80%; }
        .route-skeleton-card { height: 180px; width: 100%; margin-top: 6px; border-radius: var(--se-radius-card); }

        @keyframes route-skeleton-shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .route-skeleton-block {
            animation: none;
            background: color-mix(in oklch, var(--se-color-line) 18%, var(--se-color-surface));
          }
        }
      `}</style>
    </div>
  );
}

function NotFoundRoute() {
  const location = useLocation();
  const firstSegment = location.pathname.split('/').filter(Boolean)[0];
  const sport = getSportById(firstSegment);
  const title = sport ? `This ${sport.name} screen is not available` : 'This screen is not available';

  return (
    <RouteRecoveryActions
      eyebrow="Page not found"
      title={title}
      message="The link may be old, incomplete, or not part of the mobile app flow yet."
      sportId={sport?.id}
      primaryLabel={sport ? `Back to ${sport.name}` : 'Play'}
      primaryPath={sport ? `/play?sport=${sport.id}` : '/play'}
    />
  );
}

function SportRouteGuard({ children }) {
  const { sport } = useParams();
  if (!getSportById(sport)) return <NotFoundRoute />;
  return children;
}

SportRouteGuard.propTypes = {
  children: PropTypes.node,
};

function CricketQuickTestScorerRoute() {
  const { sport } = useParams();
  if (sport !== 'cricket') return <NotFoundRoute />;

  return (
    <SportRouteGuard>
      <MonoCricketTestLiveScore storageMode="quick" />
    </SportRouteGuard>
  );
}

function LegacyCricketQuickTestRoute() {
  const { matchId, sport } = useParams();
  if (sport !== 'cricket') return <NotFoundRoute />;
  return <Navigate to={`/${sport}/quick/test-match/${matchId}`} replace />;
}

function TennisQuickScorerRoute() {
  const { sport } = useParams();
  if (sport !== 'tennis') return <NotFoundRoute />;

  return (
    <SportRouteGuard>
      <MonoTennisLiveScore storageMode="quick" />
    </SportRouteGuard>
  );
}

function LegacyQuickMatchRoute() {
  const location = useLocation();
  const requestedSport = new URLSearchParams(location.search).get('sport')?.toLowerCase();
  const sport = getSportById(requestedSport) ? requestedSport : 'volleyball';
  return <Navigate to={`/${sport}/quick`} replace />;
}

function LegacyTournamentRoute() {
  const location = useLocation();
  const requestedSport = new URLSearchParams(location.search).get('sport')?.toLowerCase();
  const sport = getSportById(requestedSport) ? requestedSport : null;
  return <Navigate to={sport ? `/${sport}/tournament` : '/play'} replace />;
}

function LegacyTennisLiveRoute() {
  const { matchId, sport } = useParams();
  if (sport !== 'tennis') return <NotFoundRoute />;
  return <Navigate to={`/${sport}/quick/live/${matchId}`} replace />;
}

function SignInAliasRedirect() {
  const location = useLocation();
  return <Navigate to={`/login${location.search}${location.hash}`} replace />;
}

// Resolves a legacy /game/:id resume link against saved on-device drafts.
// Returns the canonical live scorer path when an in-progress draft is found,
// otherwise null so the caller can render the recovery screen.
export function resolveGameResumePath(id) {
  if (!id) return null;

  // Cricket Test matches persist into the shared quick-match store.
  const quickMatch = loadQuickMatch(id);
  if (quickMatch && quickMatch.status !== 'completed' && getSportById(quickMatch.sport)) {
    if (quickMatch.sport === 'cricket' && quickMatch.format?.totalInnings === 4) {
      return `/${quickMatch.sport}/quick/test-match/${id}`;
    }
  }

  // Tennis quick matches persist into their own per-id draft key.
  const tennisDraft = loadData(getTennisQuickDraftKey(id), null);
  // This is the tennis-specific draft key, so only recover an actual tennis draft —
  // stale/corrupt storage with another sport must not redirect to /<sport>/quick/live.
  if (tennisDraft && tennisDraft.status !== 'completed' && tennisDraft.sport === 'tennis') {
    return `/tennis/quick/live/${id}`;
  }

  return null;
}

function GameResumeRecoveryRoute() {
  const { id } = useParams();
  const resumePath = resolveGameResumePath(id);

  if (resumePath) {
    return <Navigate to={resumePath} replace />;
  }

  return (
    <RouteRecoveryActions
      eyebrow="Resume recovery"
      title="Resume link unavailable"
      message="This saved resume link no longer maps to a live scorer route. Pick a saved match or start fresh."
      primaryLabel="Find matches to resume"
      primaryPath="/history"
    />
  );
}

// Redirects authenticated users who haven't completed onboarding
const GUARD_BYPASS_PREFIXES = [
  '/onboarding',
  '/login',
  '/signup',
  '/sso-callback',
  '/showcase',
  // Public spectator links must work for a signed-in-not-onboarded user
  // following a share link — never bounce them to /onboarding.
  '/live',
  PUBLIC_MARKETING_PATH,
  '/privacy',
  '/terms',
  '/contact',
];
const ONBOARDING_DEFER_PATHS = new Set([
  '/',
  APP_ENTRY_PATH,
  '/dashboard',
  '/history',
  '/play',
  '/quick-match',
  '/statistics',
  '/stats',
  '/tournament',
]);
const SCORING_EXIT_TITLE = 'Leave this page?';
const SCORING_EXIT_MESSAGE = 'Your unsaved scoring progress may be lost.';
const NO_PRIOR_ROUTE_INDEX = -1;
const APP_SHELL_PREFIXES = [
  APP_ENTRY_PATH,
  '/play',
  '/history',
  '/statistics',
  '/profile',
  '/users/search',
];
const PUBLIC_SHELL_PREFIXES = [
  PUBLIC_MARKETING_PATH,
  '/privacy',
  '/terms',
  '/contact',
  '/login',
  '/signin',
  '/sign-in',
  '/signup',
  '/sso-callback',
  '/onboarding',
  '/showcase',
];

function isProtectedScoringPath(pathname = '') {
  return isProtectedScoringRoute(pathname);
}

function isSportAppPath(pathname = '') {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return false;
  if (!getSportById(segments[0])) return false;
  return segments[1] === 'quick' || segments[1] === 'tournament';
}

function isAppShellPath(pathname = '') {
  const normalizedPathname = normalizePathname(pathname);
  if (PUBLIC_SHELL_PREFIXES.some((prefix) => normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`))) {
    return false;
  }

  return APP_SHELL_PREFIXES.some((prefix) => normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`)) ||
    isSportAppPath(normalizedPathname);
}

function getReturnTo(location) {
  return `${location.pathname}${location.search}${location.hash}`;
}

function normalizePathname(pathname = '') {
  if (!pathname) return '/';
  let end = pathname.length;
  while (end > 1 && pathname[end - 1] === '/') end -= 1;
  return pathname.slice(0, end) || '/';
}

function shouldDeferOnboardingForPath(pathname = '') {
  const normalizedPathname = normalizePathname(pathname);
  return ONBOARDING_DEFER_PATHS.has(normalizedPathname) ||
    isProtectedScoringPath(normalizedPathname) ||
    isSportAppPath(normalizedPathname);
}

function AppEntryRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const appEntryState = loadAppEntryState();
  const target = getAppEntryTarget({
    isAuthenticated,
    isLoading,
    ...appEntryState,
  });

  if (!target) return <LazyFallback />;
  return <Navigate to={target} replace />;
}

function OnboardingGuard({ children }) {
  const { needsOnboarding, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <LazyFallback />;
  const bypassed = GUARD_BYPASS_PREFIXES.some((p) => location.pathname.startsWith(p));
  const shouldDefer = shouldDeferOnboardingForPath(location.pathname);
  if (needsOnboarding && !bypassed && !shouldDefer) {
    const returnTo = getReturnTo(location);
    return <Navigate to={`/onboarding?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return children;
}

OnboardingGuard.propTypes = {
  children: PropTypes.node,
};

function OnboardingReminder() {
  const { cloudAuthAvailable, isLoading, needsOnboarding } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (
    isLoading ||
    !cloudAuthAvailable ||
    !needsOnboarding ||
    isProtectedScoringPath(location.pathname) ||
    !shouldDeferOnboardingForPath(location.pathname)
  ) {
    return null;
  }

  const returnTo = getReturnTo(location);

  return (
    <div
      className="mono-card"
      role="status"
      aria-live="polite"
      style={{
        margin: '8px auto 0',
        maxWidth: '640px',
        padding: '12px',
        borderColor: 'var(--se-color-action)',
        color: '#111',
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--se-color-action)', marginBottom: 4 }}>
            Profile setup can wait
          </p>
          <p className="text-sm" style={{ color: '#444', margin: 0 }}>
            Keep scoring now. Finish your profile when you want sync, search, and account tools.
          </p>
        </div>
        <button
          type="button"
          className="mono-btn-primary"
          style={{ minHeight: 44, padding: '10px 12px', whiteSpace: 'nowrap' }}
          onClick={() => navigate(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`)}
        >
          Finish profile
        </button>
      </div>
    </div>
  );
}

function AppConfirmDialog({ prompt, onCancel, onConfirm }) {
  const cancelButtonRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!prompt) return undefined;

    cancelButtonRef.current?.focus();

    const handleKeyDown = (event) => handleAppConfirmKeyDown(event, dialogRef.current, onCancel);

    globalThis.addEventListener('keydown', handleKeyDown, true);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onCancel, prompt]);

  if (!prompt) return null;

  return (
    <div className="app-confirm-backdrop" role="presentation">
      <button
        type="button"
        className="app-confirm-backdrop-button"
        aria-label="Dismiss dialog"
        onClick={onCancel}
        tabIndex={-1}
      />
      <section
        className="app-confirm-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-confirm-title"
        aria-describedby="app-confirm-message"
      >
        <p id="app-confirm-eyebrow" className="app-confirm-eyebrow">
          Score Easy
        </p>
        <h2 id="app-confirm-title" className="app-confirm-title">
          {prompt.title || 'Leave this page?'}
        </h2>
        <p id="app-confirm-message" className="app-confirm-message">
          {prompt.message}
        </p>
        <div className="app-confirm-actions">
          <button
            type="button"
            ref={cancelButtonRef}
            className="app-confirm-secondary"
            onClick={onCancel}
          >
            {prompt.cancelLabel || 'Stay here'}
          </button>
          <button
            type="button"
            className={`app-confirm-primary${prompt.tone === 'danger' ? ' app-confirm-danger' : ''}`}
            onClick={onConfirm}
          >
            {prompt.confirmLabel || 'Leave'}
          </button>
        </div>
      </section>
    </div>
  );
}

AppConfirmDialog.propTypes = {
  prompt: PropTypes.shape({
    title: PropTypes.string,
    message: PropTypes.string.isRequired,
    confirmLabel: PropTypes.string,
    cancelLabel: PropTypes.string,
    onConfirm: PropTypes.func,
    onCancel: PropTypes.func,
    tone: PropTypes.oneOf(['primary', 'danger']),
  }),
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

function NavIcon({ name }) {
  const commonProps = {
    'aria-hidden': 'true',
    fill: 'none',
    height: 22,
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
    width: 22,
  };

  if (name === 'home') {
    return (
      <svg {...commonProps}>
        <path d="M4 10.5 12 4l8 6.5" />
        <path d="M6.5 10v9h11v-9" />
        <path d="M10 19v-5h4v5" />
      </svg>
    );
  }

  if (name === 'play') {
    return (
      <svg {...commonProps}>
        <path d="M8 5.5v13l10-6.5z" />
      </svg>
    );
  }

  if (name === 'matches') {
    return (
      <svg {...commonProps}>
        <path d="M7 6h11" />
        <path d="M7 12h11" />
        <path d="M7 18h11" />
        <path d="M4 6h.01" />
        <path d="M4 12h.01" />
        <path d="M4 18h.01" />
      </svg>
    );
  }

  if (name === 'stats') {
    return (
      <svg {...commonProps}>
        <path d="M5 19V9" />
        <path d="M12 19V5" />
        <path d="M19 19v-7" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

NavIcon.propTypes = {
  name: PropTypes.oneOf(['home', 'play', 'matches', 'stats', 'account']).isRequired,
};

// Single account control for the mobile bottom nav. The bottom nav is the ONLY
// account surface on mobile (the header is hidden under 768px), so this cell
// renders the real Clerk account button — the sole sign-out / manage-account
// entry point. We render exactly one interactive control: the Clerk button when
// it has mounted, otherwise a /profile fallback button so the tab is never dead
// during the async Clerk component load. (No invisible button stacked on a
// visible one — that double control was the accessibility bug this fixes.)
function BottomNavAccountCell({ item, active, onNavigate }) {
  const [clerkReady, setClerkReady] = useState(false);
  const controlRef = useRef(null);

  useEffect(() => {
    const node = controlRef.current;
    if (!node) return undefined;

    const sync = () => setClerkReady(node.childElementCount > 0);
    sync();

    // Clerk's UserButton mounts asynchronously after its chunk loads; watch the
    // host node so the fallback hands off to the real control without flicker.
    const ObserverCtor = globalThis.MutationObserver;
    if (typeof ObserverCtor !== 'function') return undefined;
    const observer = new ObserverCtor(sync);
    observer.observe(node, { childList: true });
    return () => observer.disconnect();
  }, []);

  return (
    // The active "you are here" cue lives on the CELL, not just the fallback
    // button: when Clerk has mounted, the interactive control is the Clerk
    // account button (which we cannot decorate with aria-current), so the cell
    // carries the active state for both the loaded and loading paths. Mirror it
    // onto `aria-current` so the cue is exposed to assistive tech too.
    <div
      className={`global-bottom-nav-account-cell${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <span
        ref={controlRef}
        className={`global-bottom-nav-account-control${clerkReady ? ' is-ready' : ''}`}
      >
        <AuthUserButton aria-label="Account menu" />
      </span>
      {!clerkReady && (
        <button
          type="button"
          onClick={onNavigate}
          className="global-bottom-nav-account-fallback"
          aria-current={active ? 'page' : undefined}
          aria-label="Account"
        >
          <span className="global-bottom-nav-icon">
            <NavIcon name={item.icon} />
          </span>
        </button>
      )}
      <span className="global-bottom-nav-label" aria-hidden="true">{item.label}</span>
    </div>
  );
}

BottomNavAccountCell.propTypes = {
  item: PropTypes.shape({
    icon: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    path: PropTypes.string.isRequired,
  }).isRequired,
  active: PropTypes.bool,
  onNavigate: PropTypes.func.isRequired,
};

function GlobalNavigation({ requestScoringExit }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { cloudAuthAvailable, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const mobileMenuRef = useRef(null);
  const pathname = location.pathname;
  const showBottomNav = isAppShellPath(pathname) && !isProtectedScoringPath(pathname);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const dialog = mobileMenuRef.current;
    if (!dialog) return undefined;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }

    const handleCancel = (event) => {
      event.preventDefault();
      setOpen(false);
    };
    const handleClose = () => setOpen(false);

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('close', handleClose);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('close', handleClose);
    };
  }, [open]);

  useEffect(() => {
    const body = globalThis.document?.body;
    if (!body) return undefined;

    body.classList.toggle('has-mobile-bottom-nav', showBottomNav);

    return () => {
      body.classList.remove('has-mobile-bottom-nav');
    };
  }, [showBottomNav]);

  useEffect(() => {
    const body = globalThis.document?.body;
    if (!body) return undefined;

    const isEditingTarget = (target) => target instanceof HTMLElement &&
      (
        target.matches('input, textarea, select, [contenteditable="true"]') ||
        Boolean(target.closest('[contenteditable="true"]'))
      );
    const handleFocusIn = (event) => {
      body.classList.toggle('has-mobile-input-focus', isEditingTarget(event.target));
    };
    const handleFocusOut = () => {
      body.classList.remove('has-mobile-input-focus');
    };

    globalThis.document.addEventListener('focusin', handleFocusIn);
    globalThis.document.addEventListener('focusout', handleFocusOut);

    return () => {
      body.classList.remove('has-mobile-input-focus');
      globalThis.document.removeEventListener('focusin', handleFocusIn);
      globalThis.document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const go = (path) => {
    if (path !== pathname && isProtectedScoringPath(pathname)) {
      setOpen(false);
      requestScoringExit({
        onConfirm: () => navigate(path),
      });
      return;
    }

    navigate(path);
    setOpen(false);
  };

  // Each surface (header, mobile sheet, bottom nav) shares a single logical
  // `tab` id so active styling is computed identically everywhere. Previously
  // the header Home used path "/" (which matched every route via startsWith)
  // while the bottom nav used APP_ENTRY_PATH, so the active tab disagreed across
  // surfaces. Keying off `tab` removes that drift.
  const accountTab = isAuthenticated ? 'account' : 'signin';
  const accountPath = isAuthenticated ? '/profile' : '/login';
  const accountLabel = isAuthenticated ? 'Account' : 'Sign in';

  const navItems = [
    { tab: 'home', label: 'Home', path: '/' },
    { tab: 'play', label: 'Play', path: '/play' },
    { tab: 'history', label: 'History', path: '/history' },
  ];

  if (cloudAuthAvailable) {
    navItems.push({ tab: accountTab, label: accountLabel, path: accountPath });
  }

  const bottomNavItems = [
    { tab: 'home', label: 'Home', path: APP_ENTRY_PATH, icon: 'home' },
    { tab: 'play', label: 'Play', path: '/play', icon: 'play' },
    { tab: 'history', label: 'History', path: '/history', icon: 'matches' },
    cloudAuthAvailable
      ? {
        tab: accountTab,
        label: accountLabel,
        path: accountPath,
        icon: 'account',
      }
      : null,
  ].filter(Boolean);

  const isTabActive = (tab) => {
    switch (tab) {
      case 'home':
        return pathname === '/' || pathname === APP_ENTRY_PATH || pathname === '/dashboard';
      case 'play':
        return pathname === '/play' || /^\/[^/]+\/(quick|tournament)(\/|$)/.test(pathname);
      case 'history':
        // History now hosts the merged stats view; keep the tab active for the
        // legacy /statistics and /stats paths while their redirects resolve.
        return pathname === '/history' ||
          pathname.startsWith('/history/') ||
          pathname === '/statistics' ||
          pathname === '/stats';
      case 'signin':
        return pathname.startsWith('/login') ||
          pathname.startsWith('/signup') ||
          pathname.startsWith('/onboarding');
      case 'account':
        return pathname.startsWith('/profile') ||
          pathname.startsWith('/users/search') ||
          pathname.startsWith('/onboarding');
      default:
        return false;
    }
  };

  const isActive = (item) => isTabActive(item.tab);

  const currentItem = navItems.find(isActive);

  return (
    <>
      <header className="global-nav">
        <button
          type="button"
          className="global-nav-brand"
          aria-label="Score Easy home"
          onClick={() => go('/')}
        >
          <span aria-hidden="true">SCORE<br />EASY</span>
        </button>

        <nav className="global-nav-links" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => go(item.path)}
              className="global-nav-link"
              aria-current={isActive(item) ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {cloudAuthAvailable && isAuthenticated && (
          <div className="global-nav-account">
            <AuthUserButton aria-label="Account menu" />
          </div>
        )}

        <button
          type="button"
          className="global-mobile-menu-button"
          aria-label="Navigation menu"
          aria-expanded={open}
          aria-controls="global-mobile-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>
      {open && (
        <dialog
          ref={mobileMenuRef}
          id="global-mobile-menu"
          className="global-mobile-menu-sheet"
          aria-label="Navigation menu"
        >
          <button
            type="button"
            className="global-mobile-menu-backdrop"
            aria-label="Dismiss navigation menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <div className="global-mobile-menu-content">
            <div className="global-mobile-menu-heading">
              <span>Menu</span>
              <span>{currentItem?.label ?? 'Home'}</span>
              <button
                type="button"
                className="global-mobile-menu-close"
                aria-label="Close navigation menu"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <nav className="global-mobile-menu-panel" aria-label="Navigation menu">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => go(item.path)}
                  className="global-mobile-menu-item"
                  aria-current={isActive(item) ? 'page' : undefined}
                >
                  {item.label}
                </button>
              ))}
              {cloudAuthAvailable && isAuthenticated && (
                <div className="global-mobile-menu-account">
                  <AuthUserButton aria-label="Account menu" />
                </div>
              )}
            </nav>
          </div>
        </dialog>
      )}
      {showBottomNav && bottomNavItems.length > 0 && (
        <nav
          className="global-bottom-nav global-bottom-nav-native"
          aria-label="App navigation"
          style={{ '--bottom-nav-count': bottomNavItems.length }}
        >
          {bottomNavItems.map((item) => {
            // Single control per cell. For a signed-in account tab the ONE
            // control is the Clerk account button itself (the only sign-out /
            // manage-account surface on mobile, where the header is hidden) with
            // a non-interactive label beneath it. We no longer stack an
            // invisible Clerk button over a separate visible nav button — that
            // double control confused screen readers and dead-mapped the tap.
            // If Clerk has not loaded yet, fall back to a single nav button to
            // /profile so the tab is never dead.
            if (item.tab === 'account') {
              return (
                <BottomNavAccountCell
                  key={item.path}
                  item={item}
                  active={isActive(item)}
                  onNavigate={() => go(item.path)}
                />
              );
            }

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => go(item.path)}
                className="global-bottom-nav-item"
                aria-current={isActive(item) ? 'page' : undefined}
              >
                <span className="global-bottom-nav-icon">
                  <NavIcon name={item.icon} />
                </span>
                <span className="global-bottom-nav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
      <style>{`
        .global-nav {
          box-sizing: border-box;
          position: sticky;
          top: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          max-width: 100vw;
          min-height: 56px;
          padding: 0 32px;
          border-bottom: 1px solid var(--se-color-line);
          background: var(--se-color-surface);
        }

        .global-nav-brand {
          border: 0;
          background: transparent;
          color: var(--se-color-ink-strong);
          cursor: pointer;
          font-family: var(--se-font-mono);
          font-size: 0.75rem;
          font-weight: 800;
          line-height: 1.1;
          padding: 0;
          text-align: left;
        }

        .global-nav-links {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .global-nav-link {
          border: var(--se-border-standard) solid transparent;
          border-radius: var(--se-radius-button);
          background: transparent;
          color: var(--se-color-ink-muted);
          cursor: pointer;
          font-family: var(--se-font-mono);
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          padding: 9px 12px;
          text-transform: uppercase;
        }

        .global-nav-link:hover,
        .global-nav-link[aria-current="page"] {
          border-color: var(--se-color-action);
          background: var(--se-color-action);
          color: var(--se-color-inverse);
        }

        .global-mobile-menu-button,
        .global-mobile-menu-backdrop,
        .global-mobile-menu-sheet,
        .global-mobile-menu-content,
        .global-mobile-menu-account,
        .global-bottom-nav {
          display: none;
        }

        .global-nav-account {
          display: inline-flex;
          align-items: center;
          min-width: 34px;
          min-height: 34px;
        }

        .app-confirm-backdrop {
          position: fixed;
          inset: 0;
          z-index: 260;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.28);
          padding: max(20px, env(safe-area-inset-top, 0px)) max(20px, env(safe-area-inset-right, 0px)) max(20px, env(safe-area-inset-bottom, 0px)) max(20px, env(safe-area-inset-left, 0px));
          backdrop-filter: blur(2px);
        }

        .app-confirm-backdrop-button {
          position: absolute;
          inset: 0;
          border: 0;
          background: transparent;
          cursor: pointer;
        }

        .app-confirm-dialog {
          position: relative;
          z-index: 1;
          width: min(480px, 100%);
          max-height: min(720px, calc(100vh - 40px));
          overflow: auto;
          border: var(--se-border-standard) solid var(--se-color-line-strong);
          border-radius: var(--se-radius-card);
          background: var(--se-color-surface);
          color: var(--se-color-ink-strong);
          box-shadow: var(--se-shadow-hard);
          padding: 26px;
        }

        .app-confirm-eyebrow {
          color: var(--se-color-action);
          font-family: var(--se-font-mono);
          font-size: 0.6875rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          margin: 0 0 10px;
          text-transform: uppercase;
        }

        .app-confirm-title {
          color: var(--se-color-ink-strong);
          font-size: 1.25rem;
          font-weight: 800;
          line-height: 1.2;
          margin: 0 0 10px;
        }

        .app-confirm-message {
          color: var(--se-color-ink-soft);
          font-size: 0.9375rem;
          line-height: 1.5;
          margin: 0 0 24px;
        }

        .app-confirm-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .app-confirm-primary,
        .app-confirm-secondary {
          min-height: 48px;
          border: var(--se-border-standard) solid var(--se-color-line-strong);
          border-radius: var(--se-radius-button);
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 700;
          padding: 12px 18px;
          touch-action: manipulation;
        }

        .app-confirm-primary {
          background: var(--se-color-action);
          color: var(--se-color-inverse);
        }

        .app-confirm-danger {
          background: var(--se-color-ink-strong);
          color: var(--se-color-inverse);
        }

        .app-confirm-secondary {
          background: var(--se-color-surface);
          color: var(--se-color-ink-strong);
        }

        .app-scoring-notice {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 16px;
          border: var(--se-border-standard) solid var(--se-color-line-strong);
          border-radius: var(--se-radius-card);
          background: var(--se-color-surface);
          box-shadow: var(--se-shadow-card);
          padding: 14px 16px;
        }

        .app-scoring-notice-warning {
          border-left: 6px solid #d97706;
        }

        .app-scoring-notice-success {
          border-left: 6px solid #16a34a;
        }

        .app-scoring-notice-copy {
          min-width: 0;
        }

        .app-scoring-notice-label {
          display: block;
          color: var(--se-color-action);
          font-family: var(--se-font-mono);
          font-size: 0.625rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          margin-bottom: 4px;
          text-transform: uppercase;
        }

        .app-scoring-notice-message {
          color: var(--se-color-ink-soft);
          font-size: 0.875rem;
          line-height: 1.45;
          margin: 0;
        }

        .app-scoring-notice-action {
          min-height: 44px;
          border: var(--se-border-standard) solid var(--se-color-line-strong);
          border-radius: var(--se-radius-button);
          background: var(--se-color-action);
          color: var(--se-color-inverse);
          cursor: pointer;
          font-size: 0.8125rem;
          font-weight: 800;
          padding: 10px 14px;
          touch-action: manipulation;
        }

        @media (max-width: 767px) {
          body.has-mobile-bottom-nav {
            padding-bottom: calc(82px + env(safe-area-inset-bottom, 0px));
          }

          body.has-mobile-input-focus {
            padding-bottom: 0;
          }

          .app-confirm-backdrop {
            align-items: flex-end;
            padding: 16px 16px max(16px, env(safe-area-inset-bottom, 0px));
          }

          .app-confirm-dialog {
            width: 100%;
            max-height: min(88vh, 680px);
            padding: 20px;
            box-shadow: var(--se-shadow-hard);
          }

          .app-confirm-actions {
            flex-direction: column-reverse;
            align-items: stretch;
          }

          .app-confirm-primary,
          .app-confirm-secondary {
            width: 100%;
            min-height: 50px;
          }

          .app-scoring-notice {
            align-items: stretch;
            flex-direction: column;
            gap: 12px;
            padding: 14px;
          }

          .app-scoring-notice-action {
            width: 100%;
          }

          .global-nav {
            display: none;
          }

          .global-nav-links {
            display: none;
          }

          .global-nav-account {
            display: none;
          }

          .global-mobile-menu-button {
            display: none;
          }

          .global-mobile-menu-button span {
            display: block;
            width: 16px;
            height: 2px;
            background: var(--se-color-action);
          }

          .global-mobile-menu-sheet {
            position: fixed;
            inset: 0;
            z-index: 240;
            display: block;
            width: 100vw;
            height: 100vh;
            max-width: none;
            max-height: none;
            margin: 0;
            border: 0;
            background: transparent;
            padding: 0;
          }

          .global-mobile-menu-backdrop {
            position: absolute;
            inset: 0;
            display: block;
            border: 0;
            background: rgba(0, 0, 0, 0.16);
            cursor: pointer;
          }

          .global-mobile-menu-content {
            position: absolute;
            right: 12px;
            bottom: calc(12px + env(safe-area-inset-bottom, 0px));
            left: 12px;
            display: block;
            border: var(--se-border-standard) solid var(--se-color-line-strong);
            border-radius: var(--se-radius-card);
            background: var(--se-color-surface);
            color: var(--se-color-ink-strong);
            box-shadow: var(--se-shadow-hard);
            overflow: hidden;
          }

          .global-mobile-menu-sheet::backdrop {
            background: transparent;
          }

          .global-mobile-menu-heading {
            display: grid;
            grid-template-columns: 1fr auto auto;
            gap: 12px;
            min-height: 48px;
            align-items: center;
            border-bottom: var(--se-border-standard) solid var(--se-color-line-strong);
            color: var(--se-color-ink-muted);
            font-family: var(--se-font-mono);
            font-size: 0.75rem;
            font-weight: 800;
            letter-spacing: 0.06em;
            padding: 0 16px;
            text-transform: uppercase;
          }

          .global-mobile-menu-close {
            min-height: 36px;
            border: var(--se-border-standard) solid var(--se-color-line-strong);
            border-radius: var(--se-radius-button);
            background: var(--se-color-surface);
            color: var(--se-color-ink-strong);
            cursor: pointer;
            font: inherit;
            padding: 0 10px;
            text-transform: uppercase;
          }

          .global-mobile-menu-panel {
            display: flex;
            flex-direction: column;
            background: var(--se-color-surface);
          }

          .global-mobile-menu-item {
            border: 0;
            border-bottom: 1px solid color-mix(in oklch, var(--se-color-line) 14%, var(--se-color-surface));
            background: transparent;
            color: var(--se-color-ink-strong);
            cursor: pointer;
            font-family: inherit;
            font-size: 0.875rem;
            font-weight: 700;
            min-height: 48px;
            padding: 14px 16px;
            text-align: left;
          }

          .global-mobile-menu-item[aria-current="page"] {
            background: var(--se-color-action);
            color: var(--se-color-inverse);
          }

          .global-mobile-menu-item:last-child {
            border-bottom: 0;
          }

          .global-mobile-menu-account {
            display: flex;
            justify-content: flex-start;
            min-height: 52px;
            padding: 12px 16px;
          }

          .global-bottom-nav {
            position: fixed;
            right: 10px;
            bottom: 8px;
            left: 10px;
            right: max(10px, env(safe-area-inset-right, 0px));
            bottom: max(8px, env(safe-area-inset-bottom, 0px));
            left: max(10px, env(safe-area-inset-left, 0px));
            z-index: 210;
            display: grid;
            grid-template-columns: repeat(var(--bottom-nav-count), minmax(0, 1fr));
            gap: 2px;
            width: auto;
            max-width: 520px;
            margin: 0 auto;
            border: 1px solid color-mix(in oklch, var(--se-color-line) 12%, transparent);
            border-radius: 14px;
            background: color-mix(in oklch, var(--se-color-surface) 86%, transparent);
            padding: 4px;
            -webkit-backdrop-filter: blur(16px);
            backdrop-filter: blur(16px);
          }

          .global-bottom-nav-item {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 3px;
            min-height: 54px;
            border: 0;
            border-radius: 10px;
            background: transparent;
            color: var(--se-color-ink-muted);
            cursor: pointer;
            font-family: var(--se-font-mono);
            font-size: 0.5625rem;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            line-height: 1;
            position: relative;
          }

          .global-bottom-nav-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            color: currentColor;
          }

          .global-bottom-nav-icon svg {
            display: block;
            width: 22px;
            height: 22px;
          }

          .global-bottom-nav-label {
            line-height: 1;
          }

          /* Account cell: one stacked control (Clerk button or fallback) plus a
             non-interactive label, laid out to match the other tabs. The cell
             itself fills the grid track and carries the active cue + a >=44px
             tap target (the control/fallback stretch to fill it). */
          .global-bottom-nav-account-cell {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 3px;
            min-height: 54px;
            width: 100%;
            min-width: 0;
            border-radius: 10px;
            color: var(--se-color-ink-muted);
          }

          .global-bottom-nav-account-control {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 44px;
            min-height: 44px;
          }

          /* Clerk renders its own avatar trigger inside the control wrapper.
             Sizing only the wrapper leaves the real hit area (Clerk's avatar
             button) at ~24px, so we expand Clerk's own trigger/avatar box to
             the 44px target as well. */
          .global-bottom-nav-account-control .cl-userButtonTrigger,
          .global-bottom-nav-account-control .cl-userButtonBox {
            width: 44px;
            height: 44px;
          }

          .global-bottom-nav-account-control .cl-userButtonAvatarBox {
            width: 36px;
            height: 36px;
          }

          .global-bottom-nav-account-fallback {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            min-height: 44px;
            border: 0;
            border-radius: 10px;
            background: transparent;
            color: currentColor;
            cursor: pointer;
          }

          /* Unified active treatment: every nav surface (header link, mobile
             sheet item, bottom-nav item, account cell) paints the active tab
             with the same solid action fill + inverse ink, so the "you are
             here" cue is consistent across the shell. The account cell needs
             its own selector because its interactive control is the Clerk
             button (no aria-current of its own) rather than a
             .global-bottom-nav-item, so the cue is driven by the cell's
             is-active state. */
          .global-bottom-nav-item[aria-current="page"],
          .global-bottom-nav-account-cell.is-active {
            background: var(--se-color-action);
            color: var(--se-color-inverse);
          }

          body.has-mobile-input-focus .global-bottom-nav {
            display: none;
          }
        }

      `}</style>
    </>
  );
}

GlobalNavigation.propTypes = {
  requestScoringExit: PropTypes.func.isRequired,
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
  const navigate = useNavigate();
  // `authMode === 'cloud'` is set only by CloudAuthProvider, which is nested
  // inside ConvexProviderWithClerk — so this flag doubles as proof that a
  // ConvexProvider is present, gating the reconnecting indicator safely.
  const { authMode } = useAuth();
  const [exitPrompt, setExitPrompt] = useState(null);
  const exitPromptRef = useRef(null);
  const allowNextProtectedPopRef = useRef(false);
  const protectedRouteHistoryIndexRef = useRef(null);
  const protectedGuardDepthRef = useRef(0);
  const protectedGuardRouteKeyRef = useRef(null);
  const nativeDeepLinkContextRef = useRef({
    hash: '',
    pathname: '/',
    requestScoringExit: null,
    search: '',
  });

  const requestScoringExit = useCallback((options = {}) => {
    exitPromptRef.current?.onCancel?.();

    const nextPrompt = {
      title: SCORING_EXIT_TITLE,
      message: SCORING_EXIT_MESSAGE,
      confirmLabel: 'Leave page',
      cancelLabel: 'Stay here',
      tone: 'danger',
      ...options,
    };

    exitPromptRef.current = nextPrompt;
    setExitPrompt(nextPrompt);
  }, []);

  const cancelExitPrompt = useCallback(() => {
    const onCancel = exitPrompt?.onCancel;
    exitPromptRef.current = null;
    setExitPrompt(null);
    onCancel?.();
  }, [exitPrompt]);

  const confirmExitPrompt = useCallback(() => {
    const onConfirm = exitPrompt?.onConfirm;
    exitPromptRef.current = null;
    setExitPrompt(null);
    onConfirm?.();
  }, [exitPrompt]);

  const navigateFromOfflineFallback = useCallback((path) => {
    if (path !== location.pathname && isProtectedScoringPath(location.pathname)) {
      requestScoringExit({
        onConfirm: () => navigate(path),
      });
      return;
    }

    navigate(path);
  }, [location.pathname, navigate, requestScoringExit]);

  useEffect(() => {
    nativeDeepLinkContextRef.current = {
      hash: location.hash || '',
      pathname: location.pathname,
      requestScoringExit,
      search: location.search,
    };
  }, [location.hash, location.pathname, location.search, requestScoringExit]);

  const confirmNativeDeepLinkNavigation = useCallback((targetPath) => {
    const { hash, pathname, requestScoringExit: requestExit, search } = nativeDeepLinkContextRef.current;
    if (!isProtectedScoringPath(pathname)) return Promise.resolve(true);
    if (targetPath === `${pathname}${search}${hash}`) {
      return Promise.resolve(true);
    }
    if (typeof requestExit !== 'function') return Promise.resolve(false);

    return new Promise((resolve) => {
      requestExit({
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, []);

  useEffect(() => installNativeDeepLinkHandler({
    beforeNavigate: confirmNativeDeepLinkNavigation,
    navigate,
  }), [confirmNativeDeepLinkNavigation, navigate]);

  // Browser back button protection for active game/scoring routes
  useEffect(() => {
    const isGameRoute = isProtectedScoringPath(location.pathname);

    if (!isGameRoute) {
      allowNextProtectedPopRef.current = false;
      protectedRouteHistoryIndexRef.current = null;
      protectedGuardDepthRef.current = 0;
      protectedGuardRouteKeyRef.current = null;
      return undefined;
    }

    const routeKey = `${location.pathname}${location.search}`;
    const routeHistoryIndex = globalThis.history.state?.idx;
    if (protectedRouteHistoryIndexRef.current === null && typeof routeHistoryIndex === 'number') {
      protectedRouteHistoryIndexRef.current = routeHistoryIndex > 0 ? routeHistoryIndex - 1 : NO_PRIOR_ROUTE_INDEX;
    }

    if (protectedGuardRouteKeyRef.current !== routeKey) {
      protectedGuardRouteKeyRef.current = routeKey;
      protectedGuardDepthRef.current += 1;
      globalThis.history.pushState({ ...globalThis.history.state, gameProtection: true }, '');
    }

    let fallbackTimeoutId = null;
    let replaceScoringEntryOnPop = null;
    const clearPendingFallbackNavigation = () => {
      if (fallbackTimeoutId !== null) {
        globalThis.clearTimeout(fallbackTimeoutId);
        fallbackTimeoutId = null;
      }

      if (replaceScoringEntryOnPop) {
        globalThis.removeEventListener('popstate', replaceScoringEntryOnPop);
        replaceScoringEntryOnPop = null;
      }
    };

    const leaveProtectedRouteAfterConfirm = (fallbackPath) => {
      const protectedBackFallback = fallbackPath || getProtectedScoringBackFallback(location.pathname) || '/play';
      const currentRouteHistoryIndex = globalThis.history.state?.idx;
      const baseRouteHistoryIndex = protectedRouteHistoryIndexRef.current;
      const canReturnToPriorRoute =
        typeof currentRouteHistoryIndex === 'number' &&
        typeof baseRouteHistoryIndex === 'number' &&
        baseRouteHistoryIndex !== NO_PRIOR_ROUTE_INDEX &&
        currentRouteHistoryIndex > baseRouteHistoryIndex;

      if (canReturnToPriorRoute) {
        const backDelta = currentRouteHistoryIndex - baseRouteHistoryIndex + protectedGuardDepthRef.current;
        allowNextProtectedPopRef.current = true;
        globalThis.history.go(-backDelta);
        return;
      }

      clearPendingFallbackNavigation();
      allowNextProtectedPopRef.current = true;
      replaceScoringEntryOnPop = () => {
        clearPendingFallbackNavigation();
        navigate(protectedBackFallback, { replace: true });
      };

      globalThis.addEventListener('popstate', replaceScoringEntryOnPop, { once: true });
      globalThis.history.back();
      fallbackTimeoutId = globalThis.setTimeout(() => {
        clearPendingFallbackNavigation();
        if (isProtectedScoringPath(globalThis.location.pathname)) {
          navigate(protectedBackFallback, { replace: true });
        }
      }, 300);
    };

    const handlePopState = () => {
      if (allowNextProtectedPopRef.current) {
        allowNextProtectedPopRef.current = false;
        return;
      }

      globalThis.history.pushState({ ...globalThis.history.state, gameProtection: true }, '');
      requestScoringExit({
        onConfirm: leaveProtectedRouteAfterConfirm,
      });
    };

    globalThis.addEventListener('popstate', handlePopState);
    const cleanupNativeBackButton = installNativeBackButtonGuard({
      getPathname: () => globalThis.location.pathname,
      confirmLeave: () => new Promise((resolve) => {
        requestScoringExit({
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false),
        });
      }),
      goBack: leaveProtectedRouteAfterConfirm,
      navigateFallback: (path, options = {}) => {
        if (options.unwindProtectedEntry) {
          leaveProtectedRouteAfterConfirm(path);
          return;
        }

        navigate(path, options);
      },
    });

    return () => {
      globalThis.removeEventListener('popstate', handlePopState);
      clearPendingFallbackNavigation();
      cleanupNativeBackButton();
    };
  }, [location.pathname, location.search, navigate, requestScoringExit]);

  return (
    <div className="min-h-screen font-swiss" style={{ background: 'var(--se-color-canvas)', color: 'var(--se-color-ink-strong)' }}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <GlobalNavigation requestScoringExit={requestScoringExit} />
      <OfflineFallback onNavigate={navigateFromOfflineFallback} />
      {authMode === 'cloud' ? <ConvexReconnectingFallback /> : null}
      <OnboardingReminder />
      <main id="main-content">
        <Suspense fallback={<LazyFallback />}>
          <ErrorBoundary title="App route crashed" message="The route tree failed to render.">
            <OnboardingGuard>
              <Routes>
                <Route path="" element={<AppEntryRoute />} />
                <Route path={PUBLIC_MARKETING_PATH.slice(1)} element={<MonoLanding />} />
                <Route path={APP_ENTRY_PATH.slice(1)} element={<DashboardLanding />} />
                <Route path="privacy" element={<LegalPage type="privacy" />} />
                <Route path="terms" element={<LegalPage type="terms" />} />
                <Route path="contact" element={<LegalPage type="contact" />} />

                <Route path="login/*" element={<CloudAuthOnly><MonoLogin /></CloudAuthOnly>} />
                <Route path="signin/*" element={<SignInAliasRedirect />} />
                <Route path="sign-in/*" element={<SignInAliasRedirect />} />
                <Route path="signup/*" element={<CloudAuthOnly><MonoSignUp /></CloudAuthOnly>} />
                <Route path="sso-callback" element={<CloudAuthOnly><SSOCallback /></CloudAuthOnly>} />
                <Route path="onboarding" element={<CloudAuthOnly><MonoOnboarding /></CloudAuthOnly>} />

                <Route path="profile" element={<CloudAuthOnly><ErrorBoundary title="Profile unavailable" message="We could not load this profile. Try again or return home."><MonoProfile /></ErrorBoundary></CloudAuthOnly>} />
                <Route path="profile/:username" element={<CloudAuthOnly><ErrorBoundary title="Profile unavailable" message="We could not load this profile. Try again or return home."><MonoProfile /></ErrorBoundary></CloudAuthOnly>} />
                <Route path="users/search" element={<CloudAuthOnly><MonoUserSearch /></CloudAuthOnly>} />

                <Route path="play" element={<MonoPlayHub />} />
                <Route path="dashboard" element={<Navigate to={APP_ENTRY_PATH} replace />} />
                <Route path="quick-match" element={<LegacyQuickMatchRoute />} />
                <Route path="tournament" element={<LegacyTournamentRoute />} />
                <Route path="stats" element={<Navigate to="/history" replace />} />
                <Route path="game/:id" element={<GameResumeRecoveryRoute />} />

                {/* Public spectator page — MUST sit above the :sport/* routes so
                    "live" is never captured as a sport slug. Renders no app dock. */}
                <Route path="live/:token" element={<MonoWatchMatch />} />

                <Route path=":sport/tournament" element={<SportRouteGuard><MonoTournamentList /></SportRouteGuard>} />
                <Route path=":sport/tournament/new" element={<SportRouteGuard><MonoTournamentSetup /></SportRouteGuard>} />
                <Route path=":sport/tournament/:id" element={<SportRouteGuard><TournamentDispatcher /></SportRouteGuard>} />
                <Route path=":sport/tournament/:id/match/:matchId/score" element={<SportRouteGuard><MonoTournamentLiveScore /></SportRouteGuard>} />
                <Route path=":sport/tournament/:id/match/:matchId/result" element={<SportRouteGuard><MonoMatchResult /></SportRouteGuard>} />
                <Route path=":sport/quick" element={<SportRouteGuard><MonoQuickMatch /></SportRouteGuard>} />
                <Route path=":sport/quick/test/:matchId" element={<LegacyCricketQuickTestRoute />} />
                <Route path=":sport/quick/test-match/:matchId" element={<CricketQuickTestScorerRoute />} />
                <Route path=":sport/quick/live/:matchId" element={<TennisQuickScorerRoute />} />
                <Route path=":sport/live/:matchId" element={<LegacyTennisLiveRoute />} />

                <Route path="statistics" element={<Navigate to="/history" replace />} />

                {SHOW_INTERNAL_ROUTES && (
                  <>
                    <Route path="showcase/match-card" element={<MonoMatchCardShowcase />} />
                    <Route path="showcase/set-display" element={<MonoSetDisplayShowcase />} />
                    <Route path="showcase/brutalist-colors" element={<BrutalistColorShowcase />} />
                    <Route path="showcase/dashboard-variants" element={<DashboardShowcase />} />
                  </>
                )}

                <Route path="history" element={<MonoHistory />} />
                <Route path="*" element={<NotFoundRoute />} />
              </Routes>
            </OnboardingGuard>
          </ErrorBoundary>
        </Suspense>
      </main>
      <AppConfirmDialog
        prompt={exitPrompt}
        onCancel={cancelExitPrompt}
        onConfirm={confirmExitPrompt}
      />
    </div>
  );
}

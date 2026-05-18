import { useCallback, useEffect, Suspense, lazy, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Routes, Route, Navigate, useParams, useLocation, useNavigate } from 'react-router-dom';
import MonoLanding from './MonoLanding';
import { getSportById } from '../../models/sportRegistry';
import { useAuth } from '../../hooks/useAuth';
import AppLoading from '../../components/AppLoading';
import ErrorBoundary from '../../components/ErrorBoundary';
import OfflineFallback from '../../components/OfflineFallback';
import { installNativeBackButtonGuard } from '../../mobile/backButton';
import { installNativeDeepLinkHandler } from '../../mobile/deepLinks';
import CloudAuthOnly from './components/CloudAuthOnly';
import './mono.css';

// Lazy-loaded primary app routes (not needed for the initial landing view)
const MonoSportHome = lazy(() => import('./MonoSportHome'));
const MonoHistory = lazy(() => import('./MonoHistory'));
const MonoTournamentList = lazy(() => import('./MonoTournamentList'));
const MonoTournamentLiveScore = lazy(() => import('./MonoTournamentLiveScore'));

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
  return <AppLoading compact />;
}

function NotFoundRoute() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen px-6 py-10 mono-transition mono-visible">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#888' }}>
          Page not found
        </p>
        <h1 className="text-2xl font-bold font-mono mb-3" style={{ color: '#111' }}>
          This screen is not available
        </h1>
        <p className="text-sm mb-6" style={{ color: '#666' }}>
          The link may be old, incomplete, or not part of the mobile app flow yet.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="mono-btn-primary flex-1"
            style={{ padding: '12px', fontSize: '0.875rem' }}
            onClick={() => navigate('/play')}
          >
            Play
          </button>
          <button
            type="button"
            className="mono-btn flex-1"
            style={{ padding: '12px', fontSize: '0.875rem' }}
            onClick={() => navigate('/')}
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}

// Redirects authenticated users who haven't completed onboarding
const GUARD_BYPASS_PREFIXES = ['/onboarding', '/login', '/signup', '/sso-callback', '/showcase'];
const SCORING_EXIT_TITLE = 'Leave this page?';
const SCORING_EXIT_MESSAGE = 'Your unsaved scoring progress may be lost.';
const SCORING_EXIT_CONFIRMATION = `${SCORING_EXIT_TITLE} ${SCORING_EXIT_MESSAGE}`;
const NO_PRIOR_ROUTE_INDEX = -1;

function isProtectedScoringPath(pathname = '') {
  const segments = pathname.split('/').filter(Boolean);
  return segments.includes('game') ||
    segments.includes('quick') ||
    segments.some((segment, index) => (
      segment === 'tournament' &&
      segments[index + 2] === 'match' &&
      segments[index + 4] === 'score'
    ));
}

function OnboardingGuard({ children }) {
  const { needsOnboarding, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <LazyFallback />;
  const bypassed = GUARD_BYPASS_PREFIXES.some((p) => location.pathname.startsWith(p));
  const isScoring = isProtectedScoringPath(location.pathname);
  if (needsOnboarding && !bypassed && !isScoring) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/onboarding?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return children;
}

OnboardingGuard.propTypes = {
  children: PropTypes.node,
};

function AppConfirmDialog({ prompt, onCancel, onConfirm }) {
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!prompt) return undefined;

    cancelButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
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
      />
      <section
        className="app-confirm-dialog"
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
            className="app-confirm-primary"
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
  }),
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

function GlobalNavigation({ requestScoringExit }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { cloudAuthAvailable, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const mobileMenuRef = useRef(null);
  const pathname = location.pathname;
  const showBottomNav = !isProtectedScoringPath(pathname);

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

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Play', path: '/play' },
    { label: 'History', path: '/history' },
    { label: 'Statistics', path: '/statistics' },
  ];

  if (cloudAuthAvailable) {
    navItems.push({
      label: isAuthenticated ? 'Profile' : 'Sign in',
      path: isAuthenticated ? '/profile' : '/login',
    });
  }

  const bottomNavItems = [
    { label: 'Play', path: '/play' },
    { label: 'History', path: '/history' },
    { label: 'Stats', path: '/statistics' },
    cloudAuthAvailable
      ? { label: isAuthenticated ? 'Profile' : 'Sign in', path: isAuthenticated ? '/profile' : '/login' }
      : null,
  ].filter(Boolean);

  const isActive = (item) => {
    if (item.path === '/') return pathname === '/';
    if (item.path === '/play') {
      return pathname === '/play' ||
        /^\/[^/]+\/(quick|tournament)(\/|$)/.test(pathname);
    }
    if (item.path === '/login') {
      return pathname.startsWith('/login') ||
        pathname.startsWith('/signup') ||
        pathname.startsWith('/onboarding');
    }
    if (item.path === '/profile') {
      return pathname.startsWith('/profile') ||
        pathname.startsWith('/users/search') ||
        pathname.startsWith('/onboarding');
    }
    return pathname === item.path || pathname.startsWith(`${item.path}/`);
  };

  const currentItem = navItems.find(isActive);

  return (
    <>
      <header className="global-nav">
        <button type="button" className="global-nav-brand" onClick={() => go('/')}>
          SCORE<br />EASY
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
            </nav>
          </div>
        </dialog>
      )}
      {showBottomNav && bottomNavItems.length > 0 && (
        <nav
          className="global-bottom-nav"
          aria-label="App navigation"
          style={{ '--bottom-nav-count': bottomNavItems.length }}
        >
          {bottomNavItems.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => go(item.path)}
              className="global-bottom-nav-item"
              aria-current={isActive(item) ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
      <style>{`
        .global-nav {
          position: sticky;
          top: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 56px;
          padding: 0 32px;
          border-bottom: 1.5px solid #111;
          background: #fafafa;
        }

        .global-nav-brand {
          border: 0;
          background: transparent;
          color: #111;
          cursor: pointer;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
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
          border: 1.5px solid transparent;
          background: transparent;
          color: #555;
          cursor: pointer;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          padding: 9px 12px;
          text-transform: uppercase;
        }

        .global-nav-link:hover,
        .global-nav-link[aria-current="page"] {
          border-color: #111;
          color: #111;
        }

        .global-mobile-menu-button,
        .global-mobile-menu-backdrop,
        .global-mobile-menu-sheet,
        .global-mobile-menu-content,
        .global-bottom-nav {
          display: none;
        }

        .app-confirm-backdrop {
          position: fixed;
          inset: 0;
          z-index: 260;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(17, 17, 17, 0.58);
          padding: 20px;
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
          width: min(440px, 100%);
          border: 1.5px solid #111;
          background: #fff;
          color: #111;
          box-shadow: 6px 6px 0 #111;
          padding: 24px;
        }

        .app-confirm-eyebrow {
          color: #0066ff;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
          font-size: 0.6875rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          margin: 0 0 10px;
          text-transform: uppercase;
        }

        .app-confirm-title {
          color: #111;
          font-size: 1.25rem;
          font-weight: 800;
          line-height: 1.2;
          margin: 0 0 10px;
        }

        .app-confirm-message {
          color: #555;
          font-size: 0.9375rem;
          line-height: 1.5;
          margin: 0 0 24px;
        }

        .app-confirm-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .app-confirm-primary,
        .app-confirm-secondary {
          min-height: 44px;
          border: 1.5px solid #111;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 700;
          padding: 10px 16px;
        }

        .app-confirm-primary {
          background: #0066ff;
          color: #fff;
        }

        .app-confirm-secondary {
          background: #fff;
          color: #111;
        }

        @media (max-width: 767px) {
          body.has-mobile-bottom-nav {
            padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
          }

          .global-nav {
            min-height: 56px;
            padding: env(safe-area-inset-top, 0px) 16px 0;
          }

          .global-nav-links {
            display: none;
          }

          .global-mobile-menu-button {
            display: inline-flex;
            width: 44px;
            height: 44px;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 5px;
            border: 1.5px solid #111;
            background: #fafafa;
            cursor: pointer;
            box-shadow: 3px 3px 0 #111;
          }

          .global-mobile-menu-button span {
            display: block;
            width: 18px;
            height: 2px;
            background: #111;
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
            background: rgba(17, 17, 17, 0.38);
            cursor: pointer;
          }

          .global-mobile-menu-content {
            position: absolute;
            right: 12px;
            bottom: calc(12px + env(safe-area-inset-bottom, 0px));
            left: 12px;
            display: block;
            border: 1.5px solid #111;
            background: #fff;
            color: #111;
            box-shadow: 4px 4px 0 #111;
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
            border-bottom: 1.5px solid #111;
            color: #555;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
            font-size: 0.75rem;
            font-weight: 800;
            letter-spacing: 0.06em;
            padding: 0 16px;
            text-transform: uppercase;
          }

          .global-mobile-menu-close {
            min-height: 36px;
            border: 1.5px solid #111;
            background: #fafafa;
            color: #111;
            cursor: pointer;
            font: inherit;
            padding: 0 10px;
            text-transform: uppercase;
          }

          .global-mobile-menu-panel {
            display: flex;
            flex-direction: column;
            background: #fff;
          }

          .global-mobile-menu-item {
            border: 0;
            border-bottom: 1px solid #eee;
            background: transparent;
            color: #111;
            cursor: pointer;
            font-family: inherit;
            font-size: 0.875rem;
            font-weight: 700;
            min-height: 48px;
            padding: 14px 16px;
            text-align: left;
          }

          .global-mobile-menu-item[aria-current="page"] {
            background: #f0f6ff;
            color: #0066ff;
          }

          .global-mobile-menu-item:last-child {
            border-bottom: 0;
          }

          .global-bottom-nav {
            position: fixed;
            right: 0;
            bottom: 0;
            left: 0;
            z-index: 210;
            display: grid;
            grid-template-columns: repeat(var(--bottom-nav-count), minmax(0, 1fr));
            gap: 0;
            border-top: 1.5px solid #111;
            background: #fafafa;
            padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px));
            box-shadow: 0 -3px 0 rgba(17, 17, 17, 0.08);
          }

          .global-bottom-nav-item {
            min-height: 52px;
            border: 1.5px solid transparent;
            background: transparent;
            color: #555;
            cursor: pointer;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
            font-size: 0.6875rem;
            font-weight: 800;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }

          .global-bottom-nav-item[aria-current="page"] {
            border-color: #111;
            background: #fff;
            color: #111;
            box-shadow: 2px 2px 0 #111;
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
  const [exitPrompt, setExitPrompt] = useState(null);
  const exitPromptRef = useRef(null);
  const allowNextProtectedPopRef = useRef(false);
  const protectedRouteHistoryIndexRef = useRef(null);
  const protectedGuardDepthRef = useRef(0);
  const protectedGuardRouteKeyRef = useRef(null);

  const requestScoringExit = useCallback((options = {}) => {
    exitPromptRef.current?.onCancel?.();

    const nextPrompt = {
      title: SCORING_EXIT_TITLE,
      message: SCORING_EXIT_MESSAGE,
      confirmLabel: 'Leave page',
      cancelLabel: 'Stay here',
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

  const confirmNativeDeepLinkNavigation = useCallback((targetPath) => {
    if (!isProtectedScoringPath(location.pathname)) return Promise.resolve(true);
    if (targetPath === `${location.pathname}${location.search}${location.hash || ''}`) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      requestScoringExit({
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, [location.hash, location.pathname, location.search, requestScoringExit]);

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

    const handlePopState = () => {
      if (allowNextProtectedPopRef.current) {
        allowNextProtectedPopRef.current = false;
        return;
      }

      globalThis.history.pushState({ ...globalThis.history.state, gameProtection: true }, '');
      requestScoringExit({
        onConfirm: () => {
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
            navigate('/play', { replace: true });
          };

          globalThis.addEventListener('popstate', replaceScoringEntryOnPop, { once: true });
          globalThis.history.back();
          fallbackTimeoutId = globalThis.setTimeout(() => {
            clearPendingFallbackNavigation();
            if (isProtectedScoringPath(globalThis.location.pathname)) {
              navigate('/play', { replace: true });
            }
          }, 300);
        },
      });
    };

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    globalThis.addEventListener('popstate', handlePopState);
    globalThis.addEventListener('beforeunload', handleBeforeUnload);
    const cleanupNativeBackButton = installNativeBackButtonGuard({
      getPathname: () => globalThis.location.pathname,
      confirmLeave: () => new Promise((resolve) => {
        requestScoringExit({
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false),
        });
      }),
    });

    return () => {
      globalThis.removeEventListener('popstate', handlePopState);
      globalThis.removeEventListener('beforeunload', handleBeforeUnload);
      clearPendingFallbackNavigation();
      cleanupNativeBackButton();
    };
  }, [location.pathname, location.search, navigate, requestScoringExit]);

  return (
    <div className="min-h-screen font-swiss" style={{ background: '#fafafa', color: '#111' }}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <GlobalNavigation requestScoringExit={requestScoringExit} />
      <OfflineFallback />
      <main id="main-content">
        <Suspense fallback={<LazyFallback />}>
          <ErrorBoundary title="App route crashed" message="The route tree failed to render.">
            <OnboardingGuard>
              <Routes>
                <Route path="" element={<MonoLanding />} />

                <Route path="login/*" element={<CloudAuthOnly><MonoLogin /></CloudAuthOnly>} />
                <Route path="signup/*" element={<CloudAuthOnly><MonoSignUp /></CloudAuthOnly>} />
                <Route path="sso-callback" element={<CloudAuthOnly><SSOCallback /></CloudAuthOnly>} />
                <Route path="onboarding" element={<CloudAuthOnly><MonoOnboarding /></CloudAuthOnly>} />

                <Route path="profile" element={<CloudAuthOnly><ErrorBoundary title="Profile unavailable" message="We could not load this profile. Try again or return home."><MonoProfile /></ErrorBoundary></CloudAuthOnly>} />
                <Route path="profile/:username" element={<CloudAuthOnly><ErrorBoundary title="Profile unavailable" message="We could not load this profile. Try again or return home."><MonoProfile /></ErrorBoundary></CloudAuthOnly>} />
                <Route path="users/search" element={<CloudAuthOnly><MonoUserSearch /></CloudAuthOnly>} />

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

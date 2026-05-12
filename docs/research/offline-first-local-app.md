# Offline-First Local App Research

Date: 2026-05-12
Branch: feat/offline-first-local-app

## Current Setup

- Capacitor packages the Vite build from `dist`; the mobile shell is already local-bundle based.
- App startup currently requires `VITE_CLERK_PUBLISHABLE_KEY` and constructs Clerk plus Convex providers before rendering routes.
- Existing match and tournament flows already use local storage for quick matches, sport tournaments, history, statistics, and preferences.
- Convex is used as the cloud/authenticated enhancement for users, team search, player search, match sync, profiles, onboarding, and public user search.

## Constraint

The app should always open and support local scoring without internet. Clerk and Convex should enhance the app when internet/auth are available, not block the local experience.

## Recommended MVP

1. Split auth state into an app-owned auth context.
2. Use cloud auth only when Clerk and Convex config exist and the app starts online.
3. Use a local auth provider when config is missing or the app starts offline.
4. Keep a Convex provider present with a harmless placeholder URL in local mode so Convex hooks do not crash before they are skipped.
5. Make auth UI wrappers render local/offline-safe controls when cloud auth is unavailable.
6. Skip cloud search/sync hooks from user-facing behavior when unauthenticated/local-only; local match and tournament storage remains the source of truth.

## Security Notes

- Local-only mode must not fake an authenticated user.
- Convex writes continue to require real Clerk auth and backend authorization.
- Offline data is local-device data; do not treat it as shared or verified until sync succeeds.

## TDD Scenarios

- Auth bootstrap chooses local mode when Clerk or Convex config is missing.
- Auth bootstrap chooses local mode when the app starts offline.
- Auth bootstrap chooses cloud mode when config is present and the app is online.
- Local auth provider reports unauthenticated, not loading, cloud unavailable.
- Auth buttons do not call Clerk UI when cloud auth is unavailable.

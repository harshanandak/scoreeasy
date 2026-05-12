# Offline-First Local App Tasks

## Task 1: Auth Bootstrap Unit Coverage

TDD:
- Add tests for choosing local mode when Clerk config is missing.
- Add tests for choosing local mode when Convex config is missing.
- Add tests for choosing local mode when offline at startup.
- Add tests for choosing cloud mode when config exists and online.

Implementation:
- Add a small pure bootstrap helper used by `main.jsx`.

## Task 2: Local Auth Provider

TDD:
- Add tests proving local auth reports unauthenticated, not loading, user-ready, and cloud unavailable.

Implementation:
- Move current Convex/Clerk user bootstrap logic into `CloudAuthProvider`.
- Add `LocalAuthProvider`.
- Change `useAuth` to read the app-owned auth context.

## Task 3: Root Provider Selection

TDD:
- Covered by bootstrap helper tests.

Implementation:
- Update `main.jsx` to choose local or cloud provider mode.
- Stop throwing on missing Clerk config.
- Keep Convex hooks safe in local mode.

## Task 4: Auth UI Local Fallbacks

TDD:
- Add tests that auth wrappers avoid cloud-only Clerk UI in local-only mode.

Implementation:
- Update auth wrapper components to avoid invoking Clerk UI when cloud auth is unavailable.
- Add login/signup/SSO route fallbacks for local-only mode.

## Task 5: Validate And Ship

Validation:
- Run unit tests.
- Run lint.
- Run type check.
- Run production build.
- Create PR with plan links and validation evidence.

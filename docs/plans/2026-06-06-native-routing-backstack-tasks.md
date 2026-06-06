# Native Routing Back-Stack Tasks

## Task 1 - Native Back Fallbacks

- Add failing tests for protected quick and tournament native back behavior.
- Export a route fallback helper from `src/mobile/backButton.js`.
- Prefer the route-aware fallback after protected-route confirmation.
- Preserve normal native history/exit behavior for unprotected routes.

## Task 2 - Native App-Link Canonicalization

- Add failing tests for legacy `/stats` and `/dashboard` app links.
- Canonicalize those paths before calling React Router navigation.
- Keep unsupported hosts and schemes rejected.

## Task 3 - App Integration

- Add an integration test for the React route tree passing a native fallback navigator.
- Wire `installNativeBackButtonGuard` to React Router `navigate`.
- Keep the existing browser popstate guard behavior intact.

## Task 4 - Cold Start Shell

- Add static first-paint shell UI to `index.html#root`.
- Keep the shell self-contained so React replaces it on mount.

## Task 5 - Validation And Ship

- Run focused native routing tests.
- Run route recovery regression tests.
- Run full repo validation gates.
- Update Beads, push branch, open PR, and review checks/comments.

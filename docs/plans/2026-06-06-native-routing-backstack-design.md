# Native Routing Back-Stack Stabilization

Date: 2026-06-06
Status: Implemented

## Purpose

Make Android/WebView navigation predictable from protected scoring routes and native app links. The audit found that direct quick-match entries, resumed scorers, and legacy deep links could rely on raw browser history, which is not a reliable app back-stack contract in Capacitor.

## Scope

- `scoreeasy-9g4.4`: Quick Match direct-entry back fallback.
- `scoreeasy-9g4.8`: Resume/scorer trap escape to a fresh sport setup surface.
- `scoreeasy-9g4.9`: Native handling for existing route aliases.
- `scoreeasy-rdk.6`: Visible cold-start shell before React route rendering.

## Success Criteria

- Android native back from quick scorers asks for confirmation, then returns to `/play?sport=<sport>` instead of raw browser history or app exit.
- Android native back from tournament match scorers asks for confirmation, then returns to the tournament dashboard when the route contains a tournament id.
- Native app links for legacy `/stats` and `/dashboard` resolve to canonical routes before navigation.
- A cold native WebView load has visible app shell UI in `index.html` before React lazy routes mount.
- Existing route-recovery tests for `/stats`, `/signin`, sport query params, and tennis live aliases remain green.

## Out Of Scope

- Reworking the full app information architecture.
- Redesigning the dashboard, bottom navigation, or scorer layout.
- Changing persistent draft, history, or statistics data contracts.
- Changing public web route aliases; this PR keeps backwards-compatible aliases intact.

## Approach

Use route-aware fallbacks in the existing Capacitor back-button module rather than adding page-specific Android handlers. The app already owns the protected-route confirmation UI in `index.jsx`; this PR gives the native handler a safe destination after that confirmation.

For app links, canonicalize known legacy app paths in `src/mobile/deepLinks.js` before passing them into React Router. Public route aliases remain available for normal web navigation.

For the cold Statistics blank interval, add a minimal static boot shell inside `index.html#root`. React replaces it on mount, but native users see immediate app UI while the bundle and lazy route load.

## Edge Cases

- Protected route, user cancels: stay on scorer and do not navigate.
- Protected quick route, no browser history: navigate to sport-filtered Play chooser.
- Protected tournament scorer, route includes tournament id: navigate to that tournament dashboard.
- Protected tournament scorer, malformed route: fallback to the sport tournament list.
- Unprotected route: preserve existing native history/back/exit behavior.
- Unsupported app-link host or scheme: ignore or report through existing `onUnhandled`.

## Ambiguity Policy

Proceed only when the change stays inside the native navigation/linking contract and does not alter scoring or persistence data. If a fix requires data model changes, auth behavior changes, or a full navigation redesign, split it into a later Beads issue and PR.

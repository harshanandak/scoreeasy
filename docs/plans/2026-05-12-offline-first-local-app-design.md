# Offline-First Local App Design

## Feature

- Slug: offline-first-local-app
- Date: 2026-05-12
- Status: planned

## Purpose

Make Score Easy local-first across web, Android, and iOS. The app should open and support scoring from the packaged application even without internet, while Clerk and Convex continue to provide login, profiles, search, backup, and sync when available.

## Success Criteria

- App startup does not throw when Clerk or Convex env values are missing.
- App startup uses local-only mode when the device starts offline.
- Guest/local scoring routes can render without requiring Clerk readiness.
- Local mode never claims the user is authenticated.
- Existing cloud auth and Convex sync behavior remains available when config is present and online.
- Unit tests cover auth bootstrap and local auth behavior.

## Out Of Scope

- Full conflict resolution for offline edits across devices.
- Background sync queue UI.
- New Convex schema or backend mutations.
- Native SQLite migration.
- App Store or Play Store release changes.

## Approach Selected

Use an app-owned auth context with two providers:

- `CloudAuthProvider`: current Clerk plus Convex user bootstrap behavior.
- `LocalAuthProvider`: unauthenticated, non-loading local mode used when cloud auth cannot be safely started.

The root `main.jsx` chooses a bootstrap mode. It still wraps local mode in a Convex provider with a placeholder URL so existing Convex hooks can be mounted safely, but auth state keeps cloud queries skipped and cloud mutations inactive.

## Constraints

- Do not weaken Convex backend authentication.
- Do not remove current Clerk/Convex flows for online signed-in users.
- Keep changes small enough for a fast PR.
- Keep local data in the existing storage utilities for this MVP.

## Edge Cases

- Missing Clerk key: local mode.
- Missing Convex URL: local mode.
- Device starts offline: local mode.
- User opens login/signup while local-only: show an offline/cloud-unavailable fallback instead of rendering Clerk widgets.
- Signed-out quick match: local save remains the completion path; sync state stays idle/local.

## Technical Research

See `docs/research/offline-first-local-app.md`.

## Ambiguity Policy

Use the 7-dimension decision rubric from `/dev`. Proceed without asking only when confidence is at least 80% and the decision does not change backend auth, schema, or shared public contracts.

# Home account entry

Decisions needed: none. Visual acceptance is pending because the required T3 renderer is unavailable.

The fifth cloud-enabled app dock tab is labelled **Profile** for guests and signed-in scorers. Guests open the existing Profile route, where a Kit card offers **Sign in** with `/login?returnTo=%2Fprofile`, or **Keep scoring as a guest** with `/play`. Home no longer renders a second guest sign-in control. Signed-in Home retains its account avatar; the signed-in dock retains its existing Clerk account control and loading fallback.

The guest card describes profile sync and player discovery, which are supported by the existing profile, user-search and cloud-user code. It makes no promise to back up local guest matches.

## Acceptance evidence

- Automated (rung 4): updated dock labels and guest Profile routing; Profile card content, single Sign in action, login return target and guest continuation; existing signed-in profile data and Home avatar routing checks.
- Automated (rung 4): a real-component Home → Profile → login route test covers the shell and both account surfaces together.
- Rendered (rung 5): **pending**. No screenshots or rendered measurements are claimed.

## Required capture matrix

Capture Home signed out before and after, Profile signed out after, and Home signed in at 390×844 and 360×640, plus one dark set. Save PNGs here, check their dimensions, run `bun run evidence:compress docs/plans/2026-10-23-home-single-sign-in`, then `bun run evidence:check origin/master`.

The untracked `.home-evidence/` harness uses a Vite library build of the real app shell, Home and Profile with mocked auth/Convex and inlined fonts, CSS and gzipped JavaScript. Both baseline and changed bundles build successfully. Baseline components come from `git show origin/master:<path>`.

T3 `html_preview` failed twice on the inlined app and once on a minimal static document with:

> Headless Chrome could not render the page: the page did not finish loading within 20 seconds.

Removing the external font import did not resolve it. No alternate browser was used. The PR stays draft until the required captures and rendered checks are complete.

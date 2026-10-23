# Home account entry

Decisions needed: none.

The fifth cloud-enabled app dock tab is labelled **Profile** for guests and signed-in scorers. Guests open the existing Profile route, where a Kit card offers **Sign in** with `/login?returnTo=%2Fprofile`, or **Keep scoring as a guest** with `/play`. Home no longer renders a second guest sign-in control. Signed-in Home retains its account avatar; the signed-in dock retains its existing Clerk account control and loading fallback.

The guest card describes profile sync and player discovery, which are supported by the existing profile, user-search and cloud-user code. It makes no promise to back up local guest matches.

## Acceptance evidence

- Automated (rung 4): updated dock labels and guest Profile routing; Profile card content, single Sign in action, login return target and guest continuation; existing signed-in profile data and Home avatar routing checks.
- Automated (rung 4): a real-component Home → Profile → login route test covers the shell and both account surfaces together.
- Rendered (rung 5), captured in the T3 integrated browser from the `.home-evidence/` harness (real shell, Home and Profile; mocked auth/Convex):
  - Before, Home signed out: two sign-in controls (header + dock) — [before-home-signed-out-375.png](before-home-signed-out-375.png)
  - After, Home signed out: no header Sign in; dock tab reads Profile — [after-home-signed-out-390.png](after-home-signed-out-390.png)
  - After, Profile signed out: one Sign in plus Keep scoring as a guest; Profile highlighted in the dock — [after-profile-signed-out-375.png](after-profile-signed-out-375.png)
  - Harness measurements: no horizontal overflow; dock items 54px tall; Sign in 52px, guest button 48px.
  - Not captured: 360×640, dark, and signed-in Home (signed-in is unchanged by this PR and covered by the routing tests).

## Harness

The untracked `.home-evidence/` harness uses a Vite library build of the real app shell, Home and Profile with mocked auth/Convex and inlined fonts, CSS and gzipped JavaScript. Both baseline and changed bundles build successfully. Baseline components come from `git show origin/master:<path>`.


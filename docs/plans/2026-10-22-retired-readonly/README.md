# Retired matches remain readable

Decisions needed: none.

Retirement left unfinished saved matches unreachable and sent signed-out devices with only retired tournaments to marketing. This change reuses History's match-details panel for the archive, including unfinished quick drafts and tournament progress. It does not restore a retired scorer.

Scope: the stranded-save issue (`8fabb959-95a3-4313-b3bb-9f2a3f58c925`) and retired-only entry issue (`96b7e01c-3167-43f5-814d-6681a402580b`). Base: master (`cdae97d`).

## Acceptance checklist

- [x] History has an **Unfinished, retired sport** group. Old quick drafts remain readable beyond the active scorer's draft expiry.
- [x] Pickleball, squash, rugby, futsal and handball tournament saves are readable, including progress stored inside `draftState`.
- [x] The existing details panel shows the saved score, sets or recorded period, serving team when saved, and saved score history. Goals action history stays an action list; it is not converted into invented score snapshots.
- [x] The view says **This sport is retired; scoring is off**. It has no scoring, Resume, Rematch, Undo or Delete controls.
- [x] Retired sport links offer **View saved match** when the requested save exists. Match links select that match; links covering several saves filter History to the sport. Empty links retain their recovery actions.
- [x] Returning-player detection includes retired tournament storage and retired drafts. Retired saves never become resumable destinations.
- [x] Reading retired tournaments bypasses the format-migrating loader. Viewing, closing and refreshing the seeded draft leaves its stored bytes unchanged.
- [x] Shared quick-match normalization preserves retired records, including expired drafts. Clearing active History or Stats retains retired records; Stats does not offer their Delete action.
- [x] Completed retired saves remain visible. Existing retirement and expected-failure tests are unchanged.
- [x] Palette test and baseline remain unchanged at **669**; new UI uses existing tokens.
- [x] Four **390×844** screenshots were captured from the running local app and individually inspected.
- [ ] Full suite and production build: deliberately deferred until **lane free**, then run by the normal pre-push hook.
- [ ] Push and PR: deliberately held. No hosted checks exist for this branch yet.

Section A of `../2026-07-20-icp-games/adjusted-plan.md` already promises saved matches stay readable without restricting that promise to completed matches. Its promise is unchanged.

## Evidence

Rung 4: the first regression run failed **8 new cases** while **24 existing route cases passed**. Further failing cases exposed shared-store deletion, single-set score selection and nested tournament draft state before those fixes were made.

Focused validation covers these ten files: `RetiredSavedMatches.test.jsx`, `MonoHistory.test.jsx`, `AppRouteRecovery.test.jsx`, `appEntry.test.js`, `storage.test.js`, `storage.stability.test.js`, `MonoStatistics.test.jsx`, `palette.test.js`, `sportRegistry.test.js` and `routes.contract.test.jsx`.

The focused run passed **261 tests with 7 expected failures (268 total), 10 files**. These are focused counts, not full-suite counts. Lint passed with **0 errors and 29 warnings**; type-check passed. Commit hooks run lint, type-check and agent-config sync without bypasses.

Rung 5: `capture-demo.cjs` used fresh browser contexts against `bun run dev` on port **5178** because 5173 was occupied. It verified the 10–7 pickleball draft, no retired-storage writes, refresh retention, no scoring controls, and signed-out retired-only `/` → `/app` without a Resume action. Fixtures are synthetic local data. No secret files or production services are involved.

T3 Preview twice returned `Preview automation snapshot timed out after 15000ms.` The alternate browser bridge also timed out, so capture used headless Chrome with Playwright installed in a temporary tools directory outside the app dependencies.

| Screenshot | Evidence |
|---|---|
| [Retired deep link](retired-deep-link.png) | Recovery offers View saved match and keeps the sport chooser and Home escape. |
| [Pickleball read-only details](retired-pickleball-readonly.png) | Saved 10–7, Set 1, serving team, retired warning, history and Close. |
| [Unfinished History group](unfinished-retired-history.png) | The draft is discoverable in History without Resume or Delete. |
| [Retired-only device at Home](retired-only-device-home.png) | Guest mode inside the app after opening `/`, with History in the navigation. |

## Reproduce the demo

Start `bun run dev -- --host 127.0.0.1 --port 5178 --strictPort`. Run `capture-demo.cjs` with `SCOREEASY_PLAYWRIGHT` pointing at an installed Playwright module and `SCOREEASY_BROWSER` pointing at Chrome. `SCOREEASY_DEMO_URL` can override the local origin. The script creates isolated browser contexts, seeds only synthetic local saves, checks behavior and storage, and writes the four screenshots beside this file.

After the lane release: fetch and merge `origin/master`, rerun focused checks, push normally so the full-suite/build hook runs, and open the PR against master. Do not merge or watch it.

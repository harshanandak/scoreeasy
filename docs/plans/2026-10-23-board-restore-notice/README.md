# Restore notice evidence

Decisions needed: none.

The existing restore notice now occupies a normal-flow status slot immediately after the shared header. This keeps the title, rules, score keys and Undo visible together. A bottom overlay would compete with Undo; replacing the last-action line would hide useful scoring context and conflict with its separate follow-up. The text and 3300ms timeout are unchanged. There was no manual dismiss control on this notice. Its role remains status, with explicit polite and atomic announcement. No entrance/exit animation means reduced motion needs no special transform.

## Rendered evidence (rung 5, mocked services)

Only T3 html_preview was used, with the real MonoQuickMatch and board components inlined as one Vite IIFE. Auth and Convex are mocked; no live services were written. Before modules and the original notice CSS come from origin/master (0d7d7704c53fb4e2c5f38f5b4281a7db22ecfac9). The before animation is paused at its fully visible 1000ms frame; its text is never hidden. The untracked .notice harness is excluded from the commit. PNG crops preserve each exact phone viewport.

All 28 PNGs have verified dimensions. Every after capture has zero notice/header overlap, zero covered buttons, zero off-screen buttons, zero targets below 48px, zero contrastReport failures and zero document overflow. Notice contrast is 18.03:1 light and 17.57:1 dark. Sets and goals keep the notice on one line; cricket wraps naturally to two.

| Board | Width: document height / Undo bottom | After light screenshots |
|---|---|---|
| volleyball | 360: 640px / 622px; 390: 844px / 826px | [after-volleyball-360-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-volleyball-360-light.png?raw=true) · [after-volleyball-390-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-volleyball-390-light.png?raw=true) |
| badminton | 360: 640px / 622px; 390: 844px / 826px | [after-badminton-360-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-badminton-360-light.png?raw=true) · [after-badminton-390-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-badminton-390-light.png?raw=true) |
| tabletennis | 360: 640px / 622px; 390: 844px / 826px | [after-tabletennis-360-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-tabletennis-360-light.png?raw=true) · [after-tabletennis-390-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-tabletennis-390-light.png?raw=true) |
| football | 360: 640px / 626px; 390: 844px / 826px | [after-football-360-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-football-360-light.png?raw=true) · [after-football-390-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-football-390-light.png?raw=true) |
| basketball | 360: 640px / 626px; 390: 844px / 826px | [after-basketball-360-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-basketball-360-light.png?raw=true) · [after-basketball-390-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-basketball-390-light.png?raw=true) |
| kabaddi | 360: 640px / 626px; 390: 844px / 826px | [after-kabaddi-360-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-kabaddi-360-light.png?raw=true) · [after-kabaddi-390-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-kabaddi-390-light.png?raw=true) |
| hockey | 360: 640px / 626px; 390: 844px / 826px | [after-hockey-360-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-hockey-360-light.png?raw=true) · [after-hockey-390-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-hockey-390-light.png?raw=true) |
| cricket | 360: 640px / 630px; 390: 844px / 834px | [after-cricket-360-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-cricket-360-light.png?raw=true) · [after-cricket-390-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-cricket-390-light.png?raw=true) |

Dark: [after-volleyball-360-dark.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-volleyball-360-dark.png?raw=true), [after-cricket-360-dark.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/after-cricket-360-dark.png?raw=true). Raw measured rectangles and all screenshot names: [measurements.json](./measurements.json).

### Before

Every before capture reproduces the header overlap. At 360px on sets and goals boards it also intersects Finish.

- [before-volleyball-360-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/before-volleyball-360-light.png?raw=true)
- [before-badminton-360-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/before-badminton-360-light.png?raw=true)
- [before-volleyball-390-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/before-volleyball-390-light.png?raw=true)
- [before-badminton-390-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/before-badminton-390-light.png?raw=true)
- [before-football-360-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/before-football-360-light.png?raw=true)
- [before-cricket-360-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/before-cricket-360-light.png?raw=true)
- [before-football-390-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/before-football-390-light.png?raw=true)
- [before-cricket-390-light.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/before-cricket-390-light.png?raw=true)
- [before-volleyball-360-dark.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/before-volleyball-360-dark.png?raw=true)
- [before-cricket-360-dark.png](https://github.com/harshanandak/scoreeasy/blob/fix/restore-notice/docs/plans/2026-10-23-board-restore-notice/before-cricket-360-dark.png?raw=true)

## Acceptance checklist

- [x] Keys and labels: contrastReport passes for the purple/yellow pair with the sport marks, in every capture; the existing team-colour suite covers setup and persistence.
- [x] Undo: always visible in the measured thumb bar, 60px high on sets/goals and 56px on cricket; score → Undo is exercised for all eight consumers in the regression suite.
- [x] Restore notice states: restored notice visible below header; scoring and Undo usable; Finish opens its existing confirm; present at 3299ms and dismissed at 3300ms (rung 4 tests).
- [x] 360×640: document height 640px with every scoring control and Undo on screen, across all eight consumers. 390×844 also fits exactly.
- [x] Light and dark: captures above, using the existing theme tokens.
- [x] Touch targets: all visible buttons measure at least 48×48px. Refresh preserves score, Undo history and picked colours (rung 4 integration test).
- [x] Team colours: screenshots restore the same picked purple/yellow pair; existing setup-to-board tests remain part of validation.
- [x] Copy, trigger and lifetime unchanged. Screen reader semantics checked in tests; actual screen-reader speech is not claimed.

## Consumer audit

ScoringNotice has five call sites in MonoQuickMatch: cricket; the goals board; the legacy goals layout; the sets board; the legacy sets layout. Both modern boards place their existing notice prop after BoardHeader. The shared CSS also puts the legacy layouts' notice in normal flow. Current team-colour consumers are volleyball, badminton, table tennis, football, basketball, kabaddi, hockey and cricket. Tennis's dedicated MonoTennisLiveScore does not render ScoringNotice or this restore copy; its quick setup hands off to that scorer. AppScoringNotice is a separate component and is unaffected.

## Follow-ups

The existing clock follow-up (49c8111d-40e3-4aec-bab4-13c437d491d9) remains out of scope. No new product bug was found in the final captures.

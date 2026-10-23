# Hockey scoring board demo

Decisions needed: none.

Hockey quick matches previously used the classic neutral arena, without the picked team colours or the shared bottom Undo restore hint. Hockey now uses the same team-colour goals board as football: tap either whole key for one goal, correct from Match options, and Undo from the bottom bar.

The only product-code change is hockey's own teamColour registry flag. TeamGoalsBoard, BoardShell, scoring handlers, the clock, draft persistence, live outbox, and spectator/tournament components are unchanged.

## Acceptance evidence

All browser evidence is rung 5 for the real React scorer running in the specified T3 html_preview harness with local auth/Convex fixtures, not a production backend. The harness inlines a Vite IIFE and app fonts, freezes browser intervals, and advances the existing timer callback manually. Before uses MonoQuickMatch and the registry from origin/master (62f4fa7). PNG dimensions were decoded and checked with sharp.

| Item | Evidence |
| --- | --- |
| Team-colour keys and labels pass contrastReport, including motif-overlaid surfaces and the hockey identity | Hockey tests cover black/yellow, green/blue, white/white; rendered black/yellow minimum ratio divided by its required threshold is 1.0751. The stick-and-ball mask is asserted as hockey's exact sportMarkMaskUrl and appears only on the clock chip. |
| Undo visible, thumb reachable, with restore state | 360×640: y=566, h=60, bottom=626. 390×844: see measurements.json. Goal shows back to 3–2; correction shows back to 3–2; Undo restores the prior score. |
| Every named state and transition, including reverse paths | Both sizes: early countdown 9:48 → 9:47, goal 3–2 → 4–2 with bump and last-action line, correction 3–2 → 2–2, goal Undo, time-up → Finish, win and draw results, saved draft restoration. The walk capture checks both teams' goals + Undo, swap, correction + Undo, and Finish cancellation. Unit tests additionally exercise time-up Undo, expired refresh, and points-target completion. |
| Scoring zone fits 360×640 | Rendered document and board are exactly 360×640, with no scrolling; 390×844 also fits. Board, Undo and all visible controls measured in each scoring capture. |
| Light and dark | Early, goal, win and draw captured at both sizes in both themes; remaining states light. |
| Touch targets at least 48px; draft restore | Across hockey captures minimum target width 64px and height 48px. Restore remounts the real component from localStorage, checks score 4–2, history length 2 and both original colours, then checks restored Undo in the walk. |
| Setup colours appear on board | The setup test picks Yellow/Blue and asserts board CSS variables equal deriveTeamColours(saved colours). Draft restore separately checks picked black/yellow. |
| Reduced motion | Both sizes show animationName=none with the real bundled prefers-reduced-motion media rules activated through CSSOM; html_preview has no OS preference option. Last-action text remains available. |
| Other goals boards unchanged | Kabaddi, football and basketball before/after pairs have zero changed image channels (pixel-identical) at 360×640 light. Their existing tests are unchanged. Volleyball board regression tests pass unchanged. |

Hockey's current config allows draws. The quick engine has one total countdown and no period transitions. At zero, keys lock and the existing end prompt saves either the win or Match drawn without a winner card. No period line, half-time, overtime or shoot-out was invented; Goals/GD standings remain tournament-only.

## Screenshots

| State | 390×844 light | 360×640 light |
| --- | --- | --- |
| early | [390](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-early-390x844-light.png?raw=true) | [360](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-early-360x640-light.png?raw=true) |
| goal | [390](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-goal-390x844-light.png?raw=true) | [360](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-goal-360x640-light.png?raw=true) |
| correction | [390](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-correction-390x844-light.png?raw=true) | [360](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-correction-360x640-light.png?raw=true) |
| undo | [390](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-undo-390x844-light.png?raw=true) | [360](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-undo-360x640-light.png?raw=true) |
| timeup | [390](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-timeup-390x844-light.png?raw=true) | [360](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-timeup-360x640-light.png?raw=true) |
| win | [390](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-win-390x844-light.png?raw=true) | [360](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-win-360x640-light.png?raw=true) |
| draw | [390](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-draw-390x844-light.png?raw=true) | [360](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-draw-360x640-light.png?raw=true) |
| restore | [390](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-restore-390x844-light.png?raw=true) | [360](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-restore-360x640-light.png?raw=true) |
| walk | [390](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-walk-390x844-light.png?raw=true) | [360](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-walk-360x640-light.png?raw=true) |
| reduced | [390](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-reduced-390x844-light.png?raw=true) | [360](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-reduced-360x640-light.png?raw=true) |
| options | [390](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-options-390x844-light.png?raw=true) | [360](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-options-360x640-light.png?raw=true) |

Dark: [early 390x844](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-early-390x844-dark.png?raw=true) · [early 360x640](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-early-360x640-dark.png?raw=true) · [goal 390x844](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-goal-390x844-dark.png?raw=true) · [goal 360x640](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-goal-360x640-dark.png?raw=true) · [win 390x844](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-win-390x844-dark.png?raw=true) · [win 360x640](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-win-360x640-dark.png?raw=true) · [draw 390x844](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-draw-390x844-dark.png?raw=true) · [draw 360x640](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-hockey-draw-360x640-dark.png?raw=true).

Before: [360x640-light](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/before-hockey-early-360x640-light.png?raw=true) · [390x844-light](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/before-hockey-early-390x844-light.png?raw=true) · [390x844-dark](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/before-hockey-early-390x844-dark.png?raw=true).

Unchanged comparisons: [kabaddi before](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/before-kabaddi-early-360x640-light.png?raw=true) · [kabaddi after](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-kabaddi-early-360x640-light.png?raw=true) · [football before](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/before-football-early-360x640-light.png?raw=true) · [football after](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-football-early-360x640-light.png?raw=true) · [basketball before](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/before-basketball-early-360x640-light.png?raw=true) · [basketball after](https://github.com/harshanandak/scoreeasy/blob/feat/board-g9-hockey/docs/plans/2026-10-23-board-hockey/after-basketball-early-360x640-light.png?raw=true).

39 PNGs total. Full console measurements and PNG dimensions: [measurements.json](./measurements.json).

## Tests and scope review

- TDD: the original 15 hockey tests ran against the unmodified registry: 11 failed and 4 passed. After opt-in all passed; one additional registry-completeness test asserts all four goals sports opt in.
- Hockey coverage: 16 cases for registry completeness, whole-key +1 for both teams, exact hockey mark/colours/countdown, correction + Undo after side swap, saved draft/Undo, time-up win and draw/refresh, Finish cancellation, free/points modes, points completion, setup picks, repeated bump without focus loss, and three contrast pairs.
- Classic fallback guarantee now uses an explicit registry opt-out, restored in finally. Classic rendering is retained. Existing hardening tests already exercise football/basketball team boards and needed no edits.
- Full suite: 154 files passed, 1,974 passed and 7 expected failures before the final extra registry assertion. Final focused run: 7 files and 218 tests passed, including the extra registry assertion and palette tests.
- Lint: 0 errors, 29 warnings. Type-check: exit 0. Palette baseline unchanged.
- No spectator files, tournament scorer, shared board/CSS, scoring rules, persistence or outbox code changed.

## Follow-ups

- Period/half modeling: 89ec1095-a7ea-4949-8a63-813fa8199920. Commented that hockey also has only a total quick-match countdown.
- Classic removal: bc22c306-95c0-4c99-8983-80b415f51bef. Commented that all registered quick goals sports now opt in; MonoTournamentLiveScore still routes goals tournaments to the separate MonoGoalsLiveScore, so removal must distinguish those callers.
- Existing restore notice/header overlap: 0bc088ff-56cc-423d-a67a-3c40933c2168. Visible briefly after remount; kept out of this PR.
- Tournament adoption: c8fb66c6-b140-40d4-a30e-68a102cc84e4.
- SA-10 tournament clock restore: 134b5fe0-df42-4fe2-af45-2e1fb5924145.
- SA-08 delayed auto-finish/Undo: 8b0316bd-bcda-40b9-877a-f4188f5dd5dc.

Three result captures initially raced the asynchronous Finish transition; all three were recaptured and visually checked to show the saved result. No additional visual bug found in the captured hockey board. Known restore notice overlap remains the linked follow-up.


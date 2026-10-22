# Kabaddi board demo evidence

40 PNGs cover master before and PR after at 390×844 light, 360×640 light and 390×844 dark. Product code is unchanged by this evidence task.

## Screenshots

| State | 390×844 light | 360×640 light | 390×844 dark |
|---|---|---|---|
| Early countdown | [Before](before-kabaddi-early-390x844-light.png) · [After](after-kabaddi-early-390x844-light.png) | [Before](before-kabaddi-early-360x640-light.png) · [After](after-kabaddi-early-360x640-light.png) | [Before](before-kabaddi-early-390x844-dark.png) · [After](after-kabaddi-early-390x844-dark.png) |
| Super Tackle | [Before](before-kabaddi-tackle-390x844-light.png) · [After](after-kabaddi-tackle-390x844-light.png) | [Before](before-kabaddi-tackle-360x640-light.png) · [After](after-kabaddi-tackle-360x640-light.png) | [Before](before-kabaddi-tackle-390x844-dark.png) · [After](after-kabaddi-tackle-390x844-dark.png) |
| All Out / last action | [Before](before-kabaddi-allout-390x844-light.png) · [After](after-kabaddi-allout-390x844-light.png) | [Before](before-kabaddi-allout-360x640-light.png) · [After](after-kabaddi-allout-360x640-light.png) | [Before](before-kabaddi-allout-390x844-dark.png) · [After](after-kabaddi-allout-390x844-dark.png) |
| Time’s up / Full Time | [Before](before-kabaddi-timeup-390x844-light.png) · [After](after-kabaddi-timeup-390x844-light.png) | [Before](before-kabaddi-timeup-360x640-light.png) · [After](after-kabaddi-timeup-360x640-light.png) | [Before](before-kabaddi-timeup-390x844-dark.png) · [After](after-kabaddi-timeup-390x844-dark.png) |
| Finish confirmation | [Before](before-kabaddi-finish-390x844-light.png) · [After](after-kabaddi-finish-390x844-light.png) | [Before](before-kabaddi-finish-360x640-light.png) · [After](after-kabaddi-finish-360x640-light.png) | [Before](before-kabaddi-finish-390x844-dark.png) · [After](after-kabaddi-finish-390x844-dark.png) |
| Options sheet | Classic controls: [Before](before-kabaddi-early-390x844-light.png) · [After](after-kabaddi-options-390x844-light.png) | Classic controls: [Before](before-kabaddi-early-360x640-light.png) · [After](after-kabaddi-options-360x640-light.png) | Classic controls: [Before](before-kabaddi-early-390x844-dark.png) · [After](after-kabaddi-options-390x844-dark.png) |
| Football unchanged | [Before](before-football-early-390x844-light.png) · [After](after-football-early-390x844-light.png) | [Before](before-football-early-360x640-light.png) · [After](after-football-early-360x640-light.png) | [Before](before-football-early-390x844-dark.png) · [After](after-football-early-390x844-dark.png) |

The classic scorer has inline controls rather than an options sheet. The table links its normal board as that baseline. There are 15 classic Kabaddi shots, 18 new-board shots, six football comparison shots, and one interaction walkthrough.

## Method and source refs

Captured only with T3 html_preview. The real master MonoQuickMatch and PR MonoQuickMatch/TeamGoalsBoard components were bundled into self-contained phone documents with embedded app fonts and styles. Auth and Convex were mocked locally; useMutation throws if called. Live transport was inert. Real local storage and the component’s scoring, Undo, options, confirmation and draft hydration paths ran. A controlled scheduler advances the real timer callback so comparisons are deterministic. All Out’s 260ms tgb-bump animation was paused at 80ms for its still image. Reduced-motion CSS disables this animation; the system preference was not emulated.

Before source: master 997abde2fb17ce8b8925d02d5c9547af9cb6748e. After product source: 012cd4f2a86f9d6e99562c9605452fb5915f48c6. The later rebase onto master f2fd45b93726f50ad4f25fd14dcfa50ff9d318a1 changes none of the captured scorer, shell or global-style files. The harness remains in untracked .kit-g2/.

Twenty-seven PNGs are direct phone captures; thirteen are exact viewport crops from five multi-frame html_preview captures. Each iframe reported its own requested viewport, state and measurements before its PNG was accepted. All **40 PNG dimensions** were checked. Earlier fallback-font captures and renders with missing console evidence were discarded.

## Rendered measurements — local fixture evidence (rung 5)

| Check | 360×640 light | 390×844 light / dark |
|---|---|---|
| Document and board | 360×640; scrollWidth 360 | 390×844; scrollWidth 390 |
| Six scoring buttons | 139.5×48px each | 154.5×48px each |
| Undo | 253×60px; y=566, bottom=626 | 283×60px; y=766, bottom=826 |
| Bottom clearance | 14px | 18px |
| Options control | 64×60px | 64×60px |
| Finish / sheet Done | ≥48px high | ≥48px high |
| Options rows / confirm actions | 54px / 52px high | 54px / 52px high |

The scoring zone and Undo fit without vertical scrolling. No horizontal overflow was measured in any final capture.

Computed rendered colours give **11.73:1** for Raiders labels and all three inverted scoring buttons (white / #383838), **12.84:1** for Titans labels and its three buttons (#0b0b0d / #facc15), and **6.70:1** for the raider sport chip (white / #b6005a). These values hold in both themes. The real contrastReport also passes every label, court-line, numeral, chip and identity threshold (lowest ratio / required ratio: 1.037).

## Shared checklist

- [x] Team-key labels, all six scoring buttons and the sport chip pass rendered contrast checks and the real contrastReport.
- [x] Undo is visible in the bottom thumb zone and names the score it restores.
- [x] Every supported requested state is captured; all scoring actions and Undo were walked.
- [x] Scoring zone fits 360×640 without scrolling or horizontal overflow.
- [x] Both phone sizes in light; a complete 390×844 dark set.
- [x] Every new-board action target is at least 48×48px; local draft remount restores scores, colours and Undo history.
- [x] Black/Yellow fixture picks reach the board; setup picker availability is covered by automated tests.
- [x] Football comparison is pixel-identical for both sizes and the dark set.

The extra [interaction walkthrough](after-kabaddi-walk-390x844-light.png) ran all six team/action combinations and Undo back to 3–2; saved an All Out at 5–2 through real local storage; remounted the component and undid to 3–2; then exercised side swap, score correction and Undo, and Finish cancellation. Every step reported WALK_OK. The early light captures advance 39:48 → 39:47. Time-up fixtures show the truthful existing expiry state and locked scoring; Finish confirmation is captured separately. End-match confirmation/save and expiry reconstruction also pass in the 18-test suite.

Undo hints are readable at the bottom in the normal board: “back to 2–2” in the early fixture and “back to 3–2” after either +2 action. Options and Finish use the existing modal surfaces. Black and Yellow fixture picks reach the normalized board colours above; setup picker availability and persisted colour restoration are covered by the real-component tests.

## Engine boundary and follow-ups

Kabaddi’s current quick-match engine has a total countdown and time-up lock, with no half state, half-time handoff or second-half transition. No such states were invented. Undo reverses scores and does not rewind the clock or reopen a completed match.

- Half states / handoff: Forge 89ec1095-a7ea-4949-8a63-813fa8199920.
- Separate tournament board: Forge c8fb66c6-b140-40d4-a30e-68a102cc84e4.
- Existing raid engine: kabaddi-raid-engine-696a8cf7.
- Existing SA-10 tournament clock restoration: sa-10-goals-tournament-134b5fe0.
- Existing SA-08 auto-finish timer: sa-08-uncancelled-300-8b0316bd.

## Findings and validation

No new Kabaddi visual defect was found in these fixtures. Classic football is **pixel-identical before/after in all three configurations**, checked by SHA-256 over decoded BGRA pixels (PNG encodings may differ after cropping). Its existing correction buttons are 40px high and bottom actions 46px high, below the requested 48px target: filed as Forge **2a2bc2bf-2061-4c64-aab6-7cd8eb0a6d4e**, outside this PR. The final font-complete classic captures fit their viewports; the superseded 669px observation was a capture-harness artifact.

The focused Kabaddi suite passed 18/18 before the final rebase. After rebasing, the Kabaddi and palette suites passed 147/147 tests across two files. Commit/push hook results are recorded in the PR. No test or product source was added or changed by this capture task. The hosted preview remains separately blocked by the already-filed Convex deployment quota issue (4db7b17c-68e8-42dd-8822-ac5889243e0b).

# Dock visibility on scoring boards

Decisions needed: none.

Starting a match used to leave the global app dock over Undo and Match options until the first scoring tap. The dock now follows board visibility, independently of the first-point latch that controls the leave prompt. The same flag removes `body.has-mobile-bottom-nav` padding.

Scorers register their visible board through the shared scoring context. Quick setup does not register a board, and guided cricket explicitly keeps its lineup setup in the app shell. Registrations are counted so nested guided scorers and Finish screens cannot reveal the dock when one child unmounts.

Kit Finish owns its own Done, Rematch/New Match and result actions, so it remains dock-free for both quick and tournament results. Done/leave returns the app dock; New Match restores it on setup; Rematch opens a fresh dock-free board. The leave prompt still waits for the first scoring action and stays armed after Undo to zero.

## Acceptance evidence

- Setup, Start at zero, unscored draft restore, first score, Undo to zero, scored draft restore and Back/leave: real app-shell route tests for volleyball, cricket and kabaddi quick matches and a volleyball tournament board.
- The existing all-sport route matrix also checks dock/padding absence on ordinary quick/tournament boards, tennis quick/tournament scorers and limited-overs, Test and guided cricket scorers.
- Result re-entry, Finish, Rematch and New Match use the existing route contracts with dock/padding assertions. Guided cricket lineup setup has a dedicated regression.
- Scoring, persistence, team colours, sport marks and contrast rules are unchanged. Existing board/colour/palette tests remain the checks for those contracts.

TDD: the six targeted board/result cases failed against the original navigation before implementation. The eight split board-flow regressions then passed with the existing 15-second test limit. Final full-suite validation is recorded below.

## Rendered evidence

Captured only with T3 `html_preview`, using the prescribed self-contained inlined IIFE/CSS/fonts method. Each frame renders the real app shell and quick scorer, with auth/Convex/live broadcasting mocked and a zero-score draft. Before navigation is from `origin/master` (`b0a527acdb04cf9ebca9843869942f1731519245`). The harness is untracked.

Every accepted frame has the exact dimensions in its filename. Before frames reproduce the overlap: the dock covers the center of both Undo and More. After frames have no dock, no dock padding, no horizontal overflow, and both control centers hit their own button. Body height changes from viewport + 82 px to the exact viewport height.

| Sport / viewport / theme | Before | After |
| --- | --- | --- |
| Cricket / 360×640 / light | [Before](cricket-before-360x640-light.png) | [After](cricket-after-360x640-light.png) |
| Cricket / 390×844 / light | [Before](cricket-before-390x844-light.png) | [After](cricket-after-390x844-light.png) |
| Cricket / 360×640 / dark | [Before](cricket-before-360x640-dark.png) | [After](cricket-after-360x640-dark.png) |
| Kabaddi / 360×640 / light | [Before](kabaddi-before-360x640-light.png) | [After](kabaddi-after-360x640-light.png) |
| Kabaddi / 390×844 / light | [Before](kabaddi-before-390x844-light.png) | [After](kabaddi-after-390x844-light.png) |
| Kabaddi / 360×640 / dark | [Before](kabaddi-before-360x640-dark.png) | [After](kabaddi-after-360x640-dark.png) |

| Board / viewport | Undo hit area | More hit area | Bottom of controls |
| --- | --- | --- | --- |
| Cricket / 360×640 | 278×56 px | 50×56 px | 630 px |
| Cricket / 390×844 | 308×56 px | 50×56 px | 834 px |
| Kabaddi / 360×640 | 253×60 px | 64×60 px | 626 px |
| Kabaddi / 390×844 | 283×60 px | 64×60 px | 826 px |

Light/dark 360×640 controls have the same measured bounds. All hit targets exceed 48 px in both dimensions. Undo is deliberately disabled before the first action; its full surface remains visible. Scoring/Undo behavior and the leave guard are exercised by the route tests (rung 4); screenshot geometry/hit testing is rendered fixture evidence (rung 5), not a production deployment claim.

## Validation

- `bun run test --maxWorkers 1 --no-fileParallelism --reporter verbose`: 164 files passed; 2,136 tests passed and seven existing expected failures (2,143 total). Completed in 1,058.49 seconds.
- Complete rebased route suite: 126 passed and four existing expected failures (130 total). The nine focused dock regressions also passed independently.
- Lint: zero errors, 29 existing warnings. Type-check and agent-config-sync hooks passed on the implementation and evidence commits.
- `bun run evidence:compress docs/plans/2026-10-23-dock-over-scorer`: 12 PNGs reduced from 607,607 to 188,074 bytes total. Every final image matches its filename dimensions; the largest is 19,563 bytes.
- `bun run evidence:check origin/master`: passed the 250,000-byte per-image gate.

Earlier non-verbose broad runs were stopped after losing observable progress; the final verbose full run completed successfully. An untracked baseline source copy that polluted the palette scan was removed. No timeout, baseline or gate was weakened. Intermittent T3 timeouts and a tool-host restart required capture retries; loading-skeleton images were rejected. Rebased over the volleyball tournament board change (`8a0b9ac`); the new tournament regression uses its current accessible scoring-button name.

Follow-ups: none identified in product code.

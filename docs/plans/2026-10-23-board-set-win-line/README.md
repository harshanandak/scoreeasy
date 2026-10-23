# Set/game win last-action line

Decisions needed: none.

After a set-winning point the next set starts at 0–0, but the last-action line must describe the completed set. It now reads “Set 1 to Royals · 25–23” (badminton: “Game 1 to Royals · 21–19”). The line derives from existing completed-set and action history. Undo restores the preceding point line; a remount restores the same line. Scoring, serve, draft writers and live outbox are unchanged. Table tennis uses the existing registry fallback “Set”.

## Validation

- **Rung 4:** new scorer tests: 8 passed; baseline: 7 failed / 1 compatibility test passed. Tests use real localStorage, cover all three sports, win → Undo → remount → win → next point → Undo, swapped sides/other winner, correction guard, Finish and natural match completion.
- **Rung 4:** full suite: 157 files passed; 2020 tests passed, 7 expected failures (2027 total), using `bun run test -- --maxWorkers 2` (436.57s). The initial unrestricted run was stopped under local load; the bounded complete run passed.
- **Rung 4:** `bun run lint`: 0 errors / 29 existing warnings; `bun run type-check`: passed.
- **Rung 5, rendered harness:** real MonoQuickMatch, real scoring and localStorage, mocked auth/Convex/broadcast; single IIFE + CSS + inline fonts via T3 html_preview only. Vite dev server started at port 5203 with the same mocks. No localhost browser or live-system writes.

## Acceptance checklist

- [x] Team-colour labels pass contrastReport, including mark overlays: zero failures in all 40 audits.
- [x] Undo is visible in the thumb zone with the pre-action score: 253×60 at 360px, bottom 622/640; 283×60 at 390px, bottom 826/844.
- [x] Volleyball and badminton: before/after set win and Undo at both sizes; restore, Finish dialog and natural Result. Table tennis: win, Undo, remount and natural Result. Match completion removes the board/last line; Finish confirmation retains the result line behind the dialog.
- [x] Scoring zone fits: boards and document are exactly 360×640 or 390×844; no scoring scroll or horizontal overflow in the captured states.
- [x] Light and dark: win and Undo for volleyball and badminton at both sizes.
- [x] Every visible target ≥48px; seeded draft and post-win remount match; automated tests also remount after Undo.
- [x] Purple/yellow setup selections reach each board (separate setup walkthrough captures) and remain with the teams; quick-setup computed cores are #6838c6 / #facc15 (seeded draft cores #6938c6 / #fbbf24).
- [x] Result lines occupy one line: volleyball 138.44px, badminton 153.25px, table tennis 130.25px; Undo lines 152.89px (volleyball/badminton) and 144.72px (table tennis), measured with the inline app fonts. The checks assert one text rect and sufficient available width at 360px.

Exact rectangles, line widths, transitions and contrast results: [measurements.json](measurements.json).

## Follow-ups

Existing out-of-scope bugs visible in evidence:

- Restore notice overlaps the header: `0bc088ff-56cc-423d-a67a-3c40933c2168`, parallel branch `fix/restore-notice`.
- Clock stays at 0:00: `49c8111d-40e3-4aec-bab4-13c437d491d9`.
- Badminton Result chips still use Set: `3624182d-848e-468f-b1c2-90c5dbf9d499`.

## Screenshots

Baseline source: origin/master (0d7d7704c53fb4e2c5f38f5b4281a7db22ecfac9). Each PNG was cropped from its T3 preview at its declared phone size, with dimensions checked by sharp. The untracked .kit-lastline harness reuses the supplied .kit-g3a approach.

| Version | Sport | Walked state | Viewport/theme | Evidence |
|---|---|---|---|---|
| Before | volleyball | won | 360×640 light | [PNG](before-volleyball-won-360-light.png) |
| After | volleyball | won | 360×640 light | [PNG](after-volleyball-won-360-light.png) |
| Before | volleyball | undo-win | 360×640 light | [PNG](before-volleyball-undo-win-360-light.png) |
| After | volleyball | undo-win | 360×640 light | [PNG](after-volleyball-undo-win-360-light.png) |
| Before | badminton | won | 360×640 light | [PNG](before-badminton-won-360-light.png) |
| After | badminton | won | 360×640 light | [PNG](after-badminton-won-360-light.png) |
| Before | badminton | undo-win | 360×640 light | [PNG](before-badminton-undo-win-360-light.png) |
| After | badminton | undo-win | 360×640 light | [PNG](after-badminton-undo-win-360-light.png) |
| After | volleyball | restore-win | 360×640 light | [PNG](after-volleyball-restore-win-360-light.png) |
| After | badminton | restore-win | 360×640 light | [PNG](after-badminton-restore-win-360-light.png) |
| After | volleyball | finish-win | 360×640 light | [PNG](after-volleyball-finish-win-360-light.png) |
| After | badminton | finish-win | 360×640 light | [PNG](after-badminton-finish-win-360-light.png) |
| After | volleyball | won | 360×640 dark | [PNG](after-volleyball-won-360-dark.png) |
| After | badminton | won | 360×640 dark | [PNG](after-badminton-won-360-dark.png) |
| After | volleyball | undo-win | 360×640 dark | [PNG](after-volleyball-undo-win-360-dark.png) |
| After | badminton | undo-win | 360×640 dark | [PNG](after-badminton-undo-win-360-dark.png) |
| After | volleyball | result-win | 360×640 light | [PNG](after-volleyball-result-win-360-light.png) |
| After | badminton | result-win | 360×640 light | [PNG](after-badminton-result-win-360-light.png) |
| After | tabletennis | won | 360×640 light | [PNG](after-tabletennis-won-360-light.png) |
| After | tabletennis | undo-win | 360×640 light | [PNG](after-tabletennis-undo-win-360-light.png) |
| After | tabletennis | restore-win | 360×640 light | [PNG](after-tabletennis-restore-win-360-light.png) |
| After | tabletennis | result-win | 360×640 light | [PNG](after-tabletennis-result-win-360-light.png) |
| After | volleyball | setupwalk | 360×640 light | [PNG](after-volleyball-setupwalk-360-light.png) |
| After | badminton | setupwalk | 360×640 light | [PNG](after-badminton-setupwalk-360-light.png) |
| Before | volleyball | won | 390×844 light | [PNG](before-volleyball-won-390-light.png) |
| After | volleyball | won | 390×844 light | [PNG](after-volleyball-won-390-light.png) |
| Before | volleyball | undo-win | 390×844 light | [PNG](before-volleyball-undo-win-390-light.png) |
| After | volleyball | undo-win | 390×844 light | [PNG](after-volleyball-undo-win-390-light.png) |
| Before | badminton | won | 390×844 light | [PNG](before-badminton-won-390-light.png) |
| After | badminton | won | 390×844 light | [PNG](after-badminton-won-390-light.png) |
| Before | badminton | undo-win | 390×844 light | [PNG](before-badminton-undo-win-390-light.png) |
| After | badminton | undo-win | 390×844 light | [PNG](after-badminton-undo-win-390-light.png) |
| After | volleyball | restore-win | 390×844 light | [PNG](after-volleyball-restore-win-390-light.png) |
| After | badminton | restore-win | 390×844 light | [PNG](after-badminton-restore-win-390-light.png) |
| After | volleyball | finish-win | 390×844 light | [PNG](after-volleyball-finish-win-390-light.png) |
| After | badminton | finish-win | 390×844 light | [PNG](after-badminton-finish-win-390-light.png) |
| After | volleyball | won | 390×844 dark | [PNG](after-volleyball-won-390-dark.png) |
| After | badminton | won | 390×844 dark | [PNG](after-badminton-won-390-dark.png) |
| After | volleyball | undo-win | 390×844 dark | [PNG](after-volleyball-undo-win-390-dark.png) |
| After | badminton | undo-win | 390×844 dark | [PNG](after-badminton-undo-win-390-dark.png) |

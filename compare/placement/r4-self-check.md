Decisions needed: none.

Historical evidence for head a57eedd. The r5-self-check.md report supersedes these layout measurements and first-screen placement claims.

The rebuild is implemented on design/home-v3 for draft PR #280. This is the implementation self-check, not independent approval. No local tests were run. Lint, type-check and agent-config checks passed through the commit hooks; tests and builds are left to CI.

Evidence levels: browser observations below are rung 5 on the local dev app; CI execution is rung 4; code-only items are explicitly marked. Production first paint, real-phone browser chrome, native touch and OS-level reduced motion were not verified.

| Critique | Status | What changed / evidence |
|---|---|---|
| 1 Auto-rail stalls | Fixed | State-driven pager replaces scroll inference; a 1.5 s overdue watchdog retries. The T3 recording shows all five cards and the last-to-first wrap. Watchdog test runs in CI. |
| 2 Device copy | Fixed by approved decision | Phone copy below 900px; sideline/device from 900px. Checked phone and desktop. The approved phone copy at 768 is intentional. |
| 3 Tennis 40-G | Fixed | Game Asha counts game 1 and resets points to 0–0. Observed in the recording; point samples contain only 0/15/30/40/AD. |
| 4 Dark haze / outlines / shadows | Fixed | Token-based wash, soft hairlines and shared lift. Forced root .dark inspected at 390 and 1280. |
| 5 Phone first screen | Fixed | Top bar, headline, reassurance, one complete card and controls. Card bottom 724px at 390×844; 660px at 360×780. Controls end 780px / 716px; Start begins below the fold. 64px bottom allowance. |
| 6 Start detour | Fixed | Start scrolls to Home's picker, focuses home-pick and keeps pathname /. Observed. |
| 7 Heavy nested frames | Fixed | One soft outer surface, 20px radius, flat inner wells; no hard offset card shadows. Inspected light/dark. |
| 8 Tiny card text | Fixed | 12px minimum. Computed-style scans at phone, tablet and desktop; all five phone card states sampled. |
| 9 Visible cards frozen | Fixed | Both tablet cards play; desktop cards have individual visibility observers. Both tablet values changed in browser; desktop motion recorded. |
| 10 Hard cut-off peek | Fixed to approved layout | No phone peek. Desktop uses a 200px fade before the headline; the outer viewport clips the incoming track. |
| 11 Long loop / dots / Pause | Fixed | Five accurate dots on pager, visible Pause/Play, 7.8–8.3 s stories. Phone loop recorded. |
| 12 Hover pauses | Not fixed, intentional | The approved brief explicitly requires desktop hover/focus pause. Retained with a visible Pause control; this supersedes critique 12. |
| 13 Stretched tablet | Fixed | 560px copy/CTA constraint, two demo cards and three Popular columns at 768. Inspected. |
| 14 Tile overlap / size | Fixed on Home | Shared Play tiles keep 116px / 92px heights; Home art moves lower and shrinks. Phone and tablet inspected. Play's styling remains unchanged. |
| 15 Desktop balance / account line | Fixed | Copy and CTA group centred beside the rail; account action under Start; arrows removed. Inspected 1280/1440. |
| 16 FAQ edge | Fixed | Grid, FAQ and footer share 1120px content width. At 1440 their left/right edges are 160/1280px. |
| 17 Sign in weak | Fixed | 48px outlined/tinted secondary pill. Text contrast measured 16.94:1 in light and 13.31:1 in dark; both themes inspected. |
| 18 Fake loader / auth gate | Fixed in code; production unverified | Removed 08–07 from static boot and AppLoading. Public Home renders during auth initialization without mounting private scoring storage. App.home test is in CI. No production first-paint measurement. |
| 19 Flattened sports / Hockey | Fixed | Shared Popular 6 full + More 3 mini picker, including Hockey. All nine tiles opened /<sport>/quick with newMatch: true in the T3 browser; matching assertions are in CI. |
| 20 Closing CTA | Fixed | Closing Start above the footer, using the same scroll/focus action. Inspected. |
| 21 Underline spacing | Fixed | Underline constrained to its words; 18px reassurance margin. Inspected phone/desktop. |
| 22 Tap spacing | Fixed | Call anchored at top; larger scoring keys; flat wells. Final 360 screenshot inspected. |
| 23 Live phone alignment | Fixed | Phones share a top edge; signal label stays in 68px lane; link above phones; labels >=12px. Phone/desktop inspected. |
| 24 Moments clipping | Fixed | 8px inset, flat rows, bottom mask, minimum 82px pitch. All nine sports appear within one short story. Inspected. |
| 25 Paper duplication / gap | Fixed | Inner badge/tag removed; compact stack. Paper wipe and chase calculation observed in phone recording. |
| 26 Offscreen playback | Fixed | Rail pauses below 50% visibility; desktop observes individual cards. Browser scroll showed phone rail stopped. Observer tests in CI. |
| 27 Account hit area overlap | Fixed | Account line belongs to separate Start block below phone rail and to left desktop column. Inspected. |
| 28 Double footer line | Fixed | Last FAQ border removed; closing CTA separates footer. Inspected. |
| 29 Subtitle alignment | Fixed on Home | Fixed two-line subtitle blocks. Home rows inspected. Play's existing subtitle layout is preserved by the approved constraint. |
| 30 Tint / Football similarity | Partly fixed | Neutral token wash and no cricket identity on Home. CTA remains green as required; perceptual similarity to Football was not redesigned. |
| 31 Moment copy | Fixed | “Nine sports. The rules built in.” and “Two bonus points to the raiding side.” Standard kabaddi all-out preset checked in remote source; custom points-only rules are not represented. |
| 32 FAQ glyphs | Fixed | One rotating CSS chevron. Inspected collapsed/open states. |
| 33 Undone six ghost | Fixed | Undo clears the slot text and score returns to 5. Timeline assertion and browser recording. |

Additional corrections found during implementation:
- Pause also freezes rolling-text cleanup and browser animation objects, not only the score clock.
- Sticky visibility measures current geometry after a fast jump that skips an observer transition. Seen active at 390×300 after the picker leaves, hidden over the picker and closing action; at the requested tall phone sizes the grid/closing action usually makes it unnecessary.
- The raw-colour ratchet is preserved: Home uses palette/engine variables instead of adding literals.
- Tests check the current rolling value separately from outgoing animation text; freeze assertions are retained.

Evidence lives in compare/placement/ with r4- names. Each committed image/GIF is below 250,000 bytes:
- r4-phone-390.png, r4-grid-390.png, r4-phone-360.png
- r4-tablet-768.png, r4-desktop-1280.png, r4-desktop-1440.png
- r4-dark-390.png, r4-dark-1280.png
- r4-phone-cycle.gif, r4-desktop-marquee.gif
- r4-sticky-short.png (extra short-viewport activation evidence)

Limits: dev-app observations only; no production build/first-paint run locally, no native-device swipe/browser chrome, no OS-setting reduced-motion switch. Reduced motion was exercised by overriding matchMedia for newly mounted rail components; CI checks the native media-query branch. Desktop marquee seam geometry was checked (equal 1680px groups, translate -50%); a real device seam remains unverified. The app-wide dark-mode activation issue remains separate as directed.


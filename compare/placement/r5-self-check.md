Decisions needed: none.

Round 5 implementation self-check for draft PR #280, design/home-v3. These measurements supersede the r4 layout measurements. This is not independent approval for owner review.

| Item | Status | Measured result (CSS pixels) |
|---|---|---|
| 1 Compact cards / proportionate keys | Fixed | Phone cards are 380px high. Live art is 300px high; it starts 1px below the art container and the phones end 17px above the card bottom. Tennis keys are 132.9px high; rule-to-keys gap is 54.5px. Both light and dark phone frames inspected. |
| 2 Reachable first-screen Start | Fixed | At 390×844, Start is y=656.9–712.9; at 360×780, y=651.9–707.9. Fully visible in both. Controls-to-Start gap is 16px; no viewport-height filler. Sticky suppression over the picker remains. |
| 3 Running-state captures / autoplay | Fixed | Fresh-load pager and marquee both reported data-playing=true and label Pause. Every r5 capture shows Pause. Phone GIF covers all five cards, including last-to-first, without clicking Pause. |
| 4 Duplicate phone copy | Fixed | One short reassurance line under the headline. Zero home-saves elements. The only paragraph in the Start block is the account link, using phones below 900px. |
| 5 Double picker heading | Fixed | One Pick your sport heading and one See all link. Zero Popular headings on Home; the accessible Popular region still holds six tiles. More sports holds three. Play retains its original heading via the shared component's default. |
| 6 Quieter Sign in | Fixed | 1px mid-ink border (light rgb(95,96,103), dark rgb(162,164,171)), 3% ink tint, 48px height and 16px strong text. |
| 7 Tablet focus ring | Fixed | Real pointer click on Start focused home-pick with tabIndex=-1, data-keyboard-focus=false and computed outline-style:none. The 768 capture has no ring. Keyboard-triggered focus retains a focus-visible treatment. |
| 8 Desktop ghost fragments | Fixed | Band begins 80px after the headline column. Mask is fully clear for 112px and fades to opaque at 400px. Whole cards also fade from offsets 320→200px before reaching the masked edge. Across 3,000 card samples, all 1,198 samples at offset ≤180px had opacity 0. Light/dark captures and marquee recording inspected. |
| 9 Overlapping Pause control | Fixed | Band bottom y=480; Pause top y=496: 16px clear gap. Pause right equals content right: 1200px at 1280, 1280px at 1440. |
| 10 Desktop vertical rhythm | Fixed | Top-bar bottom to band: 56px; to headline: 64px. Hero bottom y=544 to picker top y=632: 88px. Same at 1280 and 1440. |
| 11 Desktop copy / Sign in | Fixed | Zero duplicated saves sentences; account wording is Save across devices. Same 1px secondary Sign in treatment as item 6. |

Evidence level: rung 5 for the local dev app's rendered views and interactions; CI is rung 4. Measurements are CSS pixels, while some PNGs retain a 2× capture resolution. Desktop PNGs were reduced to their CSS viewport dimensions where needed for the size cap.

Evidence, all under 250,000 bytes each:
- r5-phone-390.png (live card, running frame selected from the T3 recording)
- r5-grid-390.png (scrolled Start and all nine sport tiles)
- r5-phone-360.png
- r5-tablet-768.png (after pointer-triggered Start focus, no outline)
- r5-desktop-1280.png
- r5-desktop-1440.png
- r5-dark-390.png (tennis, running frame selected from the T3 recording)
- r5-dark-1280.png (running frame selected from the T3 recording)
- r5-phone-cycle.gif (all five cards and wrap)
- r5-desktop-marquee.gif (whole cards fade without isolated letters/controls near the headline)

All browsing, screenshots and recordings came from the T3 integrated browser, one call at a time. PNG compression, video-frame selection and GIF encoding used those captured artifacts. No system browser, Playwright or local tests were used.

Lint, type-check and agent-config hooks passed. CI verify passed on the code commit (53bf3f5); the final evidence commit has its own CI state in GitHub. No gate was bypassed. The preview tab is closed and the Vite server is stopped (port 5181 had zero listeners).

Not verified: native-device browser chrome/touch, OS-level reduced-motion settings, and production first paint. These were not changed by this round. The five stories, tennis reset, cricket undo, reduced-motion branch and account boundaries remain covered by the existing CI assertions, with current-value, copy, heading and complete-card fade assertions updated for r5.


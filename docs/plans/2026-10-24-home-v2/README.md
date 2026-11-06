# Home v2 evidence (2026-10-24)

The real Home (`landing/DashboardLanding.jsx`) and the real dock (`GlobalNavigation` from
`index.jsx`), as a guest, with auth and Convex mocked and localStorage seeded per state. "Before" is
`origin/master` 283ba8f's `DashboardLanding.jsx`; everything else is the same build. Captured with the
T3 `html_preview` tool (the bundle inlined into the page); no Chrome.

States: `first` (nothing saved), `inprog` (2 in progress, 0 finished: cricket Team A 47/2, volleyball
Royals v Strikers 18–15), `mixed` (the same 2 in progress + 3 finished: volleyball 2–1, cricket
164/6–158/9, football 2–2 draw). `*-recent-*` is the same screen scrolled to the end.

Measured in each capture (from the rendered DOM):

| | 390×844 | 360×640 |
|---|---|---|
| Start a match (after, in progress) | top 536, bottom 592, 56 px tall | top 490, bottom 546 (sticky) |
| Dock | top 772 | top 568 |
| Start clear of the dock | yes, 180 px | yes, 22 px |
| Resume buttons | 48 px | 48 px |
| Go buttons on screen | 1 (`Start a match`; `Rematch` with nothing in progress) | 1 |
| Horizontal overflow | none | none |

The first-run screen is byte-identical before and after at 390×844.

Dock labels: html_preview sometimes paints the dock without its labels (at 390 wide here). The
dock code is untouched by this PR and identical in both builds. In a real browser the labels are laid
out (12 px tall, under each icon), and the DOM at capture time has them. Each before/after pair below
shows the dock the same way.

# s1 raid-pad evidence harness

`fixture.js` plays the common fixture raid by raid through the engine; `check.mjs` prints each
scene's engine state (`bun .kbs1/check.mjs`). `harness.jsx` mounts the real MonoQuickMatch with
auth/Convex mocks and a frozen wall clock. `sh .kbs1/shot.sh` builds the bundle into
`carrier.png`; `node .kbs1/page.mjs <rest|raid|moment|end|half|staged> <light|dark> <844|640>`
prints the page to pass to T3 `html_preview` (no Chrome). `sim.mjs` replays a raid script.

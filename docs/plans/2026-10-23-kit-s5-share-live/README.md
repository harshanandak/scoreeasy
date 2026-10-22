# Kit S5: scorer-side go live and share

The consent offer stays in the scorer's existing options sheet. The share sheet follows the approved prototype's `consent()` / `share()` type, control, live-pill and link-row treatment. Spectator screens are outside this PR.

## Demo evidence

All 21 PNGs were captured with **T3 `html_preview` only**. The before components come from fetched master `1ccbb2499bf71a2fa0de5497c2a3117ad48214c1`. The harness rendered the real React components with local auth, broadcast and clipboard mocks; its neutral board backdrop is illustrative. No deployment was seeded and no backend writes occurred.

The requested Vite server ran on port 5185. Its localhost iframe failed in `html_preview` with `net::ERR_SOCKS_CONNECTION_FAILED`; the host-address iframe was blank. The capture fallback was a self-contained iframe containing a production build of the same harness, with the app CSS and fonts inlined. Screenshots still came exclusively from `html_preview`. The temporary harness and build are not committed.

- Before/after consent: `before-consent-{390,360}.png`, `after-consent-{390,360}.png`.
- Before/after share: `before-share-{390,360}.png`, `after-share-{390,360}.png`.
- Dark consent/share at both sizes: `after-{consent,share}-{390,360}-dark.png`.
- Light state walk at 360: `after-live-360.png`, `after-failed-360.png`, `after-signedout-360.png`, `after-copied-360.png`, `after-copyfailed-360.png`, `after-stop-360.png`, `after-private-360.png`, `after-loading-360.png`, `after-offline-360.png`.

Every PNG was decoded and checked for exact dimensions: 390×844 or 360×640. `render-audits.json` retains successful console measurements from the render tool; it is supplementary to the PNGs and automated interaction tests.

## Acceptance walked

- [x] Consent: headline, disclosure, full-width Share live Go and Keep private control; no new modal mount. Light and dark at both sizes. Tests pin in-place rendering and accepted/declined storage.
- [x] Live: green **Live · public**, Share and Stop. Light screenshot; button heights are 48px.
- [x] Failed go-live: original connection alert plus Go retry. Light screenshot and existing retry-nonce regression.
- [x] Signed out: neutral Sign in to go live control, no red dot. Light screenshot; existing auth and returnTo tests.
- [x] Share: labelled modal dialog, real QR using the canonical URL, scheme-free displayed URL, Done, Copy link and Share. Light/dark at both sizes.
- [x] Copied: real copy handler with local clipboard mock shows Copied ✓. Screenshot; fake-clock test proves the 1600ms flash and reset on re-copy. Existing native/web-share/clipboard-fallback/cancellation tests retain their intent.
- [x] Copy failed: rejected clipboard mock shows the original long-press note. Screenshot; missing Clipboard API regression remains green.
- [x] Stop sharing: sheet calls the bar's existing private-visibility handler, closes, and returns to the Go offer. Screenshot plus callback/visibility tests. Existing re-publish path is unchanged.
- [x] Reverse/close paths: Done, backdrop and Escape close; focus enters on Done and returns to Share. Tab wraps at both ends. A regression nests the real bar in `MonoSheet` and verifies Escape closes only Share.
- [x] Loading/offline/empty: unresolved auth and no backend render no sharing controls; private state offers Go. Screenshots and existing tests.
- [x] No horizontal scroll at 390×844 or 360×640; all new controls are at least 48×48. The copy-error sheet still fits vertically at 360×640.
- [x] Scorer Live is green and includes words. No spectator or scorebug file changed.
- [x] Palette ratchet: BASELINE **638 → 635**, with no new literal. One necessary hunk outside the scoped live files lowers the ratchet after removing the sign-in red, share scrim and QR-well literals.

## Measured contrast

Ratios use the app's resolved token values (WCAG 2.x), checked in both the rendered harness and the share-sheet test. Minimum required: 4.5:1.

| Text/background | Light | Dark |
|---|---:|---:|
| Ink / surface | 19.66 | 15.92 |
| Ink / link well | 16.93 | 13.68 |
| Secondary copy / surface | 8.68 | 9.06 |
| Live / live-soft | 6.20 | 8.73 |
| Danger / surface | 6.57 | 7.87 |
| Go label / high stop | 5.34 | 5.34 |
| Go label / core stop | 7.16 | 7.16 |
| Go label / low stop | 10.93 | 10.93 |

No scoring rule, point write/queue/undo, live outbox, draft restoration, consent lifecycle, share fallback implementation or Convex source changed.

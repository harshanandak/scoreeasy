# Kabaddi acceptance evidence

Decisions needed: none. Retained the approved Quick casual default, players-stay strategy, rectangular formats, broader Standard super tackle policy, and complete-raid target finish.

## Delivery order

1. [Formats draft](https://github.com/harshanandak/scoreeasy/pull/222), based on master.
2. [Scorer draft](https://github.com/harshanandak/scoreeasy/pull/225), stacked on the formats branch.
3. [Viewer draft](https://github.com/harshanandak/scoreeasy/pull/227), stacked on the scorer branch.

No PR was merged. Close the superseded scorer draft (#210) only after the scorer merges.

## What was exercised

- **Source component preview (rung 4: ran it):** 14 scenes in each of the three requested viewport/theme variants, 42 screenshots in total. The browser used CSS viewports of 390×844 and 360×640 at device pixel ratio 2. The PNG dimensions are therefore twice those CSS dimensions.
- **Actual control walk in the source preview:** Raid by → +1 produced 1–0 in two taps. Refresh retained 1–0. Undo reopened the raid at 0–0 with its touch mark; the next Undo removed that mark; the next cancelled the raid.
- **Other control walks:** starting from the Standard fixture's 1–1, an empty raid used two taps, kept 1–1 and handed the raid to Strikers; tackled used two taps and produced 1–2; Raid by → Bonus → +2 used three taps and produced 4–1.
- **Compact layout:** the 360×640 live-raid capture keeps Undo within the viewport. The count shortcuts sit alongside mark mode and retain 48-pixel targets.
- **Viewer:** Live, Raids, Stats, full time and plain back-safe frames rendered without horizontal overflow in the inspected 390-pixel pages. The raider flag sits above the bonus legend; result chips sit below the painted court legends. Do-or-die and other moment markers sit above their raids.
- **Compatibility:** existing goals-only drafts keep their original reader and Undo path. Saved v1 raid-engine states use the explicit migration reader; active drafts get an editable engine draft. Unknown versions fail without replacing the saved original.
- **CI, not local tests:** the profile/migration, scorer-model, route, broadcast-projection and Convex privacy/idempotency contracts execute in GitHub Actions. Exact-head status is recorded on the draft PRs. Local commands were lint, type-check, builds, dependency installation and the requested evidence compressor; no local test suite ran.

## What this evidence does not establish

These are the real source components with engine-created fixtures. They are not an installed Android/iOS application or a deployed Convex service. No production backend deployment or live-system writes were performed. The server changes need the normal deployment process after review. Network loss/reconnect on a real phone and cross-device persistence were not reproduced here.

## Reproduce the preview

From the viewer worktree:

```sh
bun install --frozen-lockfile
bun run build
bunx vite build --config .kbk2/vite.config.mjs
bunx vite preview --config .kbk2/vite.config.mjs --host 127.0.0.1 --port 4188
```

Open `/.kbk2/index.html?scene=scorer-between&theme=light` in the T3 integrated browser. The scene names are listed below. Use `theme=dark` for dark mode. Preview interactions persist only under the `kabaddi-acceptance:` storage prefix; remove the relevant fixture key to reset a scene. The normal application build does not include this fixture entry point.

The capture pass used one dedicated T3 preview tab and one preview call at a time. No navigation timeout occurred. PNGs were processed with the repository's evidence compressor without changing dimensions.

## Screenshot matrix

| Scene | 390×844 light | 360×640 light | 390×844 dark |
| --- | --- | --- | --- |
| setup-quick | [light](setup-quick-390-light.png) | [compact](setup-quick-360-light.png) | [dark](setup-quick-390-dark.png) |
| setup-standard | [light](setup-standard-390-light.png) | [compact](setup-standard-360-light.png) | [dark](setup-standard-390-dark.png) |
| scorer-between | [light](scorer-between-390-light.png) | [compact](scorer-between-360-light.png) | [dark](scorer-between-390-dark.png) |
| scorer-live | [light](scorer-live-390-light.png) | [compact](scorer-live-360-light.png) | [dark](scorer-live-390-dark.png) |
| scorer-result | [light](scorer-result-390-light.png) | [compact](scorer-result-360-light.png) | [dark](scorer-result-390-dark.png) |
| scorer-readback | [light](scorer-readback-390-light.png) | [compact](scorer-readback-360-light.png) | [dark](scorer-readback-390-dark.png) |
| scorer-super | [light](scorer-super-390-light.png) | [compact](scorer-super-360-light.png) | [dark](scorer-super-390-dark.png) |
| scorer-allout | [light](scorer-allout-390-light.png) | [compact](scorer-allout-360-light.png) | [dark](scorer-allout-390-dark.png) |
| scorer-quick | [light](scorer-quick-390-light.png) | [compact](scorer-quick-360-light.png) | [dark](scorer-quick-390-dark.png) |
| viewer-live | [light](viewer-live-390-light.png) | [compact](viewer-live-360-light.png) | [dark](viewer-live-390-dark.png) |
| viewer-raids | [light](viewer-raids-390-light.png) | [compact](viewer-raids-360-light.png) | [dark](viewer-raids-390-dark.png) |
| viewer-stats | [light](viewer-stats-390-light.png) | [compact](viewer-stats-360-light.png) | [dark](viewer-stats-390-dark.png) |
| viewer-fulltime | [light](viewer-fulltime-390-light.png) | [compact](viewer-fulltime-360-light.png) | [dark](viewer-fulltime-390-dark.png) |
| viewer-backsafe | [light](viewer-backsafe-390-light.png) | [compact](viewer-backsafe-360-light.png) | [dark](viewer-backsafe-390-dark.png) |


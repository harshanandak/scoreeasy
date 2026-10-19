# Score Easy — interactive HiFi prototype

A standalone, no-build HTML/JS prototype of the redesigned scoring flow (home → sport → setup → live scorer → spectator → result) for 8 sports. Design exploration only: not shipped app code; never imported by src/.

## Open it

- Main app: open `index.html` straight from disk (classic `<script>` tags, works on `file://`), or serve the folder: `python -m http.server 8744` from `prototype/`, then visit `http://localhost:8744/`.
- `compare.html` fetches the reference fragments, so it needs the static server (it fails on `file://`).
- Data lives in `localStorage` (`se-proto-v1`). Reset it from More → Reset all data (`#/board`).

## Page map

| Page | What it is |
|---|---|
| `index.html` | The prototype. Routes: `#/home`, `#/pick`, `#/setup/<sport>`, `#/score/<id>`, `#/watch/<id>`, `#/result/<id>`, `#/records`, `#/schedule`, `#/ground`, `#/board` (dev board) |
| `compare.html` | Side by side: each HiFi reference fragment next to its live prototype screen (click Seed first) |
| `directions.html`, `directions-cricket.html` | Visual-direction explorations (standalone) |
| `palettes.html` | Palette explorations (standalone) |

## Layout

`js/core.js` (store, router, event-sourced match engine with replay-based undo) · `js/ui.js`, `js/icons.js` (shared UI) · `js/app.js` (home, picker, setup, dev board) · `sports/<sport>.js` (one module per sport: rules + scorer + spectator) · `flows/` (result, records, schedule) · `css/` · `reference/` (the HiFi export split into per-screen fragments by `reference/split-screens.mjs`) · `AGENT-BRIEF.md` (porting brief).

Sport rules live only in `sports/<sport>.js`; shared code never branches on a sport.

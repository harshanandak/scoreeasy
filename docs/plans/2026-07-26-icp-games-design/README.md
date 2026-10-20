# ICP Games — Bespoke Design & Redesign (non-cricket)

**Started:** 2026-07-26 · **Kernel epic:** `98dff2a9` (`ICP games — bespoke design & redesign (non-cricket)`)
**Separate from cricket.** Cricket has its own track (`docs/plans/2026-07-20-icp-games/cricket/`, epic `bb02d4d1`) and is NOT part of this initiative.

## What this is
A dedicated, independently-tracked design initiative to give each shortlisted Indian game the same bespoke treatment cricket got — from the **college / university / grounds ICP lens** — blending **both** the HiFi design language *and* the current mono/brutalist design (best of both), not defaulting to either.

## Reading order
1. **This file** — scope and status.
2. [`README-deep-synthesis.md`](README-deep-synthesis.md) — the buildable cross-game system: 3 skeletons, 12 shared components, token laws, the 12 decide-once decisions, build order. **Start here for anything cross-game.**
3. [`README-adaptive-system.md`](README-adaptive-system.md) — how each game themes the shared system (rhythm profiles, per-game packs). Wins over a mechanical reading of the deep synthesis.
4. One game's [`design-final.md`](#games-7) — the locked spec for that game.
5. Background only: [`README-synthesis.md`](README-synthesis.md) (first-pass synthesis, superseded by the deep synthesis where they differ), and per game `research.md` → `design-brief.md` → `main-scoreboard.md` → `scorer.md` → `live-innovations.md` (the drafts each `design-final.md` was critiqued from).

## Games (7)
Each is a child issue under epic `98dff2a9`, labelled `game:<name>`.

| Game | Locked spec | Preview | Rhythm profile |
|---|---|---|---|
| Volleyball | [design-final](volleyball/design-final.md) | [preview](volleyball/volleyball-preview.html) | rhythm-tap |
| Throwball | [design-final](throwball/design-final.md) | [preview](throwball/throwball-preview.html) | rhythm-tap |
| Badminton | [design-final](badminton/design-final.md) | [preview](badminton/badminton-preview.html) | rhythm-tap |
| Basketball | [design-final](basketball/design-final.md) | [preview](basketball/basketball-preview.html) | moment-log |
| Football | [design-final](football/design-final.md) | [preview](football/football-preview.html) | moment-log |
| Kabaddi | [design-final](kabaddi/design-final.md) | [preview](kabaddi/kabaddi-preview.html) | burst-capture |
| Kho-Kho | [design-final](kho-kho/design-final.md) | [preview](kho-kho/kho-kho-preview.html) | burst-capture |

## Review pages
- [`all-games-one-wall.html`](all-games-one-wall.html) — all seven games on one wall for side-by-side review; the acceptance surface named in the adaptive addendum.
- [`all-games-preview.html`](all-games-preview.html) — all game designs in one scrollable page.
- Per-game `*-preview.html` (table above). `*-preview.png` / `*-v2.png` in this folder are screenshots of those pages; `_old/` holds the superseded first-round previews.

## Approach (mirrors the cricket method)
1. **Design brief** per game — scoring model + India nuances, the screens needed (setup / scorer / live-spectator / scorecard), interaction design, blend direction, data touchpoints, animations, port-vs-redesign. *(This wave — via planning workflow.)*
2. **Mockups** per screen — iterate HTML mockups against the brief, screenshot-verify, refine.
3. **Build** — engine/model + real app screens, in PRs, once designs lock.

## Design principles (carried from cricket, applied per game)
- **Blend rubric:** the *record* is brutalist (pure-black ink/borders, hard offset shadow, mono numerals); the *conversation* is soft (rounded, plain-language, green warmth). Green = lead/live accent only; one gold max/screen.
- **Detail-by-surface:** the **scorer** is a lean operator tool (most-tapped options in the thumb zone); **live/spectator + scorecard** carry richer, balanced detail.
- **ICP-first:** casual college/school/ground scorers dominate — structurally hard to mis-score, teaches while scoring, auto-handles the math.
- **Inspiration sources:** the HiFi flow (UX/flow/warmth) + the current mono design (identity/tokens) — synthesised, never copied wholesale.

## Sources
- Cricket exemplar: `docs/plans/2026-07-20-icp-games/cricket/` (`blend-rubric.md`, `cricket-spec-v2.md`, `cricket-waves.md`, mockup HTMLs).
- Current app design + generic scorers: `src/designs/design1-mono/` (mono.css tokens; `GenericSetsTournament`, `GenericGoalsTournament`, `MonoLiveGame`).
- Blend governance: `src/designs/design1-mono/BLEND-GOVERNANCE.md` (FROZEN).
- HiFi: `ScoreEasy App Flow HiFi.dc.html` — not in this repo; the closest in-repo reference is `docs/plans/2026-07-20-icp-games/cricket/hifi-cricket-reference.html`.

## Already shipped on master (reuse, don't rebuild)
Cricket delivery engine (`src/utils/cricketEngine.js`) + guided scorer (`MonoCricketGuidedScorer`), the shared `MonoSheet` bottom sheet, `MonoMatchResult` full-time screen, and live match streaming + watch-link sharing (`convex/live.ts`, `useLiveBroadcast`, `ShareLiveMatch`).

## Status
- [x] Track set up (epic + 7 game issues + folder)
- [x] Per-game design briefs (planning workflow, 2026-07-26) → each `<game>/design-brief.md`
- [x] Cross-game synthesis → `README-synthesis.md` (shared engine + build order + decide-once gaps)
- [x] Deep multi-step design (2026-07-26, wf_ee36664c-8f0): per game research → main-scoreboard → lean scorer → live+innovations → critique/final (6 docs/game) + `README-deep-synthesis.md` (buildable cross-game system)
- [x] Adaptive-system addendum (2026-08-21) → `README-adaptive-system.md` + `all-games-one-wall.html`
- [ ] Lock the 12 cross-game "decide-once" decisions (`README-deep-synthesis.md` §d). Until #4 is locked, per-game docs still name the lean mode differently ("Quick" in volleyball/throwball/basketball/football, "Power" in kabaddi/kho-kho).
- [ ] Per-game mockups (start with the shared SET-engine cluster)
- [ ] Per-game build

# ICP Games — Bespoke Design & Redesign (non-cricket)

**Started:** 2026-07-26 · **Kernel epic:** `98dff2a9` (`ICP games — bespoke design & redesign (non-cricket)`)
**Separate from cricket.** Cricket has its own track (`docs/plans/2026-07-20-icp-games/cricket/`, epic `bb02d4d1`) and is NOT part of this initiative.

## What this is
A dedicated, independently-tracked design initiative to give each shortlisted Indian game the same bespoke treatment cricket got — from the **college / university / grounds ICP lens** — blending **both** the HiFi design language *and* the current mono/brutalist design (best of both), not defaulting to either.

## Games (7)
Kabaddi · Volleyball · Badminton · Football · Basketball · Throwball · Kho-Kho
(Each is a child issue under epic `98dff2a9`, labelled `game:<name>`.)

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
- HiFi: `ScoreEasy App Flow HiFi.dc.html` (distilled via the cricket blend work).

## Status
- [x] Track set up (epic + 7 game issues + folder)
- [x] Per-game design briefs (planning workflow, 2026-07-26) → each `<game>/design-brief.md`
- [x] Cross-game synthesis → `README-synthesis.md` (shared engine + build order + decide-once gaps)
- [x] Deep multi-step design (2026-07-26, wf_ee36664c-8f0): per game research → main-scoreboard → lean scorer → live+innovations → critique/final (6 docs/game) + `README-deep-synthesis.md` (buildable cross-game system)
- [ ] Lock the ~10 cross-game "decide-once" decisions
- [ ] Per-game mockups (start with the shared SET-engine cluster)
- [ ] Per-game build

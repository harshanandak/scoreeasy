# Cricket — build waves (plan of record)

**Date:** 2026-07-25 · **Epic:** Per-game bespoke experience: Cricket (`bb02d4d1`)
**Sources:** `cricket-spec.md` (v1 §7 C1–C13 sequence) · `cricket-spec-v2.md` (Guided/Power decision + 14 engine + 4 UI edge fixes) · this session's mockups (setup / scorer / spectator / shot-tracking).

Goal: **fix everything cricket first**, in dependency-ordered waves. One shared C1 engine underneath; every UI surface is a presentation over it. Waves gate on the prior wave's foundation, work fans out **within** a wave.

---

## Wave map

| Wave | Theme | Issues | Gate |
|---|---|---|---|
| **0** | Decisions lock | 6 blocking open-decisions | none — do first |
| **1** | Engine foundation | **C1a** (core), **C1b** (invariants), C2 | Wave 0 |
| **2** | Scorer + setup | C3, C4, C4b, C4c, C5, C6, C6b, C13 | C1a |
| **3** | Spectator + tracking | C7, C8, C8b, shot-tracking (basic) | C1a, C3, C5 |
| **4** | Signature + viz + match-end | C9, C10, C11, C12 | C7 |
| **future** | Deferred depth | 3 shot-tracking futures, tap-to-place wagon | after basics land |

> **Post-Fable revision (2026-07-25):** C1 split into **C1a** (schema-complete core → unblocks Wave 2) + **C1b** (behavioral invariants → parallel, before C6). Added **C6b** (opening-lineup/innings-break screen), **C4c** (edit-past diff/confirm UI), **C8b** (spectator INFO tab), and 3 Wave-0 decisions (consecutive-over, crests, offline-policy). 28 issues total.

---

## Wave 0 — Decisions lock (unblock the engine) — 6 filed
Resolve before C1a/C6/C7 breadth is fixed:
- **Test-format scope for pilot** — limited-overs only first? *(blocks C1a breadth)* — **leaning: limited-overs first.**
- **Saved-match migration** — cutover new-matches-only w/ legacy read-only shim vs backfill? *(blocks C1a)*
- **`singleBatterRuns` legality** — on-side only? lone batter runs touching both creases? *(blocks C1b last-man)*
- **Consecutive-over prohibition** — enforce (formal) vs ignore (gully)? *(affects C6 bowler picker)*
- **Team crests/logos in header** — crests / initials / neither? *(affects C3/C7)*
- **Offline multi-device conflict policy** — single authoritative device vs op-log merge? *(HARD-gates C7 — resolve by end of Wave 1)*
- Carried, resolve by their wave: win-prob formula+basis (C7/C10), momentum weighting (C11), clutch threshold (C10), DLS compute vs display-only (C7), default-mode-per-preset (C13), rare-dismissal bowler credit (C6), wagon tap-to-place at launch (default **defer**).

## Wave 1 — Engine foundation *(C1 split per Fable)*
- **C1a — Cricket engine CORE: schema-complete model + derivations + strike/undo + migration** · effort L. **Unblocks Wave 2.**
  **Schema-complete so the model never churns:** fold ALL model breadth now — multi-component extra (penalty ⊕ bye/leg-bye), overthrow fields, `completedRuns`, caught-crossed, retire states, penalty target, powerplays. Plus `deriveInnings`/`deriveChase` (sole rate+WP source), strike + legal-ball count, 100-deep undo, **innings-break + target producer**, adapter migration from flat `scores{}`. Tests = §1.2.
- **C1b — Cricket engine INVARIANTS: behavioral edges** · effort M. Parallel with C3/C4/C13; **must land before C6.** Last-man-stands (suppress rotation/over-swap + `singleBatterRuns`), dead-ball/Mankad/short-run, retire hurt/out/rotate + resume, mid-over bowler split-credit, edit-past = replay-forward, illegal-dismissal guard on any no-ball, strike-composition tests.
- **C2 — Cricket blend tokens + governance** · effort S. *(Already merged PR#126 — verify/close, don't rebuild.)*

## Wave 2 — Scorer surface + setup
- **C3 — Scorer hero + context header + ruleset chip + rate line + this-over strip** · M.
- **C4 — Line-divided keypad + pending-extra flow + strike/SWAP** · M.
- **C4b — Mode toggle (Guided default ⇄ Power) + Guided sub-flow shell** · M *(new in v2)*. Guided is the default surface; Power is a one-toggle fast lane; both write the same Delivery.
- **C5 — Batter/bowler cards + partnership + foreshadow + last-man layout** · M.
- **C4c — Edit-past delivery: replay-forward diff/confirm UI** · M *(added per Fable)*. UI over the C1b replay engine: pick past ball → edit → show re-derived diff → confirm. Distinct from LIFO undo.
- **C6 — Wicket sheet + FoW + free-hit guard + run-out end + new-batter + end-of-over** · M. Folds **UI fixes 15–17**: completed-runs capture in Power too, armed WD/NB → stumping/run-out branch, MORE quick-actions (dead-ball/Mankad/short-run/penalty/retire/resume). **UI fix 18** powerplay chip → C3 hero.
- **C6b — Opening-lineup + innings-break handoff screen** · M *(added per Fable — was orphaned)*. Pick opening pair + bowler at match start AND at the innings break (finalize → target → swap → arm innings 2). Reuses C6 pickers.
- **C13 — Format/config UI: tennis-ball & box & gully presets + house-rule toggles at setup** · M. **First-at-bat in Wave 2** (scorer testing needs a configured match; couples to C4b via default-mode-per-preset). Mockup built: `cricket-match-setup.html` (incl. ground shape + rough dimensions + track-shots toggle).

*Mockups already covering this wave: `cricket-match-setup.html` (C13), `cricket-scorer-alt-big5.html` (C3/C4/C4b).*

## Wave 3 — Spectator + scorecard + basic tracking
- **C7 — Spectator LIVE tab** · L. Freshness heartbeat, hero, this-over, WP bar+basis, mini-cards, Convex subscription.
- **C8 — Spectator SCORECARD + COMMENTARY** · M. Itemized extras + FoW; shared `dismissalText()`.
- **C8b — Spectator INFO tab** · S *(added per Fable)*. Teams, venue, toss, officials, format/house-rules summary.
- **Cricket: optional shot tracking (wagon wheel)** *(already filed, P2)* — basic on-demand tap-to-place capture feeding batter wagon wheel; ground shape/size read from C13 setup. Mockup: `cricket-shot-tracking.html`.

*Mockups already covering this wave: `cricket-spectator-clean.html` (C7/C8), `cricket-shot-tracking.html`.*

## Wave 4 — Signature moments + viz + match-end
- **C9 — Signature layer 4.0–4.2** · M. Score pop, tiered four/six, wicket takeover; reduced-motion gated.
- **C10 — Signature layer 4.3–4.5** · M. Milestone gold + share card (one-gold enforced), hat-trick, clutch off `deriveChase()`.
- **C11 — Momentum band + viz modules** · L. Pressure line + worm/manhattan/wagon/partnership, one open at a time. (Wagon module consumes shot-tracking data.)
- **C12 — Super Over + Match Complete + notifications** · M. Reuse `MonoMatchResult`/`Share`.

## Wave future — deferred depth
- Shot **animation playback** on spectator live feed *(filed P3)*.
- **Bowler tracking / pitch-map** input *(filed P3)*.
- **Accurate ground dimensions + shot-type classification** *(filed P3)*.
- Power-mode **tap-to-place wagon** enrichment at launch (open decision #5, default defer).

---

## Dependencies (dep add X Y = X depends on Y)
```
C1b → C1a
C3 → C1a, C2     C4 → C1a, C3     C4b → C4      C4c → C1b, C4
C5 → C1a, C3     C6 → C1a, C1b, C4   C6b → C1a, C6   C13 → C1a
C7 → C1a, C3, C5   C8 → C7    C8b → C7
C9 → C1a, C3, C7   C10 → C9
C11 → C1a, C7, shot-tracking(basic)     C12 → C9
shot-tracking(basic) → C1a, C4, C13
```
*(Everything that gated on C1 now gates on C1a — the same kernel issue, renamed. C1b is the only new hard gate, in front of C6.)*

## Shared primitives (owned outside cricket — gate each PR on availability)
`MonoSheet` (done), `blend-tokens` (frozen), `line-divided-keypad`, `cricketCalculations`, `Convex-live-sync`, match-result trio `MonoMatchResult`/`Scorecard`/`ShareLiveMatch`.

## Governance
Blend rubric FROZEN (`BLEND-GOVERNANCE.md`): record is brutalist, conversation is soft; green = lead/live only, one gold/screen, capsules interactive-only, pulse live+reduced-motion-gated. Detail-by-surface: scorer lean, spectator/scorecard richer.

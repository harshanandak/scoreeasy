# Cricket Blend — FINAL Synthesis (Fable lock)

**Date:** 2026-07-25 · **Status:** LOCKED visual direction for build
**Inputs:** `blend-rubric.md` (the contract), `cricket-ux-guided-v2.html` + `cricket-ux-keypad-v2.html` (shipping pair), `cricket-ux-zones-v2.html` (reference-only), `cricket-spec-v2.md` (UX decision), `src/designs/design1-mono/BLEND-GOVERNANCE.md` (master @ `bce10be` — **not present on `feat/prototype-redesign`**, see §5).

---

## 1. Verdict — APPROVED, the blend is right

**Brutalist bones + friendly flesh is now real in both shipping mockups, not aspirational.** Checked line-by-line against the rubric:

- **One frame, one hard shadow, on the shell only.** Guided `.device` and Power `.sheet` each carry the single ink border + `--se-shadow-hard`; every interior separation is a 16–22% hairline. Nothing inside repeats the frame. ✓
- **The record stayed hard.** Mono `tabular-nums` everywhere a quantity lives (score, CRR/RRR, figures `3.2 – 0 – 24 – 2`, extras `12 (b3 lb2 wd6 nb1)`, over stamps). 26px record chips with all six slots always rendered, dashed unbowled cells, semantic fills. Hard squarer-than-pill status stamps (`Out`, `Wd`, `W`). 3px striker rail. Fixed shared grid columns so figures actually columnise. ≤3-word tracked mono eyebrows. ✓
- **The conversation went soft.** Decision states are full screens on a warm-shifted canvas (Guided v2 even deepened it with a warning mix — modality you *feel*, no scrim, no modal). Hero pinned through every question. Tinted inline banner + hard badge + sentence-case sentence with the subject bolded. Capsule option pills / teaching option rows with plain-English glosses ("Bowler overstepped — next ball is a free hit"). Confirmation-echo card that does the math for you ("147 → 148 … You never do the math"). Footer = outline ✕ Cancel + outcome-naming filled CTA carrying the screen's one glow (`Add · wide + 4 = 5`, `Confirm → new batter`). ✓
- **Warm enough for a gully scorer.** The v2 refinements are precisely the humane ones: coherent 17.2/17.3 scoreline (no gaslighting the novice), one undo affordance that *names what it removes* ("removes the 3 wide"), 9px minimum captions at ink-muted (not faint), jargon expanded ("T20 · 6-ball overs · LBW enabled"), narration that teaches the re-bowl rule, "Tapped Wicket by mistake? Nothing has been saved yet." This reads like a patient friend holding a very precise ledger — exactly the brief.
- **Still unmistakably ours.** Budgets hold on every surface: one glow (CTA), one pulse (LIVE dot), one gold (milestone card, which wears the 2px gold + 3px 3px 0 ink frame), one inversion, ~3 soft surfaces on spectator. Scarcity on both sides is what preserves identity, and it survived the softening.

Power v2's judgment calls are endorsed: score weight 600 for sun-glare (usability tie-breaker beats the "~500" guide — the rubric's own tie-breaker authorizes this), 22% key dividers, 54px danger-soft wicket key (solid danger still reserved for confirm), extras as ghost chips one tier down, armed state with ring + ghosted siblings + live arithmetic in the CTA.

## 2. Remaining gaps (small, none blocks the lock)

1. **Token forks between the two files — the only real defect.** Same token names, three different definitions across guided-v2 / keypad-v2 / master governance: `--se-blend-green-wash` (action 11% into surface vs action-soft 46% into surface vs raw `#e7f4ee`), `--se-blend-gold`(+`-bright`) (warning-derived vs standalone oklch vs `#b8862e`), `--se-shadow-hard` (pure offset vs offset+blur hsl), soft/CTA shadow recipes, `ink-faint` derivation. **Resolution: promote ONE canonical `--se-blend-*` block into `src/index.css` before C4 (use keypad-v2's derived-from-palette recipes as the base — zero raw hex — plus guided-v2's `gold-ink`), and both mockups become consumers.** This is a build task, not a redesign.
2. **Spectator hero grammar differs by file.** Guided spectator leads with `147/4 (17.2)`; Power spectator leads with a giant `23 off 16`. Spectator is ONE shared surface, not per-mode. **Decision: score-first (`147/4`) is canonical, chase equation in the satellite slot** — the score is the record; the equation is derived. (Power's chase-first stays in the file as an exploration, not shipped.)
3. **Striker-row green.** Keypad-v2 adds a green-wash fill under the 3px rail; governance rule 1 says green is never a resting fill. **Decision: rail-only (guided's treatment) is canonical.**
4. **Wicket record chip.** Guided `W` = solid danger inverted; Power `W` = danger-soft + danger text. Rubric permits either; **decision: solid danger inverted** — a wicket is the record's loudest stamp.
5. **Power's `More…` pill is ink-inverted**, silently spending the screen's one inversion on a low-value control. Use guided's dashed-ghost "More ways out…" grammar instead.
6. Cosmetics: dead `.sq` rule in guided-v2 (harmless); `--se-color-focus-ring` removal belongs in `src/index.css` (correctly skipped in the mockup mirror).

## 3. FINAL locked cricket visual direction

**One system, two densities.** Both modes are presentation layers over the same `Delivery` + the same visual grammar; the *only* axis that changes with the mode toggle is **how many questions live on one screen**.

- **Guided (default):** the conversational surface. Chrome triptych + chase band + soft-staged hero + over strip + batter/bowler table, then ONE question at a time ("Runs off the bat?" → 6-key grid; Extra/Wicket as ghost/outline-danger branch rows), full-screen warm-canvas sub-flows with pinned mini-hero, teaching option rows, echo card, outcome CTA. Narration band after every ball. Single full-width undo naming its target.
- **Power (toggle):** the same screen anatomy compressed to one board: persistent extras ghost-row (armed = solid action + ring + ghosted siblings + banner + teaching line), 4-wide 0–7+ run grid with hairline dividers, danger-soft W + swap bar, undo square + live-arithmetic CTA. Decision screens (how-out) are *identical* to Guided's — complexity never gets compressed, only frequency does.
- **Shared verbatim between modes and views:** shell frame, hero (mono 600 numeral on green-wash soft stage, capsule idchip, 4px chase capsule, hairline, mono micro-strip), record chips, stamps, table grammar, echo card, help container (dashed warm, sentence-case ≥11.5px), gold milestone card (the sanctioned second hard anchor), spectator surface (soft interiors, capsule tabs/reactions, presence in chrome, budget-enforced).
- **Floors locked by v2:** captions ≥9px at ink-muted; real figures never ink-faint; help ≥11.5px/1.35; touch ≥44px; score numeral weight 600; key dividers at 22%; reduced-motion kills every animation.

## 4. Propagation to the other Tier-0 games

The rubric's principle — **"the record is brutalist; the conversation is soft"** — and all nine element classes are sport-agnostic. Per-game workflows inherit the contract and fill ONLY a three-part **sport delta sheet**:

1. **Record-chip instantiation** (what the over strip becomes): volleyball/throwball → current-set rally strip (serve marker, side-out, timeout chip); badminton → rally strip per game (server box, interval stamp); kabaddi → raid strip (raid pts, bonus, tackle, all-out inverted like `W`); football → event timeline chips (goal = boundary grammar, card = danger stamp, sub = extra grammar); basketball → quarter run-strip (2/3/FT chips, foul = warning grammar); kho-kho → turn/chase strip (touch, dream-run). Same 26px cells, hairline, semantic fill, dashed future slots, always fully rendered.
2. **The guided question tree** (the sport's event taxonomy): kabaddi "Raid result?" → points/tackle/bonus; volleyball "Rally won by?" → reason (ace/block/error); football "What happened?" → goal/card/sub. Each answer screen reuses the cricket decision-screen pattern *verbatim*: warm canvas, pinned hero, banner + stamp, option rows with plain-English glosses, echo card, outcome CTA.
3. **The derived band** (cricket's chase equation): set/match point band, raid-to-all-out countdown, bonus-ball state, foul-trouble band — always a surface-warm band under the chrome, escalated by warning/danger-soft, never glow.

Everything else — shell, hero anatomy, keypad grammar (frequency-ordered: common outcome = 1 tap, consequential = branch), stamps, tables, echo, gold, spectator budget, help voice, all floors and budgets — **inherits without re-deciding**. Mechanism: (a) copy `blend-rubric.md` up one level to `docs/plans/2026-07-20-icp-games/blend-rubric-core.md` with cricket-specific nouns generalized; (b) each game's workflow prompt is briefed as "instantiate the delta sheet against guided-v2/keypad-v2 as skeletons; treatments are closed questions"; (c) any proposed deviation must cite the tie-breaker ("does a novice read or tap it under pressure?") and survive the budget check — otherwise it's a defect, not a design choice.

## 5. Doc updates required

### `src/designs/design1-mono/BLEND-GOVERNANCE.md`
0. **It is missing from the working branch.** Exists only on `origin/master` (`bce10be`); `feat/prototype-redesign` has no copy, yet `cricket-spec-v2.md` cites it as FROZEN. Merge/rebase master in (or cherry-pick) before any C4 work.
1. Replace raw hex token values (`#e7f4ee`, `#b8862e`, rgba shadows) with the palette-derived `color-mix`/oklch recipes settled in v2 — the contract itself should obey "never hardcode hex".
2. Add the tokens v2 proved out: `--se-blend-hairline` / `-strong` (16%/22% interior separation), `--se-blend-gold-ink`, `--se-blend-shadow-tier1`, `--se-blend-ring`, `--se-blend-shadow-cta` (glow semantics: max one per screen, CTA only).
3. Amend rule 4 with the three sanctioned exceptions now canonical: hero = soft stage with NO own border/hard shadow inside the hard shell; the gold milestone card carries 2px gold border + `3px 3px 0` ink shadow as the ONE sanctioned second hard anchor; decision modality = canvas warm shift (optionally deepened with a warning mix), never a scrim or modal.
4. Codify the full budget line: per screen ≤1 hard frame (shell), ≤1 CTA glow, ≤1 inversion, ≤1 gold, ≤1 live pulse, ~3 soft surfaces.
5. Clarify rule 1 for identity anchors: striker/active-entity marking = 3px action rail only; green wash is a stage for the hero, never a row fill.

### `docs/plans/2026-07-20-icp-games/cricket/cricket-spec-v2.md`
1. §B: repoint canonical mockups to the v2 files — `cricket-ux-guided-v2.html` (default), `cricket-ux-keypad-v2.html` (power), `cricket-ux-zones-v2.html` (wagon-layer reference only) — and add `blend-rubric.md` + this doc as the visual authority alongside BLEND-GOVERNANCE.
2. §C/§D build notes: add a C4 pre-task — promote the canonical `--se-blend-*` block into `src/index.css` (gap #1) and remove `--se-color-focus-ring` there if truly unused; note the locked floors (score weight 600, captions ≥9px ink-muted, 22% dividers, single named undo, coherent ball-number state 17.2/17.3).
3. §B: record the spectator-hero decision (score-first, chase in satellite) and the striker rail-only rule so C4 doesn't re-open them.

---

**Bottom line:** the two v2 surfaces pass the rubric on every hard cue and every soft cue; the remaining work is unification (one token block, one spectator grammar, three micro-decisions recorded above), not design. Lock it and build.

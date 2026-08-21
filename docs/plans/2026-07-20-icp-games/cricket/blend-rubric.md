# THE BLEND RUBRIC — where brutalism rules, where softness takes over

**Status:** Decision rubric for the HiFi × brutalist blend (cricket-first, all sports inherit).
**Upstream contract:** `src/designs/design1-mono/BLEND-GOVERNANCE.md` (FROZEN) — its 6 rules are
law; this rubric tells a build agent how to apply them per element class without re-deciding.
**Palette:** ONLY `--se-*` and `--se-blend-*` tokens from `src/index.css`. No raw hex, ever.

---

## The principle

> **THE RECORD IS BRUTALIST. THE CONVERSATION IS SOFT.**

Everything that *is the match record* — the frame, the numerals, the over strip, the figures,
the status stamps — keeps hard mono precision. That precision is the identity: digits that
don't jitter, chips you can read at a gully ground, a scorebook you trust.

Everything that *talks to a human* — decision flows, guidance, errors, help, celebration,
spectating — goes soft: sentence-case sans, soft radius, tinted surfaces, plain English that
echoes your choice back before you commit.

When one element is both (the keypad, the hero, a scorecard), it gets a **hard skeleton under
a soft skin** — brutalist geometry and mono figures inside, soft container and ergonomics
outside. Never the reverse: a soft skeleton with hard decoration is dilution.

**Shorthand for build agents:** *If an eye reads a fact off it → hard. If a thumb lands on it
or a heart reacts to it → soft. Both → hard skeleton, soft skin.*

---

## Per-screen hardness budget (enforced, not vibes)

Per screen, exactly:
- **1** hard offset shadow (`--se-shadow-hard`, `3px 3px 0`) — on the outermost shell ONLY
- **1** hard `--se-border-standard` ink frame — same shell (never nested hard-in-hard)
- **≤3** soft surfaces (`--se-blend-radius-soft*` + `--se-blend-shadow-soft` / green wash)
- **≤1** gold accent (`--se-blend-gold*`) — governance rule 2
- **≤1** glow (`--se-blend-shadow-cta`) — on the primary CTA only
- **≤1** inverted element (`--se-color-ink` fill / `--se-color-inverse` text) — emphasis loses
  its punch the second time
- **≤1** live pulse (`.se-blend-pulse`) — genuinely live only, reduced-motion gated

Interior separation everywhere else: hairlines at reduced opacity
(`color-mix(in oklch, var(--se-color-line) 16–22%, transparent)`), never full-strength rules
stacked into a barcode.

---

## Typography law (applies across every class)

- **Every quantity is mono** (`--se-font-mono`, `font-variant-numeric: tabular-nums`): scores,
  overs, rates, figures, timestamps. Non-negotiable. **Every word is sans** (`--se-font-sans`).
- **Uppercase-mono is a LABEL voice only:** ≤3 words, ≥10px, tracked eyebrows (THIS OVER,
  LIVE, BOWLER, PLAYER OF THE MATCH). The moment it carries a sentence, venue, toss line,
  extras breakdown or a person's name, it becomes sentence-case sans ≥11px.
- **Player names: sans, sentence case, ≥12px. Never uppercase a human.**
- **Type floor 10.5px**, two sizes per data block max (12px primary / 10.5px secondary).
- **De-emphasis by ink-tier and size, not new hues:** big numbers light, tiny labels heavy;
  wickets in `/3` at ~55% size in `--se-color-ink-muted`; superseded rows at reduced opacity.
- **Escalation ladder (the only state encoding):** neutral = surface + ink → attention =
  `--se-color-warning-soft` + `--se-color-warning` → critical = `--se-color-danger-soft` +
  `--se-color-danger` → emphasis = inversion. Never a new colour, never a glow, never a
  text-shadow.

---

## The rubric — element class by element class

### 1. Page chrome / frame (shell, header, canvas) — **BRUTALIST**

**Why:** the shell is the identity and costs nothing in usability (audit: "maximum identity,
zero usability cost"). This is where the brand lives.

**Treatment:**
- Outermost shell: `--se-border-standard` in `--se-color-line-strong` + `--se-shadow-hard`.
  This is the screen's ONE hard border and ONE offset shadow. Nothing inside may repeat it.
- Canvas `--se-color-canvas`; decision states shift the canvas to `--se-color-surface-warm`
  (modality signalled by the canvas itself, never a scrim).
- Header triptych: glyph button / centred two-line title / glyph button. Title 13px sans 700
  `--se-color-ink-strong`; **persistent context subtitle** in mono ~9.5–10px tracked
  `--se-color-ink-faint` ("T20 · OVER 4.2 · CHASING 157") — the chrome always knows the match
  state. Live screens: 5px pulsing dot (`.se-blend-pulse`, danger colour) + LIVE label.
- Icon buttons: compact squares, `--se-radius-button`, 1px `--se-color-line` border, no fill,
  **no offset shadow** — chrome must not compete with controls for weight.
- One spacing rhythm: fixed side gutter, all control bands on the same 8px vertical pitch.
- Interior section separation: 16–22% hairlines only. Never nest a hard-shadowed box inside
  the hard shell (kills the zones triple-frame failure).

### 2. Score hero + numerals — **HYBRID** (brutalist number, soft stage)

**Why:** the number is the purest record in the app (mono tabular at display size is exactly
what brutalism is for); but the hero is also the emotional centre and the thing that stays
pinned through every decision — its *container* earns the soft treatment.

**Treatment:**
- Numerals: mono tabular-nums, display size, weight ~500 (big numbers LIGHT), tight
  line-height. Runs in `--se-color-ink-strong`; `/wickets` nested ~55% size in
  `--se-color-ink-muted`; `(ov)` small mono in `--se-color-ink-faint`. Pair with the existing
  score-pop animation.
- Container: `--se-blend-green-wash` (governance rule 1: the live/lead surface),
  `--se-blend-radius-soft-lg`, `--se-blend-shadow-soft`. **NO hard border, NO hard shadow of
  its own** — rule 4 says the shell is already hard; the zones hero (wash + border + hard
  shadow) is the named violation.
- Strata (HiFi anatomy, our tokens): identity chip w/ crest squircle → score line + CRR →
  4px capsule chase-progress bar → 18–22% hairline → derived-stats micro-strip (NEED / RRR /
  P'SHIP: labels 8.5–9px 800 tracked ink-faint, values mono 600 ink-strong).
- Satellite labels floor 11px; team/context line sentence-case sans (never a 30-char all-caps
  mono string).
- Chase equation gets its **own full-bleed band** under the header when chasing: surface-warm
  fill, hairline top/bottom, mono text; escalate by state via the ladder (warning-soft when
  RRR ≫ CRR, danger-soft at last-over/last-wicket). Hidden in the first innings.
- Hero is `flex:none`, pinned through every decision screen. Spectator variant may invert
  (the screen's single inversion).

### 3. Scoring controls (keypad, extras, undo, primary CTA) — **HYBRID** (hard grid, soft keys)

**Why:** a machine you operate under pressure. The grid, the mono digits and the weight ladder
are brutalist; the touch surfaces are ergonomic and calm. The audit is unambiguous: keypad's
borderless keys are "the single best blend decision in the set"; guided's 15 hard-shadowed
buttons are the worst.

**Treatment:**
- **Keys are borderless:** hairline dividers between cells (no per-key border, no per-key
  offset shadow — matches shipped `.mono-btn { box-shadow:none }`). Min-height
  `clamp(58px, 11vh, 74px)`; pad is `flex:1` in a non-scrolling `100dvh` column so keys stay
  thumb-reachable.
- Every key: mono numeral ~20–26px + tiny 8px/800 tracked mono caption (FOUR / SIX / DOT) in
  `--se-color-ink-faint`.
- **4 and 6 promoted:** `--se-color-action-soft` fill, `--se-color-action` digit — the only
  tinted keys.
- **Weight descends with frequency:** runs grid → OUT + ⇄ Strike row → extras row (shorter
  ghost chips: no fill, 1px `--se-color-line`, mono label in ink-muted, no shadow) → undo +
  primary. Extras qualify a ball, they don't score it — they must LOOK one tier down.
- **WICKET:** outline-danger at rest (`--se-color-danger` border + text on surface); solid
  `--se-color-danger` only for the confirmed-dismissal state. Never a full-bleed red slab —
  red-solid at rest reads "delete".
- **Undo:** permanently visible square beside the primary; `--se-color-surface-warm` fill, no
  border drama, ink glyph. Never buried.
- **Primary CTA:** the screen's one glow — `--se-color-action` fill, `--se-color-inverse`
  label, `--se-blend-shadow-cta`, `--se-blend-radius-soft`. Label names the OUTCOME
  ("End innings ⋯", "Add · No-ball + 4 = 5"), not the verb.
- **Armed/held state (long-press extras):** held chip goes solid action + 3px
  `--se-color-focus-ring` ring; siblings ghost to ink-faint/line at reduced opacity; grid
  reflows; CTA becomes live arithmetic. A full-screen mode change, not a modal.
- `:active` on any key: translate 1–2px + collapse to `--se-shadow-card` over
  `--se-motion-standard`. That press physics is the only motion controls get.

### 4. Chips, badges, ball strip, segmented controls — **BRUTALIST** (three fixed grammars)

**Why:** these are the record's notation system — the audit calls the over-strip chip "the
best small component in the set". Precision and consistency ARE the friendliness here. The
grammar split is what makes tappable vs readable unambiguous.

**Treatment — exactly three grammars, never mixed:**
1. **Selection pills (tappable):** `--se-blend-radius-capsule` (rule 3: interactive only),
   padding ~8px 13px. Selected = `--se-color-action` fill + inverse text + appended ✓;
   unselected = surface + 1px `--se-color-line-strong` border. Used for dismissal options,
   batter picks, reaction pills.
2. **Status badges (read-only stamps):** hard small rectangles, `--se-radius-button`, solid
   fill (`--se-color-danger` "OUT", `--se-color-action` "Nb"), inverse text 10–11px/800.
   Deliberately squarer than pills so they read as labels, not buttons.
3. **Outcome/record chips (the over strip):** 26px circles/squircles radius ~10px, 1px
   hairline, mono numeral, semantic fill — boundary = `--se-color-action-soft` +
   action-coloured digit, wicket = inverted or danger-soft + danger digit, ordinary = plain
   surface, **unbowled = dashed 1px `--se-color-line` empty cell, always rendering all six
   slots** (the over's shape is visible at a glance and it doubles as progress).
- Segmented control (spectator tabs, on-strike): soft track (`--se-color-surface-warm`,
  radius 12px, padding 2px) + white thumb (radius 10px, `--se-shadow-card`). A capsule is
  never also a bordered grid cell — pick one language.
- Team crests: 14–22px squircles (radius 5–7px), single initial 8–10px/800 inverse on the
  team accent.

### 5. Sheets / dialogs / decision screens — **HIFI-SOFT**

**Why:** this is the conversation itself. The HiFi's biggest structural idea — no modals, no
scrims, the score hero never leaves the screen — is adopted wholesale. Hardness here is where
"cold and unfriendly" lives.

**Treatment:**
- Every question (how out?, new batter, extras+runs, toss) is a **full screen**: pinned hero →
  this-over strip → inline context banner → eyebrow naming the decision (NEW BATTER IN ·
  PICK #5) → wrapping selection-pill row → secondary refinements inline → footer.
- Canvas shifts to `--se-color-surface-warm` to signal modality. No overlay, no scrim.
- **Inline context banner (replaces dialogs everywhere):** `--se-blend-radius-soft`, tinted
  fill, padding ~9px 11px, containing a hard grammar-2 badge + a sentence-case sans sentence
  with the subject bolded ("**R. Sharma is out** — how was the batter dismissed?"). Danger
  version = danger-soft/danger; success = action-soft/action; settled = surface-warm/ink-soft.
- **Never green behind a dismissal** — the wicket flow sits on `--se-color-danger-soft` or
  plain surface (governance rule 1; the keypad `.qsheet` green wash is the named violation).
- Footer pair, always: fixed-width outline "✕ Cancel" + flex-1 filled primary whose label
  states the outcome ("Confirm → new batter", "Start match →").
- **Confirmation-echo:** after any multi-part choice, restate it in plain English in an
  `--se-color-action-soft` card with the variables bolded, before the CTA.
- If a true bottom sheet is ever needed: soft top radius (`--se-blend-radius-soft-lg`),
  `--se-blend-shadow-soft`, neutral surface, and a single 1px hard top hairline as its only
  brutalist cue.

### 6. Feedback / celebration / end-of-match — **HIFI-SOFT** (with one brutalist anchor)

**Why:** celebration is where hardness costs the most and where the HiFi spends its largest
single investment. Nothing in our app currently rewards finishing a match. But the moment must
still belong to THIS app — hence the anchor.

**Treatment:**
- **The gold milestone card is the pattern** (guided's fifty card): 2px `--se-blend-gold`
  border + `3px 3px 0` ink shadow as the brutalist anchor, soft gold radial interior via
  `--se-blend-gold-bright` at low alpha, non-blocking. Exactly ONE gold per screen (rule 2).
- Voice split inside any celebratory surface: the **human sentence in sans, sentence case,
  large and warm** ("Great knock — off just 32 balls."); the **figures line in mono**
  ("50 (32) · SR 156"). Never an uppercase-mono headline — a celebration must not read like a
  till receipt.
- Result moment is a designed peak: eyebrow (mono tracked label), headline (sans 800,
  negative tracking), margin-of-victory subline in plain language ("by 4 wickets · with 2
  balls to spare"), both innings in mono with the loser at reduced opacity, POTM card, 3-up
  stat tiles (mono value / 9px caption), rivalry line, paired CTA (outline "Share ↗" + filled
  "Rematch ↻" with the CTA glow), and a muted text-only escape ("Done for today").
- **No dark full-bleed takeovers, no inset glows, no 74px pulsing letters** — off-system.
- In-flow feedback = the inline banner (class 5) + recency decay (superseded rows at reduced
  opacity). Pulse stays reserved for live.
- Never render spec/annotation language on a surface.

### 7. Data tables / scorecard / ball-by-ball — **HYBRID** (brutalist grid, soft container)

**Why:** mono's entire advantage is columnisation — that discipline is brutalist. But a 1px
black cage + hard shadow around a dense table turns it into a barcode; the container softens
so the density can breathe.

**Treatment:**
- Container: `--se-color-surface` card, `--se-radius-card`, `--se-shadow-card` (or a 22%
  hairline border) — never a full-ink border + offset shadow around a table.
- **Fixed CSS grid** (`grid-template-columns: 1fr 24px 24px 20px 20px`-style, shared across
  every row) so R/B/4s/6s columnise vertically. Header row: mono ~9px tracked uppercase
  `--se-color-ink-faint` with a hairline bottom border (spectator/scorecard views; omit in
  the scorer where space is tight).
- Names sans 600 sentence-case ≥12px; PRIMARY figure mono 700 `--se-color-ink-strong`; all
  secondary figures mono `--se-color-ink-muted`. Two sizes max, floor 10.5px. Status riders
  inline ("not out") in ink-faint.
- **Striker rail: 3px `--se-color-action` left border** — identity anchor; one hard cue that
  outworks four type sizes. Bowler row differentiated by `--se-color-surface-warm` fill (or,
  at most, the screen's single inversion as a thin bar).
- Canonical compressed notation: "3.2 – 0 – 24 – 1", extras "9 (nb2 w4 b3)", fall of wickets
  as one 11px sentence.
- Ball-by-ball: signal by ELEVATION, not zebra — notable balls are white soft-radius cards
  with a grammar-3 outcome chip; ordinary balls are bare rows with no background.
- Momentum viz: CSS-only bars (radius 2px 2px 0 0), encoded line/action/danger/surface-warm,
  explained by an eyebrow + mono caption; legend dots coloured to their markers. No axes, no
  library.
- Every summary list ends with an outline drill-in CTA ("Full scorecard ›").

### 8. Empty / help / learning / error states — **HIFI-SOFT** (zero exceptions)

**Why:** this is where "a gully scorer can't mis-score" is actually won. The audit's
friendliest element in all three mockups (guided's dashed banner) is deliberately
un-brutalist. Rule with no carve-outs — even the help about tapping.

**Treatment:**
- All teaching, explanatory, empty-state and error copy: **sentence-case sans ≥11.5px,
  line-height ≥1.35**, inside a dashed-hairline `--se-color-surface-warm` container
  (`--se-blend-radius-soft`), no offset shadow, no uppercase, no mono except inline figures.
- Voice: second person, instructive, echoes what happened and says what to do next ("Ball
  recorded: 3 wide → +3 to Mumbai. This ball doesn't count — re-bowl.").
- Jargon is translated inline for novices ("keeper/ball too far, batter couldn't reach it");
  ruleset chips get a plain-English expansion on tap, they don't shout "LBW ON" unexplained.

### 9. Spectator view — **HIFI-SOFT** (hard shell only)

**Why:** lean-back, emotional, shareable; the viewer operates nothing, so machine-precision
signalling buys nothing and harshness costs everything. Scorer = broadcast console (hybrid);
spectator = the broadcast (soft).

**Treatment:**
- Keep ONLY the outer hard shell. Every interior full-black rule becomes a 16–22% hairline;
  every per-section hard border is deleted.
- Hero: `--se-blend-green-wash` + `--se-blend-shadow-soft` (may take the screen's single
  inversion for the drama variant). Momentum band on surface-warm with soft radius.
- Tabs: capsule pills, one language, no dividers, thumb per class-4 segmented spec.
- Presence and reactions first-class: viewer count in the chrome, capsule reaction pills
  (emoji + mono count), Following pill. Live pulse on the LIVE dot only.
- Read-only over strip and key moments reuse classes 4 and 7 verbatim.
- Soft-element budget enforced explicitly here (≈3 soft surfaces + 1 gold + 1 live) — this
  is the screen most tempted to dissolve.

---

## Identity anchors — what must NEVER lose brutalism

1. The outer shell: exactly one `--se-border-standard` ink frame + one `--se-shadow-hard`
   per screen, on the outermost container.
2. Mono tabular numerals for every quantity — score, overs, rates, figures, timestamps.
3. The over-strip record chips: 26px, ~10px radius, hairline, semantic fill, dashed
   unbowled slots — the scorebook's own row.
4. The 3px `--se-color-action` striker rail.
5. The uppercase-mono label voice: ≤3-word tracked eyebrows at ≥10px (THIS OVER, LIVE,
   BOWLER).
6. Hard solid status badges (OUT / Nb / W stamps) — squarer than pills, read-only.
7. Fixed-grid columnised figures in every table — mono aligns or it isn't mono.
8. The single inverted-ink emphasis element (max one per screen).
9. The gold milestone card's 2px gold border + `3px 3px 0` ink shadow — celebration still
   wears the app's frame.

## Always soft — no exceptions

1. Touch targets: ≥44px, borderless keys or capsules, never stacked hard borders + offset
   shadows on in-flow controls (shipped `.mono-btn` baseline stands).
2. Decision screens and sheets: soft radius, tinted inline banners, capsule option pills,
   canvas shift, outcome-naming CTAs, confirmation echo.
3. All guidance/help/empty/error/teaching copy: sentence-case sans ≥11.5px, dashed-hairline
   warm container.
4. Celebration interiors and every human sentence (mono only for the figures line).
5. The primary CTA: filled action + `--se-blend-shadow-cta` glow — the one glow.
6. Spectator interiors (hairlines, soft cards, capsule tabs).
7. Player names: sans, sentence case, ≥12px — never uppercase a human.
8. Feedback motion: press physics + one live pulse; both `--se-motion-standard` /
   reduced-motion gated. Nothing decorative ever moves.

## Tie-breaker

When record and conversation collide on one element:

1. **Split it, don't average it: hard skeleton, soft skin.** Keep the mono figures, the
   semantic chip, the fixed grid, the hard stamp; soften the container, the copy and the
   touch surface. (Hero, keypad and scorecard above are this rule applied.)
2. If it genuinely can't be split, ask: **does a novice read or tap this under match
   pressure?** Yes → err SOFT (comprehension and thumb-safety outrank identity on any single
   element). No — it's a glanced fact for the scorer → err HARD.
3. Budgets always win. If softening would exceed the per-screen soft budget, or hardening
   would add a second offset shadow / gold / glow / inversion, the budget decides — remove
   or demote something else first. Identity is preserved by scarcity on both sides.

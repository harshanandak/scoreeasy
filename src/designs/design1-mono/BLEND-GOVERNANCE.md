# BLEND-GOVERNANCE — HiFi-blend token contract

**Status:** FROZEN (M1 foundation, kernel issue `blend-design-tokens-blend-8a30cb91`).
**Scope:** the additive HiFi-blend token layer defined in `src/index.css` (the
`--se-blend-*` custom properties, the `se-blend-pulse` keyframes, and the
`.se-blend-pulse` helper). The brutalist Mono tokens are unchanged and remain the
backbone; blend is a controlled overlay, not a replacement.

Every downstream screen that uses a `--se-blend-*` token MUST obey the rules
below. They exist so the app reads as one deliberate system — a hard brutalist
shell with selective soft, live, and celebratory moments — instead of a soft
theme that has dissolved its own structure.

---

## The tokens

| Token | Value | Purpose |
|---|---|---|
| `--se-blend-radius-capsule` | `999px` | Pill/capsule for interactive elements |
| `--se-blend-radius-circle` | `50%` | Circular interactive elements (avatars, icon buttons) |
| `--se-blend-radius-soft-sm` | `10px` | Soft content radius (small) |
| `--se-blend-radius-soft` | `12px` | Soft content radius (default) |
| `--se-blend-radius-soft-lg` | `16px` | Soft content radius (large) |
| `--se-blend-green-wash` | `#e7f4ee` | Soft green surface for lead/live content |
| `--se-blend-green-wash-strong` | `#d6ecdf` | Deeper green wash for emphasis |
| `--se-blend-shadow-soft` | `0 6px 20px -8px rgba(20,40,30,.28)` | Warm-green-black soft shadow for content |
| `--se-blend-shadow-cta` | `0 8px 24px -6px rgba(35,120,75,.42)` | Colored/glow shadow for the primary CTA |
| `--se-blend-gold` | `#b8862e` | Gold milestone accent (base) |
| `--se-blend-gold-bright` | `#e8b64c` | Gold milestone accent (highlight) |
| `--se-blend-pulse-duration` | `2.4s` | Breathing-pulse cycle length |
| `@keyframes se-blend-pulse` / `.se-blend-pulse` | — | LIVE breathing pulse + helper (reduced-motion gated) |

---

## The contract

1. **Green = lead / live only.** The soft green wash and green accents mark the
   leading team, a live badge, or the active/primary action. Green is never a
   resting-state fill or generic decoration.

2. **Gold = ONE milestone accent per screen.** Gold marks a single celebratory
   moment (match won, a record, podium placement). More than one gold accent on
   a screen is a defect.

3. **Capsules & circles = interactive elements only.** Use `--se-blend-radius-capsule`
   and `--se-blend-radius-circle` on buttons, chips, toggles, and avatars — never
   to round a container, section, or card body.

4. **Hard shell / soft content.** The outer frame keeps the brutalist border and
   the hard `3px 3px 0` shadow. Softness — green wash, soft radius, soft shadow —
   applies to the content *inside* the shell. Never soften the shell itself.

5. **Breathing pulse = live-state only + reduced-motion gated.** Apply
   `.se-blend-pulse` only to indicate a genuinely live match. It must always be
   neutralized under `@media (prefers-reduced-motion: reduce)` (the token layer
   already gates the shared helper). Never use it for idle or decorative emphasis.

6. **Per-screen soft-element budget.** Cap the soft-styled elements on any one
   screen (rule of thumb: at most ~3 soft surfaces + 1 gold moment + the live
   signal). Overuse erodes the brutalist backbone the blend is layered onto.

---

## How to apply

- Reference tokens by their custom-property name; never hardcode the hex/rgba
  values in a component.
- If a screen needs a soft treatment the tokens don't cover, extend the token
  layer in `src/index.css` (additively) and update this contract — do not
  invent one-off values in a component stylesheet.

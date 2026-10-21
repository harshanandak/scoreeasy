# Colour system audit and proposal

**Date:** 2026-10-21 · **Type:** audit + proposal (no app code changed) · **Trigger:** Harsha, 2026-10-21: "the whole page design template is not matching with the green — we need a better understanding and implementation of colours across the application."

Companion files:

- `2026-10-21-colour-system-audit.html`: a self-contained swatch and role board. It shows the current palette next to the proposed one with WCAG numbers, the green meaning map, the end-match dialog as shipped vs as proposed, and the proposed button set.
- `2026-10-21-colour-system-audit/`: 390×844 phone screenshots (headless Chrome, guest mode, `bunx vite`), with `m-*` from origin/master and `pr157-*` from `feat/team-colour-volleyball`. `proposed-dialog-vs-current.png` is a render of section 5 of the HTML board: a static mock, not app code.

Sources audited: `origin/master` at `52ed9bf` (all of `src/`, minus tests), plus `src/designs/design1-mono/scoring/teamBoard.css`, `TeamSetsBoard.jsx` and `TeamColourPicker.jsx` from PR #157 (`feat/team-colour-volleyball`), and `src/lib/teamColour.js` from `feat/team-colour-engine`. Contrast numbers are WCAG 2.x relative-luminance ratios. Each token value was converted from oklch to sRGB first. The scripts are reproducible but are not committed (they live outside the repo).

---

## 1. The problem in one paragraph

Score Easy has no single colour system. It has four that grew on top of each other:

1. a shadcn-style layer (`--primary`, `--accent`, `--card`, ...);
2. a `--se-color-*` alias layer pointing at it;
3. the HiFi-blend overlay (`--se-blend-*`);
4. a JS copy (`theme/sportsTokens.js`) whose values have drifted.

On top of these sit **about 690 raw colour literals in 50 shipped files**. The new volleyball board (PR #157) is the first screen that follows the hard-shell rules strictly: 2px ink borders, pure-ink 3–4px offset shadows, flat team colour. That makes everything around it look like a different product. The clearest case is the End-match dialog. It renders with a 1px border, an 8px radius, a 70%-black shadow with a blurred second layer, a green overline and a green button whose white label is only **3.35:1**. The green itself is overloaded: it means "go", "selected", "link", "live", "leading", "saved", "final" and "decoration", all at once.

---

## 2. Key findings (read these first)

1. **The app green fails WCAG AA for its own button labels.** `--primary` = `oklch(0.623 0.169 149)` ≈ `#16a249`. White text on it is **3.35:1**, and normal-size text needs 4.5:1. That covers Start, End match, Rematch, the active nav tab and Choose a sport. The same green used as text on the canvas is **3.15:1**: TOURNAMENT →, QUICK ▸, FILTERS +, Edit Rules, MATCH CONTROL. This is what makes the green look "off" in sunlight: it is too light to carry text.
2. **Green carries nine meanings.** They are: primary CTA fill, nav and tab selection, text links, LIVE, lead (the classic board's numeral and underline), success notices, the FINAL badge (styled the same as LIVE), decoration (landing numerals, tags, green offset shadows, the GUEST MODE chip) and input focus. Governance §1 says "green = lead / live only". The code does not honour that.
3. **LIVE has two colours.** It is green in `.mono-badge-live`, the landing hero card, PR #157's `.tsb-chip-live` and the dashboard "● READY". It is red `#dc2626` in `LiveBroadcastBar` ("Sign in to go live"), `LiveNowStrip` ("Live now"), the dashboard "Go live" dots and `.live-card-badge`. Red also means danger.
4. **The hard shell the governance doc describes is not what the tokens produce.** `index.css` and `BLEND-GOVERNANCE.md` §4 both describe "pure-black ink & borders, hard `3px 3px 0` zero-blur shadow". In the code, `--se-shadow-hard` → `--shadow` = `3px 3px 0 0.5px hsl(0 0% 0% / .70), 3px 1px 2px -0.5px hsl(0 0% 0% / .70)`: 70% opacity plus a 2px-blur layer. `--se-shadow-card` is a 35%-grey shadow. `--se-border-standard: 1.5px` renders as **1px** at DPR 1 (computed style on the dialog). Only PR #157's board uses the real thing (`2px solid ink`, `4px 4px 0 ink`). This doc-vs-code mismatch is the root of the "two products" feeling. Under the shipping regime in `AGENTS.md`, it also counts as a doc that asserts something the code does not do.
5. **The canvas and the surface are the same colour.** `--background` ≈ `#f6f8f6` and `--card` ≈ `#f9fbf9` are **1.02:1** apart. Both are faintly green-tinted (hue 145). A dialog, card or sheet separates from the page only by its border. The faint green cast on every white is part of why "everything is green".
6. **There are three reds and a black "danger".** The reds are `--destructive` ≈ `#cc0000`, `--se-color-danger` ≈ `#ac281e`, and raw `#dc2626` (47 uses). Meanwhile the destructive variants of the two shared confirm UIs (`.app-confirm-danger`, `.mono-sheet-danger`) are filled **ink black**. The non-destructive "End match" is green. A destructive confirm can therefore look calmer than a safe one.
7. **Legacy blue and failing greys still ship.** `#0066ff` has 101 uses and shows up in onboarding progress and selection, the cricket and generic tournament screens, player search and confetti. Grey text `#888` (293 uses in 26 files) is **3.33:1** on the canvas, and `#aaa`/`#bbb`/`#ccc` text runs 1.5–2.2:1. The tournament setup, tournament detail, profile and onboarding screens are built almost entirely from these literals. The global focus ring is also blue (`oklch(0.58 0.22 255)`, 4.06:1), so it is easy to confuse with a blue team.
8. **The tokens are mostly dead weight, and the JS mirror drifts.** Zero Tailwind colour utilities are used anywhere in `src/`, so the whole `@theme` colour block is unused. Unused vars include `--secondary*`, `--popover*`, `--input`, `--ring`, `--chart-1..4`, `--sidebar-*`, the `--shadow-sm..2xl` scale and all `--color-mono-*`. `sportsTokens.js` disagrees with `index.css` on five points:
   - danger: `#cc0000` vs `#ac281e`;
   - danger-soft;
   - warning: a brown `#b86e2e` at 3.72:1 vs an amber `#946400` at 4.84:1;
   - inverse: chalk vs pure white;
   - the standard border: 1px vs 1.5px.

   Its `sportsCssVariables` export has no consumer. `landingTokenBridge` calls the green `blue` and the warning brown `orange`. `clerkTheme.js` and `teamColour.js` (`NEUTRAL`) each hard-code their own copies of the canvas, surface and green.

---

## 3. Inventory

### 3.1 Raw colour literals by category

Hex, rgb(a), hsl and oklch literals, plus named colours in colour properties. HTML entities like `&#9679;` are excluded; tests are excluded.

| Category | Files | Literals | Notes |
|---|---:|---:|---|
| Shipped screens and components | 50 | **692** | the migration target |
| Token definitions (`index.css`, `sportsTokens.js`, `clerkTheme.js`) | 3 | 91 | should shrink to one place |
| Internal showcases (dev-only routes) | 5 | 435 | `MonoSetDisplayShowcase`, `MonoMatchCardShowcase`, `BrutalistColorShowcase`, `LandingDesignA`, `DashboardShowcase` |
| Dead code (imported nowhere) | 5 | 218 | `BrutalistBlueVariants`, `MonoSportHome_TABBED`, `MonoHome`, `MonoSetup`, `MonoLiveGame` |
| PR #157 board files | 3 | 18 | 11 are the picker's team swatches; `teamBoard.css` has `#0f6a32`, `#45454d`, `rgba(12,12,14,.4)` |

Shipped files, sorted by literal count:

| Literals | File |
|---:|---|
| 113 | `MonoTournamentSetup.jsx` |
| 110 | `MonoCricketTournament.jsx` |
| 64 | `GenericSetsTournament.jsx` |
| 61 | `GenericGoalsTournament.jsx` |
| 61 | `MonoOnboarding.jsx` |
| 32 | `mono.css` (plus 70 `color-mix()` calls on tokens) |
| 31 | `MonoProfile.jsx` |
| 28 | `NewUserFlow.jsx` |
| 26 | `MonoTournamentList.jsx` |
| 22 | `landing/DashboardLanding.jsx` |
| 20 | `KnockoutMatchCard.jsx` |
| 18 | `MonoUserSearch.jsx` |
| 14 | `MonoQuickMatch.jsx`, `MonoStatistics.jsx` |
| 8 | `PlayerSearchInput.jsx`, `index.jsx`, `models/types.js` |
| 6 | `PlayerChip.jsx`, `MonoHistory.jsx`, `scoring/MonoTennisLiveScore.jsx` |
| 1–5 | `ErrorBoundary`, `confetti`, `ConfirmActionPanel`, `MonoCricketLiveScore` (FREE HIT `#ff6b00`), `RouteRecoveryActions`, `TournamentNotFoundActions`, `ShareLiveMatch`, `LiveBroadcastBar`, `LiveNowStrip`, `ReportMatch`, `GuestLanding`, `MonoPlayHub`, `MonoTournamentLiveScore`, `MonoCricketSpectator`, `SSOCallback`, `mobile/nativeChrome.js` (`#fafafa` status bar) |

Most frequent literals: `#888` ×293, `#111` ×205, `#0066ff` ×101, `#fff` ×89, `#bbb` ×50, `#ccc` ×48, `#dc2626` ×47, `#eee` ×42, `#aaa` ×34, `#f5f5f5` ×32. In total there are 179 distinct literal values.

### 3.2 Token layers and what they resolve to

| Layer | Defined in | Used by | Status |
|---|---|---|---|
| shadcn vars (`--background`, `--primary`, `--accent`, ...) | `index.css :root` | `var(--primary)` directly in **33** files, `--foreground` 23, `--muted-foreground` 21, `--card` 11, `--accent` 11 | the real source of values today |
| `--se-color-*` (24 tokens) | `index.css :root`, as aliases of shadcn vars | `mono.css`, `index.jsx` inline styles, landing, scorers | the intended API, half-adopted |
| `--se-blend-*` (13 tokens, FROZEN) | `index.css :root` | `mono.css` result card; `teamBoard.css` (`green-wash`) | colours here duplicate the green family |
| `@theme inline` `--color-*` | `index.css` | **0 Tailwind colour utilities in `src/`** | dead |
| `sportsTokens.js` | JS literals | `GuestLanding`, `landingTheme`, `MonoAuthPageFrame`, `MonoProfile` (inline styles) | drifted copy |
| `clerkTheme.js` | JS literals | Clerk `<SignIn>`/`<SignUp>` | third copy |
| `teamColour.js` `NEUTRAL` | JS, "the literal values of `--background`, `--card`, `--foreground`" | engine contrast gates | fourth copy; must move in lockstep |
| `--team-*` | PR #157 `index.css` fallbacks; set at runtime by `useTeamColours` | `teamBoard.css` | correct pattern: engine-only values |

**Tokens that resolve to the same value:**

- `--se-color-ink` = `--se-color-ink-strong` = `--foreground` = `--border` = `--input` = `--se-color-line` = `--se-color-line-strong` (all `#000`);
- `--se-color-ink-muted` = `--se-color-ink-faint`;
- `--primary` = `--ring` = `--chart-1` = `--sidebar-primary` = `--sidebar-ring`;
- `--card` = `--popover`;
- `--background` = `--sidebar`;
- `--shadow-2xs` = `--shadow-xs`;
- `--se-shadow-hard` = `--shadow` = `--shadow-sm`.

`--secondary` is a second, slightly different green (`#00a63e`) that nothing uses.

**Unused** (no `var()` outside `index.css`):

- `--card-foreground`, `--popover*`, `--secondary*`, `--destructive-foreground`, `--input`, `--ring`, `--chart-1..4`, all 8 `--sidebar-*`;
- `--shadow-x/y/blur/spread/opacity/color`, `--shadow-sm/md/lg/xl/2xl`;
- all 8 `--color-mono-*`;
- `sportsCssVariables`, `getReadableTextColor` (tests only), and the `racquet` entry in `sportAccents`. Sport ids are `tennis`, `badminton` and so on, so `racquet` never matches.

**Drift between `sportsTokens.js` and `index.css`:**

| Role | `index.css` | `sportsTokens.js` |
|---|---|---|
| danger | `oklch(0.49 0.17 29)` ≈ `#ac281e` | `oklch(0.5308 0.2178 29.2)` ≈ `#cc0000` |
| danger-soft | `oklch(0.96 0.04 29)` | `oklch(0.932 0.043 28.6)` |
| warning | `oklch(0.54 0.12 78)` ≈ `#946400` (amber, 4.84:1) | `pitchBrown` ≈ `#b86e2e` (brown, 3.72:1) |
| warning-soft | `oklch(0.96 0.05 86)` | `pitchBrownSoft` = the grey `--muted` |
| inverse | `--primary-foreground` = `#fff` | `chalkWhite` = `--card` (`#f9fbf9`) |
| border standard | `1.5px` | `1px` |
| focus ring | `oklch(0.58 0.22 255)` | missing |

---

## 4. Colour roles in use today

| Role | Values in use | Where the same role uses different values | Where one value carries other meanings |
|---|---|---|---|
| **Canvas** | `--background` `#f6f8f6`; `.tsb` canvas; `nativeChrome` `#fafafa`; raw `#fafafa`/`#f5f5f5` page backgrounds in tournament screens | status bar `#fafafa` ≠ canvas; tournament pages paint their own whites | none |
| **Surface** | `--card` `#f9fbf9` (1.02:1 vs canvas); raw `#fff` ×89; `#f5f5f5`, `#fafafa` | dropdowns in `MonoQuickMatch`/`PlayerSearchInput` use `#fff` + `#eee` + soft `0 2px 8px` shadows; `ShareLiveMatch` `#fff` | none |
| **Ink levels** | `#000` (`--foreground`); `#333` (`--chart-5` as `ink-soft`); `#666` (`--muted-foreground`, also `ink-faint`); PR #157 `#45454d`; raw `#111` ×205, `#444`, `#555`, `#666`, `#888` ×293, `#999`, `#aaa`, `#bbb`, `#ccc` | **10+ greys** for three roles; `#888`/`#aaa`/`#bbb`/`#ccc` fail AA | `#ccc` is both text and separator |
| **Borders / lines** | `#000` 1px/1.5px (Mono), 2px (PR #157 board, result card); `color-mix(line 14–72%)` ×~40 for dividers; raw `#eee`, `#ddd`, `#e5e5e5` | shell border is 1px, 1.5px or 2px depending on the screen | control boundaries sometimes use 28–58% mixes (under 3:1), so they read as dividers |
| **Shadows: hard** | `--se-shadow-hard` (70% + blur layer), `--se-shadow-card` (35% grey), PR #157 `3px/4px 0 ink`, landing/dashboard **`4px 4px 0` green** and `6px 6px 0 green` | four different "hard" shadows | green shadows make the green decorative |
| **Shadows: soft** | `--se-blend-shadow-soft`, `--se-blend-shadow-cta` (green glow on `.mono-result-cta-primary`), `.mono-scorer-note` `0 6px 20px`, `NewUserFlow` `0 4px 20px rgba(0,0,0,.08)`, dropdowns `0 2px 8px` | three ad-hoc soft shadows outside the blend tokens | a soft glow on an interactive CTA contradicts §4 |
| **Primary action** | `--primary` `#16a249` fill (white label 3.35:1); hover `--accent-foreground` `#0c5a29` (fallback `#215b25`); `.mono-action-primary` hover `color-mix(88% black)` | two different hover darkenings | same value used for links, nav, tabs, live, lead, focus |
| **Selection** | bottom nav active = green fill; `.mono-tab-active` green; Guided/Browse green; `.mono-setup-option-selected` green border + mint; onboarding **blue `#0066ff`**; history stat card mint + green border | green in most places, blue in onboarding | selection looks the same as the CTA |
| **Live** | green: `.mono-badge-live`, landing card, `.tsb-chip-live` (`#0f6a32` raw), `● READY`. red: `LiveBroadcastBar`, `LiveNowStrip`, `.live-card-*`, dashboard `Go live` | **green vs red** | `.mono-badge-final` is styled identically to `.mono-badge-live` |
| **Lead / score** | classic board: leading numeral green + `::after` underline in `--score-accent`/`--primary`; landing hero scores in `actionStrong` green; result: `--se-blend-green-wash` score box, `green-wash-strong` winner row | PR #157 §7 says lead is not colour-coded; master codes it green | none |
| **Success** | `.mono-alert-success` green border + mint; quick-match "Match saved" banner; `.app-scoring-notice-success` `#16a34a` | three greens | none |
| **Danger** | `--destructive` `#cc0000` (cricket out, end chip, wicket pip), `--se-color-danger` `#ac281e` (discard, danger text), raw `#dc2626` ×47 (errors, delete, live dots, Clerk), `ConfirmActionPanel` `#fef2f2`/`#fecaca`/`#991b1b` | three reds + Tailwind red washes | **ink black** for destructive confirms; red also = live |
| **Warning** | `--se-color-warning` `#946400`; `sportsTokens` brown `#b86e2e`; raw `#d97706` (notice), `#a16207` (fallback), `#ff6b00` FREE HIT (2.71:1 on `#fff8f0`, fails); cricket "four" pip = warning | four oranges/browns | a cricket four is not a warning |
| **Gold milestone** | `--se-blend-gold` `#b8862e` (3.11:1 on surface), `-bright` `#e8b64c`; result medallion only | — | correctly used once (the medallion); confetti uses its own 5 literals |
| **Team colour** | PR #157: engine `--team-{a,b}-{hi,core,lo,on,scrim,tint,line,motif}`; picker swatches; `models/types.js` 8 raw player colours; tennis/confetti palettes | team-ish palettes in three unrelated places | the engine's "Green" preset normalises to `#00662a`, **ΔE 0.05** from the proposed action green (see §6.3) |
| **Focus ring** | global `oklch(0.58 0.22 255)` blue 3px + 18% halo; `.mono-input:focus` green outline; `.mono-score-pad`/`.mono-arena-half` green 2px; PR #157 keys: ink 3px | **blue vs green vs ink** | blue is also team B's default |
| **Disabled** | tournament "Next" = faded green (opacity); `.mono-score-pad[disabled]` transparent; PR #157 undo dashed border + ink-2; mode cards in play hub faded mint | three treatments | faded green reads as "available, light" |

---

## 5. Screen-level consistency

The "visual language" column uses three labels. **Hard shell** means 2px ink, pure-ink offset shadow, ink labels. **Mono soft-hard** means 1–1.5px ink, 70%/35% semi-transparent blurred shadow, green accents. **Soft blend** means washes, soft shadows and glows.

| Screen | Screenshot | Visual language | Specific mismatches |
|---|---|---|---|
| Landing `/marketing` | `m-landing.png`, `m-landing-2.png` | Mono soft-hard + **green offset shadows** | hero score card shadow `4px 4px 0 green`; green decorative numerals (14 / NOW / ON); green tags (CORE, ORGANIZE); LIVE in green here but red on the dashboard; CTA white-on-green 3.35:1 |
| Dashboard `/app` (guest) | `m-dashboard.png`, `m-dashboard-2.png` | Mono soft-hard + green shadows | `GUEST MODE` mint chip (resting-state green, violates §1); "● READY" green next to "● GO LIVE" red in the same card; card shadow is green; green `QUICK ▸` links; active bottom-nav tab is a green pill inside a soft-bordered bar |
| Play hub `/play` | `m-play-hub.png` | Mono soft-hard | green Guided toggle, green step numbers, mint progress, faded-mint disabled mode cards; sport cards use 35%-grey shadows. Also (not colour): the 4-column sport grid **overflows the 390px viewport** on the right |
| Quick-match setup | `m-quick-setup.png`, `m-cricket-setup.png`, `pr157-quick-setup.png` | Mono soft-hard | `Edit Rules` green outline + green text (3.15:1); `Add players` pale **blue** (`#dbeafe`) border; green `TOURNAMENT →` link; inputs carry the 70% blurred shadow; CTA green with a grey blurred shadow. PR #157 adds the hard-edged swatch picker, the only hard element on the page |
| Scorer (classic, master) | `m-scorer-classic.png` | flat / none | leading numeral + underline green; `SET 1 OF 3` mint chip; red live dot on the "Sign in to go live" bar; `FINISH` green text, `DISCARD` grey (not danger) |
| Scorer (team colour, PR #157) | `pr157-scorer.png` | **Hard shell** | consistent internally. Raw `#0f6a32`, `#45454d` and `rgba(12,12,14,.4)` in `teamBoard.css` break the governance rule against hard-coded values |
| Options sheet (PR #157) | `pr157-options-sheet.png` | Hard shell | consistent with the board; its scrim (`rgba(12,12,14,.4)`, no blur) differs from the app dialog's (`rgba(0,0,0,.28)` + `blur(2px)`); embedded live bar shows a red dot |
| **End-match / confirm dialogs** | `m-end-match-dialog.png`, `pr157-end-match-dialog.png` | **Mono soft-hard** | 1px border (1.5px rounded down), 8px radius vs the board's 14px; 70% blurred shadow vs pure ink; green `MATCH CONTROL` overline (3.15:1); green fill on a non-destructive commit (3.35:1); destructive variant (`.app-confirm-danger`) is ink; backdrop blur. Three implementations share the class names: `ConfirmDialog` in `MonoQuickMatch.jsx`, `AppConfirmDialog` in `index.jsx`, and `AppScoringConfirmDialog` in `AppScoringPrompt.jsx`. The CSS for all three lives in an inline `<style>` in `index.jsx`. `MonoSheet` (`mono.css`) is a fourth modal surface with the same mismatch |
| Result (quick match) | `pr157-result.png` | Mono soft-hard | mint "Match saved" banner (success = green); score card with grey blurred shadow; green `Rematch` with a grey shadow; no team colour, no gold |
| Result (tournament, `MonoMatchResult`) | code only | Hard shell + soft blend | 2px ink card + hard shadow (good); gold medallion with soft shadow (correct §2); green-wash score box with soft shadow; **green glow shadow** on the CTA (`--se-blend-shadow-cta`) |
| History `/history` | `m-history.png` | Mono soft-hard | `Matches` tab = green fill (selection = CTA colour); selected stat card mint + green border; green `FILTERS +`; green CTA with grey shadow |
| Profile `/profile` (guest) | `m-profile.png` | Mono soft-hard | green CTA with grey blurred shadow; signed-in profile (code) uses `#888`/`#111` raw greys ×31 |
| Tournament setup | `m-tournament-setup.png` | flat greys | built from raw `#888`/`#ccc`/`#eee`; helper text `#bbb`-ish (fails); disabled `Next` = faded green |
| Onboarding, tournament detail (code only, needs sign-in/data) | — | legacy blue | `#0066ff` progress, selection and accents; `#888`/`#111` greys |

**Summary:** only two places use the hard shell the governance doc describes: the PR #157 board and its sheet, plus the tournament result card. Every other surface, including every dialog, uses the semi-transparent blurred "Mono soft-hard" shadow and leans on green for things that are not actions.

---

## 6. Proposal: one colour system

### 6.1 The palette (23 role values)

Values are sRGB hex so that JS consumers (Clerk, Capacitor, the team engine, confetti) can use the same literal. Ratios are WCAG 2.x. "Fill" rows are backgrounds and are not themselves graded against the page.

| Role | Token (keeps the `--se-color-*` prefix) | Value | vs canvas | vs surface | White on it | Rule |
|---|---|---|---:|---:|---:|---|
| Canvas | `--se-color-canvas` | `#f3f3ef` | — | 1.11 | — | page; warm neutral, **no green tint** |
| Surface | `--se-color-surface` | `#ffffff` | 1.11 | — | — | cards, dialogs, sheets, secondary buttons |
| Surface sunk | `--se-color-surface-warm` | `#e9e9e4` | fill | fill | — | sunk panels, skeletons |
| Ink | `--se-color-ink` | `#0b0b0d` | **17.68** | **19.66** | 19.66 | text, every shell border, every hard shadow (matches the engine's `INK`) |
| Ink 2 | `--se-color-ink-soft` | `#45454d` | **8.54** | **9.50** | — | body copy, overlines (already the board's `--tsb-ink-2`) |
| Ink 3 | `--se-color-ink-muted` | `#64646c` | **5.27** | **5.86** | — | meta, placeholder, disabled label; 4.81 on surface-sunk |
| Line | `--se-color-line` | = ink | 17.68 | 19.66 | — | every control boundary |
| Line soft *(new)* | `--se-color-line-soft` | `#c9c9c3` | 1.50 | 1.66 | — | decorative dividers **inside** a surface only, never a control edge |
| On-ink | `--se-color-inverse` | `#ffffff` | — | — | — | text on ink / action / danger fills |
| **Action (go)** | `--se-color-action` | `#12753a` | **5.20** | **5.78** | **5.78** | fill of the one primary forward action per screen |
| Action press | `--se-color-action-strong` | `#0c5a2c` | 7.51 | 8.35 | 8.35 | pressed/hover |
| Action wash | `--se-color-action-soft` | `#e1f1e6` | fill | fill | — | the LIVE chip background; ink on it 16.79 |
| **Live** *(new)* | `--se-color-live` | = action `#12753a` | 5.20 | 5.78 | — | LIVE chip text + dot + pulse; 5.0+ on the wash |
| Live wash *(new)* | `--se-color-live-soft` | = action wash | fill | fill | — | LIVE chip background (replaces `--se-blend-green-wash`) |
| **Danger** | `--se-color-danger` | `#b42318` | **5.91** | **6.57** | **6.57** | destructive fills, danger text, wicket |
| Danger press *(new)* | `--se-color-danger-strong` | `#8f1b12` | 8.09 | 9.00 | 9.00 | pressed destructive |
| Danger wash | `--se-color-danger-soft` | `#fbe9e7` | fill | fill | — | error notice; danger on it 5.61 |
| **Warning** | `--se-color-warning` | `#8a5300` | **5.69** | **6.33** | 6.33 | warnings, FREE HIT |
| Warning wash | `--se-color-warning-soft` | `#fdf0d5` | fill | fill | — | warning notice; warning on it 5.61 |
| **Gold** | `--se-color-gold` (alias `--se-blend-gold`) | `#b8862e` | 2.91 | 3.24 | 3.24 | ONE milestone per screen; fills and edges, never text |
| Gold bright | `--se-color-gold-bright` | `#e8b64c` | fill | fill | — | highlight; ink on it 10.51 |
| Gold ink *(new)* | `--se-color-gold-ink` | `#7a5410` | **6.08** | **6.77** | — | gold as text |
| Focus | `--se-color-focus-ring` | = ink | **17.68** | **19.66** | — | 3px ink outline, 3px offset |
| Scrim *(new)* | `--se-color-scrim` | `rgba(11,11,13,.45)` | — | — | — | every modal backdrop; **no blur** |

Shadows and borders are non-colour tokens, but they are part of the same contract:

| Token | Value | Use |
|---|---|---|
| `--se-border-standard` | `2px` (was 1.5px, which renders as 1px at DPR 1) | shell and controls |
| `--se-border-hairline` *(new)* | `1px` | inner dividers (with `line-soft`) |
| `--se-shadow-hard` | `3px 3px 0 var(--se-color-ink)` | buttons, cards, chips with shadow |
| `--se-shadow-hard-lg` *(new)* | `4px 4px 0 var(--se-color-ink)` | point keys, dialogs, primary panels |
| `--se-shadow-press` *(new)* | `1px 1px 0 var(--se-color-ink)` | pressed state, with `translate(2px,2px)` |
| `--se-shadow-card` | = `--se-shadow-hard` (delete the 35%-grey value) | |
| `--se-blend-shadow-soft` | unchanged | non-interactive content inside a shell only (§4, §6) |
| `--se-blend-shadow-cta` | **retire** | a glow on an interactive control contradicts §4 |

### 6.2 Rules for green

Green means **"go"** and **"live"**, and nothing else.

- **May:** fill the single primary forward action on a screen (Start volleyball, Start playing, Choose a sport, Rematch, Sign in to sync). It is always a *filled* button: white label 5.78:1, ink border, ink hard shadow. Never green text, never a green outline, never a green shadow.
- **May:** mark LIVE while a match is genuinely broadcasting. That means the chip (word "LIVE" + dot) in `--se-color-live` on `--se-color-live-soft`, with the breathing pulse (reduced-motion gated). The "Sign in to go live" and "Go live" prompts are offers, not states. They take an ink dot, not green and not red.
- **May not:**
  - lead or score state (the numbers say who leads; on team boards the team colour is the identity);
  - selection (nav, tabs, segmented controls, selected options), which uses **ink inversion**: ink fill + white label, or a 2px ink border + `surface-warm` fill;
  - text links and text buttons, which use ink + underline or an arrow glyph;
  - focus (ink ring);
  - success, saved or final (a neutral surface notice with ink text and a ✓ glyph);
  - decoration (numerals, tags, card borders, shadows, resting chips such as GUEST MODE);
  - dialogs and sheets (§6.4);
  - disabled states (never a faded green).
- **Count:** at most one green action fill per screen, plus the LIVE chip when live. A screen where green appears more than twice is a defect, by the same logic as the one-gold rule.

### 6.3 Team colour alongside app green (scoring, live, result)

1. **Team colour is identity, not state.** It comes only from the engine vars (`--team-{a,b}-*`), never a raw hex, and only on scoring, spectator and result surfaces, plus the setup picker swatches. It never encodes lead, serve or win alone; serve is the on-colour tag with the word, and the winner is the score plus a 4px `--team-x-line` edge.
2. **Hue cannot separate app green from team green.** The engine normalises the "Green" preset to `#00662a`, which is ΔE 0.05 from the proposed action green, and every deep green a scorer picks lands near there. The separation therefore has to be structural:
   - the board itself carries **no app-green action**: Finish, Undo and options are ink/surface hard buttons;
   - the only app green on a team board is the LIVE chip, which always carries the word and its own border;
   - every team fill is bounded by a 2px ink border, so app colours never touch a team fill directly.
3. **Danger keeps its word.** Discard and Correct live in the sheet as labelled rows with the danger text colour. A red team never makes a red control ambiguous, because controls are always labelled and bordered.
4. **The chrome around the board is neutral.** Header, chips, last-action line, undo bar, sheet, dialogs and the live bar all use ink, surface and canvas. Team tint (`--team-x-tint`) is allowed on a chip or row that *names* a team (set history, result rows), with ink text (the engine gates it at 4.5:1).
5. **Focus on a team key** is the ink ring outside the key (offset 4px, on the canvas), as PR #157 already does. Never use a coloured ring.
6. **Result screen:** the winner edge is in team colour, there is one gold moment (medallion or confetti, not both as separate golds), and Rematch is the one green action.
7. **Engine neutrals move with the palette.** `teamColour.js` `NEUTRAL` must equal the new canvas and surface in the same PR (its `contrastReport` line gates of 3.2 are computed against them).

### 6.4 Dialogs, sheets and buttons in the hard-shell language

**Modal surfaces** (`AppConfirmDialog`, `ConfirmDialog`, `AppScoringConfirmDialog`, `MonoSheet`, `.tsb-sheet`):

- One scrim, `--se-color-scrim`, no `backdrop-filter`. A blur softens the shell and costs frames on low-end Android.
- Panel: `--se-color-surface`, `2px solid ink`, radius 14px for dialogs (same as the point keys) or `16px 16px 0 0` with no bottom border for sheets, `--se-shadow-hard-lg` on dialogs (sheets sit on the edge, no shadow).
- Overline: JetBrains Mono 11px/800, uppercase, 0.08em, **ink 2**, never green. Title: Inter 20/800 ink. Body: 15/1.5 ink 2.
- Buttons: min-height 52px, full width on phones, keeping today's order.
  - **commit** (End match, Save, Leave): ink fill, white label (19.7:1);
  - **destructive** (Discard, Delete, Clear history): danger fill, white label (6.57:1);
  - **cancel** (Keep scoring, Stay here): surface fill, ink label.
  - All three: 2px ink border, `--se-shadow-hard`, pressed = `translate(2px,2px)` + `--se-shadow-press`.
- One implementation: a single `AppDialog` component and one stylesheet section in `mono.css`. Today there are three copies of the markup, and their CSS lives in an inline `<style>` in `index.jsx`.

**Buttons app-wide** (one set; `.mono-btn*`, `.mono-action-primary`, `.mono-result-cta*`, `.mono-sheet-*`, `.app-confirm-*`, `.app-scoring-notice-action` and the `tsb-*` buttons converge on it):

| Variant | Fill | Label | Border / shadow | When |
|---|---|---|---|---|
| `go` | action | white | 2px ink / hard | the one primary forward action per screen |
| `commit` | ink | white | 2px ink / hard | the confirm inside a dialog or sheet |
| `secondary` | surface | ink | 2px ink / hard | everything else |
| `danger` | danger | white | 2px ink / hard | destructive |
| `text` | none | ink, underline | none | inline links (TOURNAMENT →, QUICK ▸, FILTERS +) |
| disabled (any) | transparent | ink 3 | 2px **dashed** ink 3 / none | not available |

Radius: buttons 10px, keys 14px, sheets 16px top, chips 6px. Capsules (`--se-blend-radius-capsule`) stay limited to chips, toggles and avatars (§3).

### 6.5 Token plan

**Direction:** `--se-color-*` holds values; everything else aliases it or is deleted.

| Action | Tokens |
|---|---|
| **Keep, change value** | `--se-color-canvas`, `-surface`, `-surface-warm`, `-ink`, `-ink-soft` (→ `#45454d`), `-ink-muted` (→ `#64646c`), `-line`, `-inverse`, `-action` (→ `#12753a`), `-action-strong`, `-action-soft`, `-danger`, `-danger-soft`, `-warning`, `-warning-soft`, `-focus-ring` (→ ink), `--se-border-standard` (→ 2px), `--se-shadow-hard`, `--se-shadow-card` |
| **Add** | `--se-color-line-soft`, `-live`, `-live-soft`, `-danger-strong`, `-gold`, `-gold-bright`, `-gold-ink`, `-scrim`; `--se-border-hairline`, `--se-shadow-hard-lg`, `--se-shadow-press` |
| **Merge, then delete** | `-ink-strong` → `-ink`; `-ink-faint` → `-ink-muted`; `-line-strong` → `-line` |
| **Blend colours become aliases** (names stay, honouring the freeze) | `--se-blend-green-wash` → `var(--se-color-live-soft)`; `-green-wash-strong` → `var(--se-color-action-soft)`; `--se-blend-gold(-bright)` → `var(--se-color-gold(-bright))`; retire `--se-blend-shadow-cta` |
| **Flip direction** | `--background`, `--foreground`, `--card`, `--muted`, `--muted-foreground`, `--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--border` become aliases **of** `--se-color-*` until their callers migrate (`var(--primary)` alone has 33 files), then delete them |
| **Delete now** (0 uses) | `--secondary*`, `--popover*`, `--card-foreground`, `--destructive-foreground`, `--input`, `--ring`, `--chart-1..4` (repoint `ink-soft` off `--chart-5` first, then delete it), `--sidebar-*`, `--shadow-x/y/blur/spread/opacity/color`, `--shadow-sm/md/lg/xl/2xl`, `--color-mono-*` and every unused `@theme` colour entry |
| **`@theme inline`** | map only role tokens: `--color-canvas`, `--color-surface`, `--color-ink`, `--color-ink-soft`, `--color-ink-muted`, `--color-line`, `--color-action`, `--color-live`, `--color-danger`, `--color-warning`, `--color-gold`, `--color-team-a`, `--color-team-b` (from PR #157), so `bg-surface text-ink border-line` exist if a component wants utilities |
| **JS** | new `src/designs/design1-mono/theme/palette.js`: the only JS file with colour literals, for APIs that need a literal (`clerkTheme.js`, `nativeChrome.js`, `teamColour.js` `NEUTRAL`, confetti). `sportsTokens.color.*` becomes `'var(--se-color-*)'` strings. Delete `sportsCssVariables` and the `racquet` accent. Rename `landingTokenBridge.blue` → `action` and `.orange` → `warning` |
| **Guard** | a vitest test asserting (a) every `palette.js` value equals its `index.css` declaration, (b) every documented contrast pair meets its threshold, and (c) a **ratchet**: the count of raw colour literals in shipped `src/` files never goes up. The baseline is 692 and each migration PR lowers it. When it reaches 0 the ratchet becomes a ban outside `index.css`, `palette.js` and `teamColour.js` |

**How components consume colour:**

- CSS classes (`mono.css`, `teamBoard.css`) use `var(--se-color-*)`.
- JSX inline styles use the same `var(...)` strings, via `sportsTokens.color` or a tiny `cssVar` map.
- Tailwind is used only through the role utilities above.
- No component holds a literal. Team colour only through `--team-*` from the engine.

### 6.6 Governance changes needed (Harsha's call)

These rules in `BLEND-GOVERNANCE.md` would change. `blendTokens.test.js` asserts the §1 wording, so it changes in the same PR.

| Rule | Today | Proposed | Why |
|---|---|---|---|
| §1 | "Green = lead / live only … the leading team, a live badge, or the active/primary action" | "Green = go / live only": the one primary action fill + the LIVE chip; never lead, selection, links, focus, success, decoration | lead-in-green conflicts with team colour (PR #157 §7 already drops it); three meanings are too many to read courtside |
| §4 | "hard `3px 3px 0` shadow" (prose) | name the exact tokens: `2px` ink border, `--se-shadow-hard` = `3px 3px 0 ink` (100%, 0 blur), `-lg` = 4px | the doc describes a shadow the tokens do not produce |
| §7 (from PR #157) | team colour = identity on scoring/live surfaces | adopt as written, plus §6.3 rules 2–7 above | coexistence needs to be explicit |
| **§8 (new)** | — | colour roles table (§6.1) + "no raw colour literals in components; values live in `index.css` and `palette.js` only" | there is no colour contract today beyond the blend overlay |
| Freeze | blend colour tokens are values | blend colour tokens become aliases of `--se-color-*` (names unchanged) | keeps the frozen API, removes the duplicate green family |

**Decisions this audit does not make.** Each needs a yes or no from Harsha before the dependent PR:

> **Decided by Harsha, 2026-10-21:** green means only **go** (one filled primary per screen) and
> **live**, in the darker AA green `#12753a`; **LIVE is green** everywhere (D1 = a); selection,
> links and focus use ink (follows from the green rule, D2 = a); the **leading score is not
> coloured** on cricket, tennis and the classic sets boards (D3 = a); **neutral page `#f3f3ef` with
> white cards** (D4 = a). D5 (showcase routes) is open; default to deleting dead code that nothing
> imports and keeping the showcases out of the ratchet until Harsha decides.

- **D1. LIVE colour.** (a) green, as recommended: matches governance and keeps red for danger; (b) broadcast red: matches TV convention but collides with danger and with red teams. Each option clashes with one team colour, which is why the chip always carries the word.
- **D2. Selection colour.** (a) ink inversion, as recommended; (b) keep green for the active bottom-nav tab only.
- **D3. Lead on non-team boards** (cricket, tennis, classic sets). (a) no colour, ink weight/marker only, as recommended; (b) keep green until those boards get team colour.
- **D4. Canvas.** (a) neutral `#f3f3ef` + white surfaces, as recommended (the engine `NEUTRAL` follows); (b) keep today's faint green-tinted whites and only fix contrast.
- **D5. Showcase routes.** Delete the dev-only showcases that demo retired palettes (`BrutalistColorShowcase`, `LandingDesignA`, `BrutalistBlueVariants`), or keep them out of the ratchet.

---

## 7. Migration: small PRs, one point each

Order matters: tokens first, so later PRs only swap references. Each PR ships with before/after 390×844 screenshots of the screens it touches (the demo artifact under the shipping regime), `bun run test`, `bun run lint` and `bun run type-check`. The dialog, scorer and result PRs also walk the states they touch: open, cancel, confirm, the destructive variant, and undo after cancel. PR #157 should merge first, or the dialog PR rebases on it.

| # | PR (one point) | Files | Verify |
|---|---|---|---|
| 0 | **Governance: colour roles + green = go/live** (docs + the one test regex) | `BLEND-GOVERNANCE.md`, `blendTokens.test.js`, `index.css` header comment | needs D1–D4; `bun run test` |
| 1 | **Palette module + drift test + literal ratchet** (no visual change) | new `theme/palette.js`, new `theme/palette.test.js`, `index.css` (add new tokens only) | test fails if `palette.js` ≠ `index.css`, if a contrast pair drops below its threshold, or if raw-literal count > 692 |
| 2 | **Flip token direction + delete unused tokens** (no visual change) | `index.css` (shadcn vars alias `--se-color-*`; delete sidebar/chart/popover/secondary/input/ring/shadow scale/`--color-mono-*`; trim `@theme`) | computed-style snapshot of 5 screens identical before/after; `blendTokens.test.js` build check |
| 3 | **Green passes AA** (`#16a249` → `#12753a`) | `index.css`, `palette.js`, `clerkTheme.js` | contrast test; screenshots: landing, dashboard, setup, history, result |
| 4 | **Neutral canvas + white surface** (D4) | `index.css`, `palette.js`, `lib/teamColour.js` `NEUTRAL`, `mobile/nativeChrome.js` | `teamColour.test.js` `contrastReport` all pass; status bar matches canvas on Android |
| 5 | **One hard shadow, 2px borders** | `index.css` (`--se-shadow-*`, `--se-border-*`) | screenshots of every card/dialog; shadows render 100% ink, 0 blur at DPR 1 and 3 |
| 6 | **Dialogs + sheets to hard shell** | `index.jsx` (move the inline `<style>` dialog CSS into `mono.css`; one `AppDialog`), `MonoQuickMatch.jsx` `ConfirmDialog`, `components/AppScoringPrompt.jsx`, `components/MonoSheet.jsx`, `mono.css` `.mono-sheet*`, `teamBoard.css` scrim | `AppOwnedScoringPrompts.test.jsx` (its z-index regex reads `index.jsx`, so update it), `MonoSheet.test.jsx`; walk End match, Discard, Leave, the app prompt over a sheet, Escape, backdrop tap, focus return |
| 7 | **One button set** | `mono.css` (`.mono-btn*`, `.mono-action-primary`, `.mono-result-cta*`, `.mono-sheet-*`), `index.jsx` notice action, retire `--se-blend-shadow-cta` | screenshots: setup, result, history, profile; pressed and disabled states |
| 8 | **LIVE has one colour** (D1) | `live/LiveBroadcastBar.jsx`, `live/LiveNowStrip.jsx`, `mono.css` `.live-card*`, `.mono-badge-live/-final`, `landing/DashboardLanding.jsx` (Go live dots, READY), `landing/GuestLanding.jsx`, `teamBoard.css` `.tsb-chip-live` | live strip, broadcast bar, spectator page; FINAL ≠ LIVE |
| 9 | **Selection is ink** (D2) | `index.jsx` bottom nav + `.global-nav-link`, `mono.css` `.mono-tab*`, `.mono-setup-option-selected`, `.mono-stat-card[aria-pressed]`, `MonoPlayHub.jsx` Guided/Browse | nav, history tabs, setup options; `aria-current`/`aria-pressed` unchanged |
| 10 | **Green off decoration** (landing + dashboard) | `landing/GuestLanding.jsx`, `landing/DashboardLanding.jsx`, `landing/landingTheme.js`, `theme/sportsTokens.js` (bridge rename) | landing + dashboard: green count ≤ 1 CTA + LIVE |
| 11 | **Links and text buttons are ink** | `mono.css` `.mono-action-text`, `.mono-table-action`; `MonoQuickMatch.jsx` (TOURNAMENT →, Edit Rules, Add players); `MonoSportHome.jsx` (QUICK ▸); `MonoHistory.jsx` (FILTERS +) | screenshots of setup, dashboard, history |
| 12 | **Lead is not green on the classic boards** (D3) | `mono.css` `.mono-arena-half[data-leading]`, `.mono-arena-num::after`; `MonoQuickMatch.jsx` `--score-accent` | walk score, lead change, tie, undo; board still truthful |
| 13 | **One red** | `ConfirmActionPanel.jsx`, `ErrorBoundary.jsx`, `clerkTheme.js` `colorDanger`, `mono.css` (`#dc2626` fallbacks, `--destructive` uses), `.app-confirm-danger`/`.mono-sheet-danger` → danger fill | destructive confirms render red; error boundary |
| 14 | **Cricket event colours** | `mono.css` `.mono-over-pip-*`, `.mono-cricket-key-four/-six`, `MonoCricketLiveScore.jsx` FREE HIT `#ff6b00`, `MonoCricketSpectator.jsx` | 4/6/W pips readable; FREE HIT ≥ 4.5:1 |
| 15 | **Remove legacy blue `#0066ff`** | `MonoOnboarding.jsx`, `MonoCricketTournament.jsx`, `GenericSetsTournament.jsx`, `GenericGoalsTournament.jsx`, `MonoTournamentList.jsx`, `components/PlayerSearchInput.jsx`, `utils/confetti.js` (→ gold + team cores) | `rg -i 0066ff src` empty outside showcases |
| 16 | **Raw greys → ink scale: tournament setup + list** | `MonoTournamentSetup.jsx`, `MonoTournamentList.jsx` | ratchet −~140; screenshots |
| 17 | **Raw greys → ink scale: tournament detail** | `MonoCricketTournament.jsx`, `GenericSetsTournament.jsx`, `GenericGoalsTournament.jsx`, `KnockoutMatchCard.jsx` | ratchet −~250 |
| 18 | **Raw greys → ink scale: account** | `MonoProfile.jsx`, `MonoUserSearch.jsx`, `MonoOnboarding.jsx` | ratchet −~110 |
| 19 | **Raw greys → ink scale: quick match + shared components** | `MonoQuickMatch.jsx`, `PlayerChip.jsx`, `PlayerSearchInput.jsx`, `ErrorBoundary.jsx`, `RouteRecoveryActions.jsx`, `TournamentNotFoundActions.jsx`, `index.jsx` fallbacks, `ShareLiveMatch.jsx`, `ReportMatch.jsx` | ratchet −~60 |
| 20 | **Raw greys → ink scale: history, stats, new-user flow** | `MonoHistory.jsx`, `MonoStatistics.jsx`, `NewUserFlow.jsx`, `mono.css` (`.mono-divider #eee`, `.mono-badge-paused`, `.mono-set-won`, keyframe greens) | ratchet −~50 |
| 21 | **Team-ish palettes in one place** | `TeamColourPicker.jsx` swatches → engine `PRESETS`; `models/types.js` player colours; `MonoTennisLiveScore.jsx` confetti | picker shows the same 11 swatches |
| 22 | **Delete dead colour code** (D5) | `BrutalistBlueVariants.jsx`, `MonoSportHome_TABBED.jsx`, `MonoHome.jsx`, `MonoSetup.jsx`, `MonoLiveGame.jsx` (imported nowhere); optionally the retired-palette showcases | `bun run build`; ratchet −218 |
| 23 | **Ratchet → ban** | `palette.test.js` | count is 0 outside `index.css`, `palette.js`, `teamColour.js` |

PRs 1–2 change no pixels. PRs 3–5 change the whole app at once, but each moves only one value family. PR 6 is the direct fix for the dialog Harsha flagged. It can be pulled forward to straight after 1, since it only needs the new `--se-color-scrim` and `--se-shadow-hard-lg` tokens.

---

## 8. Notes outside colour (filed, not fixed here)

- `/play` sport grid overflows a 390px viewport: four fixed-width columns, so the right column is clipped (`m-play-hub.png`).
- `--se-border-standard: 1.5px` rounds to 1px at DPR 1 and differs per device. Integer widths are proposed in §6.1.
- The `index.css` comment and `BLEND-GOVERNANCE.md` §4 promise a zero-blur `3px 3px 0` shadow that the tokens do not produce. This is a doc-vs-code mismatch of the kind `AGENTS.md` says must be fixed; PR 0 or PR 5 resolves it.

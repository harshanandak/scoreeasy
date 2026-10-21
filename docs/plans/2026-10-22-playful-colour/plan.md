# Playful colour: direction and phased rollout

**Date:** 2026-10-22 · **Type:** design direction + plan (no app code changed) · **Branch:** `design/playful-colour` (cut from master `28c4bdb`)
**Trigger:** Harsha, 2026-10-22: "make the app more colourful, where it takes different colours. The style and sense need to be more playful. Right now it's only one colour, green, and mono."

**Prototype:** `prototype/playful-colour-app.html`. It is one self-contained file that opens from disk and loads fonts from Google Fonts. The three directions and light/dark can be switched in the page. URL parameters:

| Parameter | Values | What it does |
|---|---|---|
| `d` | `kit`, `sticker`, `bug` | direction |
| `theme` | `light`, `dark` | colour theme |
| `w` | `390`, `360` | phone width |
| `s` | a screen name | show one screen only |
| `bare=1` | | the screen fills the viewport |
| `audit=1` | | runs the measured checks below and writes them into the page |

**Screenshots:** this folder, at 390×844 unless the name says `360`. They are captured with headless Chrome at DPR 2.

Sources used:

- `AGENTS.md`, `DESIGN.md`, `PRODUCT.md`;
- the closed colour audit (`origin/docs/colour-system-audit`, PR #160): white on today's green is 3.35:1, green carries nine meanings, LIVE is both green and red;
- the shipped volleyball board (PR #157: `TeamSetsBoard.jsx`, `teamBoard.css`);
- `src/lib/teamColour.js`, `src/lib/sportMarks.js`, `src/models/sportRegistry.js`, `src/models/sportFocus.js`;
- the 2026-07-26 ICP game designs;
- the scorer and live-flow states as shipped. These were read from `MonoGoalsLiveScore`, `MonoTennisLiveScore`, `MonoCricketGuidedScorer`, `LiveBroadcastBar`, `ShareLiveMatch` and `MonoWatchMatch`. The boards in the prototype use only those states.

---

## Decisions needed

1. **Direction.**
   - A: **Kit** (default, recommended).
   - B: Sticker.
   - C: Scorebug.
   - D: Kit, borrowing Scorebug's 3-letter team codes on the spectator scorebug.
2. **Football's colour.**
   - A: Pitch green (default). Football's engine-normalised green (`#00662a`) is identical to the Go button green. They stay apart structurally: Go is always a bordered, labelled button and never a tile.
   - B: Move football to teal and move table tennis to another hue.
3. **Where the sport mark goes in sports without a serve** (football, basketball, hockey, kabaddi).
   - A: On the board's sport chip, next to the clock (default). It never goes on a team key, because a mark on a key would read as possession, and no engine tracks possession.
   - B: On the key of the team that scored last.
4. **Live destination** (§7).
   - A: A 5th tab, "Live" (default, a proposal).
   - B: Inside Play as a "Watch" section.
   - C: Keep the Home strip and add "See all".
5. **Kabaddi do-or-die and raids.** Today's engine has only +1, Super Tackle (+2) and All Out (+2). The kabaddi PR can either:
   - A: ship the board on today's states and file the raid resolver separately (default);
   - B: wait for a rules sign-off and an engine change.

Silence means every default.

---

## 1. Three directions (all share one colour system)

The colour system is constant: neutral chrome, one Go green, gold for the win, danger red, and nine sport identities. The directions differ in how colour is applied.

| Direction | One line | Risk |
|---|---|---|
| **Kit (recommended)** | Apple-Sports gradients. Every sport and team is a blended, engine-gated gradient with its mark cropped at the edge. The chrome stays calm and neutral. | Least risk. It is the approved scorer extended to the whole app. |
| Sticker | Flat die-cut colour. Solid sport fills with a white keyline, the mark as a round peel-off sticker, pill controls, and a small tilt on badges only. | The closest to childish, and the flat fills lose the "blended" Harsha asked for. |
| Scorebug | Broadcast graphics. One ink scorebug bar per screen, sport stripes, angled corners, and condensed caps for bug labels only. | Drifts back toward heavy ink, which is the brutalism Harsha rejected. |

**Why Kit:**

- It is already what Harsha approved on the volleyball board.
- Colour lands on identity (sport, team), not on chrome, so the app reads as one product with nine personalities.
- It needs no new shape language, just the board's own gradient engine applied to sport tiles.

**Screenshots, most telling first:**

- `kit-play.png`: the nine sport identities on one screen.
- `kit-home.png`: the blended team hero, plus Rematch as the only Go.
- `kit-cricket.png`: the richest board, in the team-colour language.
- `kit-spec-cr-final.png`: the spectator view, with the result and one gold.
- Comparison sets: `sticker-*.png`, `bug-*.png`, `kit-dark-*.png`, `kit-360-*.png`.

## 2. Colour roles and tokens (Kit, light primary)

The API keeps the existing `--se-color-*` names, so consumers don't change. The values below replace today's.

| Role | Token | Light | Dark | Rule |
|---|---|---|---|---|
| Canvas | `--se-color-canvas` | `#f4f5f7` | `#0e0f12` | the page; neutral, no green or cream cast |
| Surface | `--se-color-surface` | `#ffffff` | `#191a1f` | cards, sheets, inputs, controls |
| Surface sunk | `--se-color-surface-warm` | `#eceef2` | `#25272d` | segmented tracks, link wells, the paused chip |
| Ink | `--se-color-ink` | `#0b0b0d` | `#f4f5f7` | text, control edges, hard shadows, focus ring |
| Ink 2 | `--se-color-ink-soft` | `#4a4b52` | `#b9bbc2` | secondary text |
| Ink 3 | `--se-color-ink-muted` | `#5f6067` | `#a2a4ab` | meta text (never lighter: the audit's `#888` family fails) |
| Hairline | `--se-color-line-soft` *(new)* | ink @ 10% | ink @ 12% | dividers inside a surface; never a control edge |
| Go (action) | `--se-color-action`, `-action-hi` *(new)*, `-action-strong` | `#00662a`, `#007c34`, `#004720` | same | fill of the ONE forward action per screen, as a 168° gradient; white label; 2px ink edge plus a 3px ink offset |
| Live | `--se-color-live` *(new)*, `--se-color-live-soft` *(new)* | `#00662a` on `#d9f6dd` | `#7ee2a2` on `#123321` | the word "Live" plus a breathing dot; never colour alone |
| Win | `--se-color-gold` *(alias `--se-blend-gold`)*, `--se-color-gold-ink` *(new)*, `--se-color-gold-soft` *(new)* | `#f5b700`, `#7a5410`, `#fff1c2` | `#f5b700`, `#f5c84c`, `#3a2f0c` | one milestone per screen; the gold fill always takes ink text |
| Danger | `--se-color-danger`, `-danger-soft` | `#b42318`, `#fbe9e7` | `#ff8f84`, `#3a1714` | destructive rows and confirms, and the wicket key |
| Warning | `--se-color-warning`, `-warning-soft` | → gold-ink on gold-soft | same | reconnecting/offline banner, FREE HIT |
| Focus | `--se-color-focus-ring` | = ink | = ink | 3px outline with a 3px offset (no longer blue, which clashed with blue teams) |

**Riskiest contrast pairs (measured, WCAG 2.x):**

| Pair | Light | Dark |
|---|---:|---:|
| White label on the lightest Go stop `#007c34` (core 7.16, strong 10.93) | **5.34** | 5.34 |
| Ink 3 on surface sunk | **5.39** | 6.00 |
| Ink 3 on canvas / surface | 5.74 / 6.26 | — / 6.98 |
| Danger on danger-soft | **5.61** | 7.25 |
| Gold-ink on gold-soft (offline banner) | 6.00 | — |
| Live text on live-soft | 6.20 | 8.73 |
| Ink on gold | 10.91 | 10.91 |
| Ink 2 on canvas | 7.96 | 9.06 (on surface) |
| On-ink live green `#5ee08f` on ink (Scorebug only) | 11.74 | — |
| Surface vs canvas (non-text) | 1.09 | — |

The surface-versus-canvas separation stays a known gap on purpose. Cards separate by hairline and lift shadow, not by fill.

## 3. Sport identities

Each sport's source colour runs through `normalise()` in `teamColour.js`, the engine that already gates team colours. A sport tile is therefore gated exactly like a scorer key: the label is measured on every gradient stop, on the sheen, and with the mark under it.

| Order (`sportFocus.js`) | Sport | Name | Source | Band → text | hi / core / lo | Worst label ratio | Mark |
|---|---|---|---|---|---|---:|---|
| 1 | Cricket | Royal blue | `#2563eb` | deep → white | `#2863e4` `#154ecd` `#122da5` | **4.63** | ball with seam (new) |
| 2 | Kabaddi | Rani pink | `#e11d74` | deep → white | `#ce276c` `#b6005a` `#87003c` | **4.67** | raider pictogram (new) |
| 3 | Volleyball | Sun yellow | `#fbbf24` | bright → ink | `#ffd170` `#fbbf24` `#e3b21f` | 8.04 | shipped (`sportMarks.js`) |
| 4 | Badminton | Shuttle violet | `#7c3aed` | deep → white | `#7b4edc` `#6938c6` `#52159c` | **4.67** | shuttlecock (new) |
| 5 | Football | Pitch green | `#16a34a` | deep → white | `#007c34` `#00662a` `#004720` | 4.71 | ball with panels (new) |
| 6 | Basketball | Court orange | `#f97316` | bright → ink | `#ff9a64` `#ff8136` `#ec730f` | 5.39 | ball with seams (new) |
| 7 | Tennis | Optic volt | `#c6e83a` | bright → ink | `#d5f750` `#c6e83d` `#b0d841` | 9.50 | ball with seam (new) |
| 8 | Table tennis | Table teal | `#0d9488` | deep → white | `#007a70` `#00655c` `#004642` | **4.61** | bat and ball (new) |
| 9 | Hockey | Turf sky | `#38bdf8` | bright → ink | `#60cbff` `#38bdf8` `#39abe5` | 6.17 | stick and ball (new) |

Ink on every sport tint is at least 16.5:1. The new marks are drafts in the prototype's `MARKS`. Each game PR ports its own mark into `sportMarks.js`.

**How team, sport and brand colours coexist:**

1. **Team colour is the hero on boards.** It sits on the keys, the batting card and the spectator scorebug, and it never encodes lead, serve or win alone.
2. **Sport colour is the identity everywhere else.** That means tiles, row badges, the board's sport chip, history bars and the profile ring. On a board, the sport shows up only as the small header dot or chip and the mark, so it never competes with the two teams.
3. **The brand is neutral chrome plus Go green plus gold.** Go appears at most once per screen, and green is never decoration.
4. **When a team colour equals a sport colour** (a yellow team in volleyball), the board is still unambiguous: the key carries the team name, and the sport colour appears only as a 9px dot in the header.

## 4. Type, shape, motion

| | Rule |
|---|---|
| Type | Display: **Bricolage Grotesque** 800, tight tracking (−0.02 to −0.04em), sentence case. UI: **Figtree** 500–850. Numerals: **Barlow Condensed** 800, tabular (kept from the board). No uppercase mono labels. |
| Shape | 22px cards, 20px tiles, 24px keys, 14px controls, round chips. Controls you press keep the Mono-strength edge: 2px ink border, 3px ink offset shadow, translating 2px when pressed. Every other surface gets a hairline and a soft lift. |
| Colour per screen | One hero, one Go, at most one gold. Wash: two radial tints of the screen's identity colours at the top of the canvas (Kit only; 35% in dark). |
| Motion | Taps use a spring scale of 0.965 over 180ms (`cubic-bezier(.34,1.56,.64,1)`). A score bump is scale 1.12 → 1 over 260ms. Entry is a staggered rise of 45ms steps. The winner gets one 900ms confetti burst in the team colours plus gold, behind the text. The live dot breathes. Everything is off under `prefers-reduced-motion`. |
| Illustration | Bold ball-and-action silhouettes, always in an engine motif colour or the on-colour, never as wallpaper. |

**Dark mode** swaps the neutral tokens only (table in §2). Team and sport gradients stay the same, because the engine gates are absolute. Control edges become light ink with a black offset shadow, and the canvas wash drops to 35%.

## 5. Measured checks (prototype `?audit=1`)

**What the audit covers.**

- **Contrast:** every element with its own visible text is checked against each background stop under it. Gradients declare their engine stops, including sheen and mark overlay. The threshold is 4.5:1 for body text and 3:1 for large text (≥24px, or ≥18.66px bold).
- **Touch targets:** every button and input must be at least 48×48.
- **Overflow:** nothing may cross the phone edge outside scroll rows, and named text must not truncate.

**Results.**

| Run | Text nodes | Contrast fails | Unmeasured | Under 48px | Overflow |
|---|---:|---:|---:|---:|---:|
| Kit, all 18 screens, 390 and 360 | 472 | 0 | 0 | 0 | 0 |
| Sticker, 7 screens, 390 and 360 | 199 | 0 | 0 | 0 | 0 |
| Scorebug, 7 screens, 390 and 360 | 203 | 0 | 0 | 0 | 0 |
| Every direction, dark | same counts | 0 | 0 | 0 | 0 |

- **Kit:** worst body text 4.61 (table-tennis tile), worst large text 4.63.
- **Sticker and Scorebug:** worst 4.69.
- **Sanity check:** with today's green swapped in, the audit flags "Rematch" at 3.33:1, so it does catch failures.
- **By eye:** I reviewed every screenshot for crowding, overflow and cheapness. Seven problems were found and fixed:
  - confetti over the winner text;
  - Scorebug truncating names at 360 (it now uses 3-letter codes, as broadcasts do);
  - the cricket board's buttons losing their text colour in dark mode;
  - the batting card clipping at 360×640;
  - cricket spectator numerals colliding (164/6 v 165/7);
  - the volleyball spectator period line wrapping mid-score;
  - a default-styled "Stop sharing" button.
- **By eye, nothing left:** after those fixes, the review found nothing else. The screens checked were all 18 Kit screens, the 7 Sticker and 7 Scorebug screens, the Kit dark and 360 shots, and the scorer at 360×640.

## 6. The palette ratchet (every token PR must keep it green)

`src/designs/design1-mono/theme/palette.test.js` guards three things.

**(a) Drift.** `palette.js` `cssDeclarations` must mirror `index.css :root` string for string. Every token change edits both in the same diff, and new `--se-color-*` tokens must be pinned there too, because the coverage test enumerates them.

**(b) Contrast pairs.**

- Two entries become passing, so drop their `knownGap`:
  - `inverse on action`: 3.35 today → 7.16;
  - `action on canvas`: 3.15 today → 6.56.
- `surface vs canvas` stays a known gap at 1.09.
- Add pairs for the new live, gold-ink and focus-on-canvas tokens.

**(c) The raw-literal ratchet: `BASELINE = 669`.**

- The count must stay exactly equal. Every new sport mark adds a white/black luminance mask.
- Put the mask in one shared helper in `sportMarks.js`, so each new mark adds **0** literals instead of 2.
- If a PR removes literals (the audit counted 690 in shipped files), lower `BASELINE` to the new count in the same PR.

**(d) Engine lockstep.** Outside the test, `teamColour.js` `NEUTRAL` hard-codes the canvas, surface and ink values for its line and tint gates. The foundation PR must update it with the tokens and re-run `teamColour.test.js`.

## 7. Live destination (a proposal for Harsha to pick)

Today the only entry point is the "Live now" strip on Home. It is hidden when nothing is live and has no "see all". `listLiveFeed` returns:

- token and sport;
- points, sets and serve;
- period label;
- `lastEventAt`;
- team names and colours.

There is no viewer count or start time, so none is designed.

| Option | Shape | For | Against |
|---|---|---|---|
| **A (default)** | A 5th tab: **Home · Play · Live · History · Account**. A green dot on the tab while anything is live. | One tap from anywhere. A spectator-facing product needs a door. | Five tabs at 360 is the limit. It fits at 68px per tab with 0.7rem labels (`kit-360-live-list.png`). |
| B | Play hub gets "Watch live" above the sport grid | Keeps 4 tabs | Mixes "start" and "watch" on one screen |
| C | Home strip stays, plus "See all" → `/live` | Smallest change | Invisible when the strip is hidden |

The prototype draws option A:

- **List** (`kit-live-list.png`): sport filter chips, and one row per match with the sport badge, both teams with their colour dots, the scores, the period line, Live/Paused, and the update age from `lastEventAt`.
- **Empty state** (`kit-live-empty.png`).

"Nearby" and "Following" filters need data the feed doesn't have, so they are filed as follow-ups, not drawn.

## 8. What each phase reuses

| Existing piece | Reused in |
|---|---|
| PR #157 board (`TeamSetsBoard.jsx`, `teamBoard.css`), the team engine, `sportMarks.js` | F0 board shell; every game PR |
| `feat/colour-dialogs-hard-shell` (ConfirmActionPanel, MonoSheet, `mono.css`, plus an acceptance doc) | F0, but **only** the dialog/sheet commits. That branch also carries unrelated agent-config, `convex/live.ts` and route changes (63 files), so cherry-pick, don't merge. |
| `feat/team-colour-badminton` (local, unpushed; badminton team-colour scorer "in games not sets", TeamColourPicker plus tests) | G4 badminton. It **predates #157**: it builds on the old engine branch and uses `courtMotifs.js`, which `DESIGN.md` replaced with sport marks. It needs a rebase onto master and the shuttle mark in place of the court motif. |
| `docs/plans/2026-07-26-icp-games-design/` (per-game `*-v2.png`, `README-synthesis.md`, `README-adaptive-system.md`) | The per-game moments list in every G-PR (record strip, verb set, handoff step). Its frozen "green = lead, one accent" token law is superseded by §2. |
| Closed PR #160 colour audit | §2 numbers and the F0 literal clean-up targets |
| `prototype/directions*.html`, `palettes.html`, `feat/prototype-redesign` tokens | Reference only. Their green-tinted canvas and the May `codex/friendly-sports-design-tokens` set (blue action, `#8a8a8a`/`#b8b8b8` greys at 3.3 and 2:1) fail §2, so only the `--se-color-*` role names carry over. |

---

## 9. Phased rollout: small PRs

**Order:**

1. **F0** comes first.
2. Then the **game PRs**, in ICP order (G1 cricket → G9 hockey). Each touches only its own scorer files, its mark and its spectator view, so game PRs don't conflict with each other.
3. **App-screen PRs** (S1–S5) can land in any order after F0, in parallel with the games.

Each PR follows the shipping regime: the demo screenshots named below at 390×844 and 360×640, its checklist walked out loud, and `bun run test`, `lint`, `type-check` and the palette test all green.

### F0 Foundation: tokens, buttons, the board shell, dialogs (small; must land first)

- **Tokens and controls:**
  - §2 tokens in `index.css` plus `palette.js` (drift and contrast entries per §6), plus engine `NEUTRAL`;
  - Bricolage Grotesque and Figtree in the font import;
  - the `.se-ctl` (Mono-strength control) and `.se-go` (Go gradient button) classes;
  - the focus ring becomes ink.
- **Board shell:** factor out of `teamBoard.css`, with no visual change to volleyball:
  - the header (title, sport dot, Live, Finish);
  - the bottom bar (Undo with its restore hint, More);
  - the options sheet;
  - the confirm skin.
- **Marks:** the shared luminance-mask helper in `sportMarks.js` (0 new literals).
- **Dialogs:** cherry-pick the dialog/sheet commits from `feat/colour-dialogs-hard-shell`, restyled to §4. That means a hairline-and-lift container and Mono-strength buttons only; the hard shell does not go on every surface.
- **Acceptance:**
  - [ ] the volleyball board is pixel-identical before and after, apart from the font change;
  - [ ] the palette test is green;
  - [ ] the literal count is the same or lower, with `BASELINE` updated to match;
  - [ ] the end-match and discard dialogs both use the new skin, and discard reads as danger;
  - [ ] the focus ring is visible on every control in both themes.
- **Demo:** the dialogs before and after, plus the volleyball board unchanged.

### S1 Home and Play hub

- **Reuses:** prototype `home`/`play`, the `getSportsByCategory()` order, `MonoPlayHub`. This also fixes the audit's 4-column overflow at 390.
- **Acceptance:**
  - [ ] nine tiles in `sportFocus` order (Popular 6 in 2 columns, More 3 in 3 columns);
  - [ ] every tile label is measured (≥4.5) in tests via `contrastReport`;
  - [ ] the Home hero shows the last match in team colours, and Rematch is the only Go;
  - [ ] no tile or row truncates at 360;
  - [ ] dark mode is checked.
- **Demo:** `kit-home`, `kit-play`, `kit-360-play`.

### S2 Quick setup

- **Reuses:** `TeamColourPicker` (PR #157 / the badminton branch).
- **Acceptance:**
  - [ ] the matchup preview updates live from the picker;
  - [ ] swatches are 48px, and the selected one has a check plus `aria-pressed` (not colour alone);
  - [ ] the CTA names the outcome ("Start volleyball");
  - [ ] the format segmented control is 48px.
- **Demo:** `kit-setup`.

### S3 Finish: the winner moment

- **Reuses:** the `MonoMatchResult` gold medallion (one gold).
- **Acceptance:**
  - [ ] the winner card is in the winner's team colour, and the loser row is tinted;
  - [ ] the set chips agree with the board;
  - [ ] confetti appears once, behind the text, and is gone under reduced motion;
  - [ ] Rematch is the only Go, and Share and Details are Mono-strength;
  - [ ] a draw shows no winner card (football).
- **Demo:** `kit-finish`.

### S4 History and Profile

- **Acceptance:**
  - [ ] the month stack bar and legend sum to the list;
  - [ ] the selected filter chip is an ink fill;
  - [ ] row titles bold the winner only, and draws are plain;
  - [ ] the 4th tab reads Account or Sign in as today;
  - [ ] no `#888`-family greys remain in `MonoProfile`/`MonoHistory`, and `BASELINE` is lowered.
- **Demo:** `kit-history`, `kit-profile`.

### S5 Live flow: go live, share, spectator

- **Reuses:** `LiveBroadcastBar`, `ShareLiveMatch`, `MonoWatchMatch`, `ReportMatch`.
- **Restyle only. All copy stays:**
  - "Share this match live? Scores and team names will be public to anyone with the link.", with Share live / Keep private;
  - "● LIVE · public", Share, Stop;
  - Copy link → Copied ✓, Share…, Done;
  - the spectator top nav, the reconnecting banner, the scorebug with LIVE / PAUSED (no event for 90s) / FINAL, the Feed / Scorecard / Stats tabs, Report, and the sign-up banner.
- **Acceptance:**
  - [ ] LIVE is green everywhere, the red "live" dots are gone, and the "Go live" prompt is an offer, not a state;
  - [ ] PAUSED and FINAL carry words, not just colour;
  - [ ] the reconnecting banner uses the warning pair (6.00);
  - [ ] the spectator page shows team colours from the feed;
  - [ ] "This match isn't available" and kiosk mode are restyled;
  - [ ] the goals "0–0 sets" bug stays linked, not fixed here.
- **Demo:** `kit-consent`, `kit-share`, `kit-spec-vb-live`, `kit-spec-vb-paused`, `kit-spec-cr-offline`, `kit-spec-cr-final`.

### S6 Live destination (only if Harsha picks A, B or C in Decision 4)

- **Acceptance:**
  - [ ] the list reads `listLiveFeed` only, with no invented fields;
  - [ ] Paused after 90s matches the spectator rule;
  - [ ] the empty state has a Score a match CTA;
  - [ ] five tabs fit at 360 with ≥48px targets;
  - [ ] the dot on the tab appears only while the feed is non-empty.
- **Demo:** `kit-live-list`, `kit-live-empty`, `kit-360-live-list`.

### Game PRs: one per sport, in ICP order

Every game PR builds on the F0 board shell. It owns only its scorer, its mark and its spectator view, and uses today's rules (no rule changes without a decision).

**Each game PR's checklist starts with:**

- [ ] team-colour keys and labels pass `contrastReport` with the sport's mark under them;
- [ ] Undo is always visible and shows the state it restores;
- [ ] every state named below is walked, including undo out of it;
- [ ] it works at 360×640 without scrolling the scoring zone;
- [ ] it works in light and dark;
- [ ] the spectator view agrees with the board.

**G1 Cricket** (`MonoCricketGuidedScorer`, `MonoCricketLiveScore`, `MonoCricketTestLiveScore`, `scorecard/BattingCard.jsx`, `BowlingCard.jsx`, `CricketScorebug.jsx`)

- **States and moments:**
  - "Over 12.3 · Chasing N";
  - runs/wkts (overs) and CRR, plus NEED x OFF y / RRR;
  - striker * and non-striker with R (B) and SR;
  - bowler O-M-R-W and econ;
  - the partnership and the over strip (pips, with empty future slots);
  - keys DOT/1/4/6/W, other runs 2/3/5/7, and extras Wide/No-ball/Bye/Leg-bye;
  - the wicket sheet, plus ↩ ⇆ ⋯;
  - banners: powerplay, Last Man Batting, FREE HIT (warning pair, replacing `#ff6b00` at 2.71:1) and Target;
  - the end of an innings as a designed handoff step;
  - Test: Nth Innings, Lead by / Trail by, declare and draw;
  - the batting card (R B 4s 6s SR).
- **The tournament scorer** (`MonoCricketLiveScore`) keeps its leaner set: keys 0–6, Wide +1, No Ball +1, Wicket, with no batters, bowler or pips.
- **Mark:** ball with seam. It sits on the batting team's hero card, because the batting side holds the play the way a serve does.
- **Live scorecard:** the spectator Scorecard tab shows totals only today. Adding the batting card there is a follow-up, filed separately.
- **Linked, not fixed here:** SA-08 (300ms timers override undo on Test innings advance).
- **Demo:** `kit-cricket`, `kit-360-cricket`, an innings break, a wicket sheet, FREE HIT, `kit-spec-cr-final`.

**G2 Kabaddi** (`MonoGoalsLiveScore`, kabaddi branch)

- **States:** timed halves "1st Half - m:ss" / "Half Time" / "2nd Half" / "Full Time", "Time's up!", and keys +1, Super Tackle (+2) and All Out (+2) for each team.
- **Mark:** raider pictogram, on the sport chip (Decision 3).
- **Moments:** half time as a handoff step, and all-out as a celebrated moment (a key bump plus the last-action line).
- **Not in the engine:** raids, do-or-die, mat strength and bonus. These are designed in `kabaddi-v2.png` and need Decision 5.
- **Live view:** a scorebug with the half and clock.
- **Linked:** SA-10 (goals tournament clock resets on refresh) and the "0–0 sets" spectator bug.

**G3 Volleyball follow-ups** (PR #157 shipped the board). This PR does only two things:

- the **set-point / match-point cue**: Forge `sets-scorer-show-a-3a0dd547`. `pointState` already exists in `models/live/volleyball.js`, so this is presentation only. Show the words "Set point" or "Match point" on the meta line, in the warning pair;
- the **clock stuck at 0:00**: Forge `match-clock-stays-at-49c8111d`, including restored matches.

It also ports the Kit header chrome from F0. SA-12 (the 27-point cap decision) stays open.

**G4 Badminton** (start from `feat/team-colour-badminton`)

- **Work:** rebase onto master, then swap the court motif for the shuttlecock mark.
- **States:** "in games not sets" wording, Single game / Best of 3, 21 points capped at 30, and service changing every point (`serviceRotation: 1`).
- **Moments:** game point and match point, and the interval at 11 if the engine has it. Don't add it if it doesn't.
- **Serve side:** right or left from score parity is a real badminton rule. Show it only if the scorer already derives it; otherwise file it.
- **Live view:** the Kit spectator scorebug.

**G5 Football**

- **States:** whole-half tap target (+1), halves, "Half Time", "Full Time", OT 1 and OT 2, "N min match", and "Draws allowed".
- **Mark:** ball, on the sport chip.
- **Moments:** goal (a key bump), half time as a handoff, and a draw finish with no winner card.
- **Not drawn:** cards, scorers and subs. They are in `football-v2.png` but not in the engine.

**G6 Basketball**

- **States:** +1/+2/+3 per team (prototype `kit-goals`), the timed countdown m:ss, "Time's up!", and "No draws".
- **Mark:** ball, on the sport chip.
- **Not drawn:** quarters, fouls, bonus and the shot clock (`basketball-v2.png`, not in the engine).
- **Demo:** `kit-goals`, `kit-360-goals`. The hardest team pair, black v yellow, passes because the engine maps black to `#383838`.

**G7 Tennis** (`MonoTennisLiveScore`, `TennisScorebug`)

- **States:**
  - "Set X of N" / "Tiebreak" / "Match Complete";
  - "a – b sets · best of N";
  - 0/15/30/40/AD and tiebreak numbers;
  - ● before the server's name, plus the mark on the server's key;
  - "N games";
  - the "Set 1: 6-4" strip;
  - the "X wins Game N" toast.
- **Moments:** deuce. Today there is no "Deuce" text. Showing "Deuce" at 40–40 is a derived label, not a rule change. Also the tiebreak, as a distinct header state.
- **Demo:** `kit-tennis`.

**G8 Table tennis** (sets scorer)

- **States:** 11 points, win by 2, best of 5 or 7, service every 2 points, and "Single Set" / "Set X of N".
- **Mark:** bat and ball.
- **Moments:** game point and deuce at 10–10, from the same derived `pointState` as volleyball.

**G9 Hockey**

- **States:** the goals family as football (whole-half tap), and "Goals, GD standings".
- **Mark:** stick and ball, on the sport chip.
- **Live view:** a scorebug with the period line.

---

## 10. Inspected and found nothing wrong

- Every prototype screen was measured for contrast, targets and overflow in light and dark at 390 and 360 (numbers in §5).
- Every sport tile's gradient stops, sheen and mark overlay were checked through the engine (§3).
- The Go button's three stops were checked (§2).
- The black v yellow and red v blue team pairs were checked through the engine on the boards.
- No contrast failure was found.

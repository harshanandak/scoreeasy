# ScoreEasy Hi-Fi Reference — Design & Flow Inventory

Source: `C:\Users\harsha_befach\Downloads\ScoreEasy App Flow HiFi.dc.html` (~694 KB single-file design-canvas export, `design_doc_mode = canvas`).

Format note: this is a **hand-authored HTML canvas**, not a Figma/design-tool dump. There are **no `<svg>`, no `class=`, no `data-name`** attributes — every screen is an absolutely-positioned `<div>` phone frame (300×600, `border-radius:34px`) built from inline-styled divs. Frames are grouped by `<!-- BAND n -->` comments and section titles; each frame carries a `data-game="<sport>"` attribute and a small drag label (its screen name). 90 labelled frames across 14 bands. The header explicitly frames this as "**every wireframe frame, rendered in the production design language**" and calls out a **Scorer-style toggle** with three co-located variants per live scorer: **refined** (instrument scorers with the FULL option set — the stated design direction), **new** (first instrument exploration), **old** (original cards).

---

## 1. SCREEN / FRAME INVENTORY (90 frames)

### Band 1 · Start, schedule & home
- **Home** — landing dashboard (ScoreEasy wordmark, avatar, live/upcoming feed).
- **Start · Guided** — guided match-creation entry.
- **Start · Browse** — browse/all-sports match-creation entry.
- **Setup** — generic match setup (teams, format).
- **Home · first run (empty)** [Band 13] — empty-state home before any games.

### Band 2 · In-match & connective (live scorers + spectator + result)
- **Cricket · live** — richest scorer: `84/3`, Target 157, Need 73 off 44, RRR, batter table (4s/6s/SR), Bowl/Over, action row OUT · Wide · No-ball · Bye.
- **Football · live** — big side scores (`2` / `1`), "Tap a side to score", Possession bar, scorer names (Patel, Roy).
- **Tennis · live** — SET·GM / PTS grid, `40`/`30`, "break point", Aces/1st serve/Winners, "Tap the point winner".
- **Basketball · live** — `58`/`52`, Q3, By quarter, BONUS, +1 / +2 / +3 buttons.
- **Volleyball · live (sets)** — per-set strip `25·22·18`, "set point soon", Aces/Blocks/Errors, "Hawks point / Wolves point".
- **Badminton · live (sets)** — `21·19·18`, "3 from game", "Tap who won the rally".
- **Hockey · live (goals)** — goal-based scorer.
- **Result** — FULL TIME, "Reds win by 14", line scores, Done / Share card / Scorecard.
- **Scorecard** — detailed post-match scorecard.
- **Standings**, **Fixtures**, **Bracket** — competition context screens.
- Spectator set: **Spectator · cricket**, **Spectator · football**, **Spectator · tennis**, **Spectator · cricket Graphs**, **Match · graphs**, **One system → every sport** (design-system explainer frame).

### Band 3 · Tournaments
- **Create tournament (→ Fixtures)**, plus Standings/Fixtures/Bracket reuse.

### Band 4 · History & stats
- **History · games**, **Players · leaderboard**, **Match detail (from history)**, **Match · graphs**, **Player profile**, **Team stats**, **History · empty** [Band 13].

### Band 5 · Teams
- **My teams · grouped**, **Create team · limits**, **Add players · sources**, **Roster · squad & bench**, **Teams · empty** [Band 13].

### Band 6 · Friends & social
- **Your profile (account)**, **Activity feed (social)**, **Friends list**, **Find & invite friends**, **Player profile (public · add friend)**, **Notifications**.

### Band 7 · More / Settings
- **More · settings** — Sign in to sync, Scoring defaults (Default sport, Confirm wicket/goal), Sharing (Auto-share live link), Appearance, Data (Export history, Clear all data).

### Band 8 · Team-only (no player names)
- **Cricket live · team-only**, **Cricket spectator · team-only**, **Football spectator · team-only** — simplified scorers for casual/anonymous play.

### Band 9 · Teams: create & manage
- Create team · limits, Add players · sources, Roster · squad & bench (detailed variants).

### Band 10 · Attribution & player stats
- **Football · who scored?**, **Cricket · new batter in**, **Football · match events**, **Players & stats · any sport**, **Player profile**, **Team stats**.

### Band 11 · Missing connective screens
- **Onboarding · first run → Home**, **Toss · Setup → Live (cricket)**, **In-match ⋯ menu (from Live)**, **Share live link (→ Spectator)**, **Create tournament (→ Fixtures)**, **Your profile (account)**.

### Band 12 · Friends & social
- Activity feed, Friends list, Find & invite friends, Player profile (public · add friend), Notifications.

### Band 13 · Empty / first-run states
- Home · first run (empty), Teams · empty, History · empty.

### Band 14 · Per-game tap-through flows (deep interaction storyboards)
- **Sport journeys** (full storyboards): 🏏 Cricket, ⚽ Football, 🎾 Tennis, 🏀 Basketball, 🏑 Hockey, 🏐 Volleyball, 🏸 Badminton, 🤾 Kabaddi.
- **Attribution / edge flows:** Basketball · who scored?, Spectator · basketball, Basketball · box score, Hockey · who scored?, Spectator · hockey/volleyball/badminton, Cricket · how out?, Cricket · long-press No-ball → runs, Football · match summary, Football · who scored?, Cricket · new batter in.
- **New-game setups:** New cricket / football / tennis / basketball / hockey / volleyball / badminton game.
- **Credit-the-point flows:** Tennis · credit the point, Volleyball · credit the point, Badminton · credit the point.
- **Customize & rules (from Setup)**, **Cricket · ball-by-ball**, **Cricket · end innings / match**, **Cricket · teams & squads → profile**, **Football · lineups → profile**, **Football · player ratings**, **Redesign coverage map** (index frame).

---

## 2. USER FLOWS (intended navigation)

1. **First run:** Onboarding (`Continue with Google / Apple / Use phone number`) → Home (empty state) → Start.
2. **Create & score:** Home → Start · Guided / Browse → Setup (→ Customize & rules) → sport-specific "New … game" → (cricket: Toss) → **Live scorer**.
3. **In-match:** Live scorer → **⋯ menu** → Share live link → Spectator (public link, QR "Scan to watch", WhatsApp/Messages). Attribution sub-flows fire on scoring events: Football "who scored?" → Assist/Own goal → Confirm goal; Cricket "how out?" → dismissal type → new batter in; Tennis/Volleyball/Badminton "credit the point" → Winner/Error type → Confirm point.
4. **Finish:** Live → **Result** (FULL TIME) → Share card / Scorecard / Done → (Rematch).
5. **Post-match / records:** Home/History → History · games → Match detail → Match · graphs; Players · leaderboard → Player profile → Team stats.
6. **Tournaments:** Create tournament → Fixtures → Standings → Bracket.
7. **Social:** Home → Activity feed ("is live · 3 friends watching · Watch") / Notifications (friend requests, match invites, live alerts) → Friends list / Find & invite → Player profile (add friend). Your profile shows friends/teams/cups + Games/Win%/MVPs.
8. **Teams:** My teams → Create team (limits) → Add players (sources) → Roster (squad & bench).

---

## 3. DESIGN LANGUAGE (extracted precisely)

### Color palette (by frequency / role)
| Hex | Role |
|---|---|
| `#fff` | Card/surface white (1025×) |
| `#12936a` | **Primary green** — brand "Easy", CTAs, accents (790×) |
| `#0c6e50` | Deep green (gradient end, pressed) |
| `#3fd598` | Bright mint accent / live glow |
| `#0c6e50`→`#12936a` | Primary gradient (`linear-gradient(150–170deg,#12936a,#0c6e50)`) |
| `#14201a` | Near-black ink (primary text, 486×) |
| `#46554d` | Dark secondary ink |
| `#6b7a72` | Muted text / captions (436×) |
| `#9aa8a0` | Faint label/placeholder (614×) — micro-labels, uppercase captions |
| `#f4f6f3` | App background / frame body |
| `#eef1ee`, `#e7ece8`, `#f0f2f0` | Subtle panel fills |
| `#e4e9e5`, `#dfe7e1`, `#cfd8d1`, `#c2ccc5`, `#e4e9e5` | Borders / dividers / avatar placeholders |
| `#e7f4ee`, `#bfe3d2` | Green-tint success/live wash |
| `#d64f43` | **Alert red** — OUT, errors, destructive (Clear all data), losing/negative (131×) |
| `#fdeceb`, `#e3b8b3`, `#c9b4b1` | Red-tint washes |
| `#b8862e` / `#c47d12` / `#e8b64c` / `#fff4e0` | **Gold/amber** — MVP, milestones, winner/cup accents |
| `#2f7bd6` | Blue — secondary team / info / "Blues" |
| `#7a4fd6` | Purple — occasional accent (ratings/tags) |

Semantic: green = brand/positive/live, red = out/error/destructive, gold = achievement/winner, blue/purple = team differentiation.

### Typography
- **Two families only:** `'Hanken Grotesk', sans-serif` (all UI/display) + `'DM Mono', monospace` (numeric readouts — clock `9:41`, scores, stats).
- Weights: **800** (display/wordmark/big scores), **700** (headings, most labels — 894×), **600** (medium labels), **500** (mono).
- Font-size scale (px): **8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 26, 28, 30, 36, 38, 40, 42** then **big score numerals 60 / 74 / 76 / 84 / 88 / 92 / 104**. Body ~13–16px; micro-labels 9–11px; screen titles 19–20px; canvas H1 40px/800.
- Letter-spacing: tight `-.02em` on display/wordmark; **positive tracking on uppercase micro-labels** `.03–.06em` (common), up to `.12–.22em` on the smallest all-caps captions. Uppercase + `letter-spacing` + `#9aa8a0` is the signature caption treatment.

### Spacing & radii
- Spacing scale roughly 4/5/6/7/8/10/11/15/16 px (gaps & padding); frame padding ~10–15px.
- **Corner radii:** `50%` (circles, 259×), `99px` (pills/capsule buttons, 252×), and a soft-rectangle family **10/11/12/13/14/16px** (cards/tiles, ~800× combined), `34px` (phone frame), small `2–6px` (chips/bars). Nothing sharp — everything is rounded.

### Shadows (depth)
- Card lift: `0 1px 2px rgba(20,40,30,.06–.08)` and `0 1px 3px rgba(20,40,30,.06–.08)` (soft, ~everywhere).
- Frame elevation: `0 18px 40px -20px rgba(20,40,30,.35), 0 0 0 1px rgba(20,40,30,.06)`.
- **Green glow on primary CTAs:** `0 12px 22px -12px rgba(18,147,106,.7)`, `0 10px 20px -10px rgba(18,147,106,.6)`, `0 6px 14px -6px rgba(18,147,106,.6)` — colored shadow = actionable/live.
- Bottom-sheet upward shadow: `0 -10px 30px -12px rgba(20,40,30,.25)`.
- Shadow tint is always the ink color `rgba(20,40,30,…)`, never pure black — a warm-green-black, key to the "soft" feel.

### Iconography & motion
- Icons are **CSS-drawn primitives** (bordered rounded rects, circles, bars) — e.g. the battery is a `20×10` rounded-rect with a 70% fill. No icon font, no SVG. Style = minimal geometric line/fill.
- **Keyframes (3):** `hfP` / `geP` = opacity pulse `1→.35→1`; `geGlow` = glow pulse `.9→.5`. Applied as `animation:hfP 1.4s infinite`, `geP 1.2/1.4s`, `geGlow 1.2/1.4/1.6/1.8s infinite` — used for **LIVE dots and active-state glows** (breathing "this is live" pulse).

---

## 4. "FRIENDLY / HI-FI" TRAITS (softer than a brutalist scorer)

- **Everything is rounded** — no square corners anywhere: 99px capsule buttons, 50% circular tap targets, 10–16px soft cards, 34px phone shell. The score itself sits on soft surfaces, not hard boxes.
- **Circular / capsule controls inside live scoring:** Cricket live uses circular buttons (5× `50%`) + pills (3× `99px`) for run/action buttons; Tennis live uses circular point buttons. Scoring is tap-a-big-soft-target, not tiny +/- steppers.
- **Plain-language micro-copy prompts** on every scorer instead of raw buttons: "Tap a side to score", "Tap the point winner", "Tap who won the rally", "Tap a team to add a goal", "Tap 0–6 · W · extras · ⋯", "Tap a player to open their profile ›". The UI *asks a question*.
- **Big friendly numerals** (60–104px, DM Mono) make the score glanceable and celebratory rather than dense.
- **Soft green brand warmth:** green-tinted washes (`#e7f4ee`), warm-green-black shadows, gold for wins/MVPs/milestones — an encouraging, celebratory palette vs stark black/white.
- **Gentle live feedback:** breathing opacity/glow animations on LIVE indicators (1.2–1.8s) signal "live" without harsh blinking.
- **Contextual coaching lines:** "break point", "set point soon", "3 from game", "Need 73 off 44", "RRR", "BONUS" — surfaced as soft caption chips, giving spectators/scorers context a brutalist scorer omits.
- **Flow simplifications:** team-only variants (Band 8) drop player names for casual play; "Confirm wicket / goal" is a *toggle* in settings so power users can skip the confirmation step.

## 5. NOTABLE UX PATTERNS WORTH PRESERVING

- **Undo last ball** — explicit correction affordance on the scorer (plus "Edit setup ›", "Edit profile", "Edit").
- **Post-event attribution mini-flows** — after each score, a bottom-sheet asks *who/how*: Football who-scored (Assist/Own goal/Skip/Confirm), Cricket how-out (Caught/LBW/Run out/Stumped/Hit wicket), Tennis/Volleyball/Badminton credit-the-point (Winner/Forced/Unforced/Double fault) — each with a **Skip** escape and a **Confirm** commit.
- **Long-press for edge cases** — "Cricket · long-press No-ball → runs" keeps the primary surface clean while exposing rare inputs.
- **Share-live** — Share live match sheet: Public link + Copy + **QR "Scan to watch"** + WhatsApp / Messages / More; optional **Auto-share live link** default in settings.
- **Spectator mode** — dedicated read-only live views per sport (+ graphs/point-by-point/momentum/box-score), separate from the scorer.
- **Live social feed** — "Eagles vs Hawks is live · 3 friends watching now · Watch"; notifications for match invites, friend requests, live alerts, milestones.
- **Empty/first-run states** designed explicitly (Home/Teams/History empty).
- **9:41 status bar + battery** on every frame — full device-chrome fidelity.
- **Bottom tab nav:** Home · Play · History · Friends/More.

## 6. NOT-YET-IN-A-TYPICAL-SCORER (new screens/features this Hi-Fi introduces)

- **Full social layer** — Activity feed, Friends list, Find & invite, public Player profiles with add-friend, Notifications, friend/mutual counts. A scorer becoming a social network.
- **"Watch live" spectator + share-link + QR** ecosystem, incl. per-sport spectator variants with **graphs / momentum / point-by-point / box score**.
- **Career records & milestones** — "reached 50 career wickets", MVP counts, Win%, cups on profile; Players leaderboard; Team stats.
- **Attribution depth** — assists, dismissal types, point-win reasons (winner vs unforced error vs double fault) feeding player stats.
- **Tournaments** — Create tournament → Fixtures / Standings / Bracket (semifinals/final).
- **Team-only mode** — anonymous/casual scoring without player rosters.
- **Kabaddi journey** — a sport most scorers omit.
- **Match graphs** — momentum/worm-style visualizations for both scorer and spectator.
- **Scorer-style toggle** (refined / new / old) — an in-design experiment mechanism, signalling the "refined instrument scorer with the FULL option set" as the intended direction.

---

## Could NOT determine from the file
- **Exact per-frame pixel layouts** of every one of the 90 frames (I deep-sampled the 6 core live scorers + onboarding/result/share/social/settings/attribution; the remaining frames were inventoried by label + section, not pixel-traced).
- **Interaction wiring** is implied by labels/arrows in the copy ("→ Home", "→ Spectator", "→ Fixtures"), not coded — there is no JS routing; navigation is my inference from the storyboard structure.
- **The three Scorer-style variants' full visual differences** (refined vs new vs old) — the toggle is described in the header but I did not pixel-diff all three co-located versions of each scorer.
- **`support.js`** (referenced `<script src="./support.js">`) was not present/inspected — likely the canvas pan/zoom runtime, not app logic.

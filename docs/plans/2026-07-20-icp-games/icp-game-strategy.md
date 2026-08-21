# ScoreEasy Sport Priority — India-First ICP Strategy

**Date:** 2026-07-20
**Author:** Fable (product strategy)
**Status:** Decision — this reshapes build priority for M1–M3
**Grounding:** `src/models/sportRegistry.js` (engines: `sets`, `goals`, `custom-cricket`; kabaddi currently on `goals` at line 348), gap analysis + 3 participation-weighted research lenses (school / college / casual-ground).

---

## 1. ICP & the "Who Plays What" Picture

**ICP (one line):** India-first — Indian schools, colleges, and casual players on grounds/maidans/streets — who need dead-simple, sport-accurate live scoring for the games they actually play, not the medal sports federations promote.

**The core distinction that drives everything:** rank by **participation**, not prestige. SGFI's official 40+ disciplines (archery, shooting, boxing, fencing, roll ball) are medal-driven and thin on real grounds. The genuine mass layer is a short, knowable list.

**Who plays what:**

| Segment | The games that actually get played |
|---|---|
| **Casual ground / maidan / street** | Tennis-ball & gully & box cricket (#1 by a mile — 33.4L tennis-ball matches logged in 2025, 2× leather-ball), pick-up volleyball, park badminton, small-sided football, PT-period tag games (kho kho, kabaddi, langdi, lagori) |
| **Schools** | Athletics/sports-day, cricket, volleyball, throwball (**THE girls' net sport** — 90k+ institutions), kho kho, kabaddi, badminton, football, basketball (urban/CBSE) |
| **Colleges (AIU/KIUG)** | Cricket, volleyball, football, basketball, kabaddi, badminton, table tennis, throwball (women's fests), kho kho, hockey |

**Two signals that reshape priority:**
1. **Girls' participation concentrates in throwball, kho kho, langdi, netball** — throwball is arguably the most-played *structured* girls' school sport and fits our existing `sets` engine with **zero bespoke work**.
2. **The biggest coverage gaps are not niche net sports — they are core mass sports we mis-serve or miss:** the raid/tag family (kabaddi mis-engined, kho kho + langdi missing) and athletics.

---

## 2. Sport Priority Tiers

### Tier-0 — Core (must be first-class; where scoring *fidelity* is non-negotiable)

These carry the ICP. A wrong or generic scoring model here is a product failure, not a polish gap.

| Sport | Engine | Why Tier-0 (evidence) |
|---|---|---|
| **Cricket** (tennis-ball / gully / box) | `custom-cricket` ✅ | #1 informal game by an enormous margin; 33.4L matches/2025. The default ground game everywhere. |
| **Kabaddi** | ⚠️ **needs raid engine** (on `goals` today) | Mass rural + school + AIU/KIUG sport, minimal equipment. Currently structurally mis-served — see §4. |
| **Volleyball** | `sets` ✅ | Top non-cricket ground game; minimal-space advantage drives rural + hostel + college play. |
| **Badminton** | `sets` ✅ | Ubiquitous park/colony/hostel play; sub-₹500 rackets; SGFI + AIU + KIUG. |
| **Football** (incl. small-sided/gully) | `goals` ✅ | Broad + deep regional pockets (Bengal, Kerala, Goa, NE, Mumbai maidans). |
| **Basketball** (colleges) | `goals` ✅ (weighted +1/+2/+3, quarters) | Urban/CBSE-school + inter-college staple; strong girls' participation. |
| **Throwball** | `sets` — **ADD** (zero bespoke) | THE structured girls' school/college net sport (90k+ institutions). Highest-value zero-cost gap. |
| **Kho Kho** | **needs raid/innings engine — ADD** | Curriculum-mandated (75-games push), strong girls', India won 2025 World Cup. Core, not niche. |

> **Why kho kho and throwball sit in Tier-0 despite being missing:** tier is about ICP centrality, not current support. Both are core mass sports; the plan's job is to close them, not rank them low because we haven't built them yet.

### Tier-1 — Strong secondary (build/keep first-class after Tier-0)

| Sport | Engine | Note |
|---|---|---|
| **Athletics / Track & Field** | **needs bespoke `track-meet` engine** | Highest *raw* sports-day participation, but a measured/ranked/heats model is a large distinct build — Tier-1, sequenced after the raid family. |
| **Hockey** | `goals` ✅ | AIU/KIUG medal sport; strong Punjab/Odisha/Jharkhand. |
| **Table Tennis** | `sets` ✅ | Common indoor school/hostel/college sport. |
| **Langdi** | **rides kho-kho raid/innings engine** | Curriculum-added, strong Maharashtra girls'. Near-free once kho kho ships. |
| **Ball Badminton** | `sets` — ADD (cheap) | Strong South-India (TN/AP/Karnataka) schools/colleges. |
| **Tennis** | `sets` ✅ (nested 15/30/40 + tiebreak) | Present in better-resourced colleges; already configured, don't over-invest further. |
| **Tug of War** | **light bespoke best-of-pulls** | Near-universal inter-house sports-day event; a bout tally, not a counter. |

### Park / Deprioritize — Low-ICP niche (freeze polish; see §5)

| Sport | Status | Reason |
|---|---|---|
| Pickleball, Squash, Rugby, Futsal, Handball | over-invested for ICP | Emerging-urban / elite-club / prestige / redundant — near-zero school+casual-ground footprint. Engine fine, ICP thin. |
| Lagori/Pitthu, Netball, Tenni Koit, Shooting Ball, Beach Volleyball, Dodgeball | low-ICP missing | Add only opportunistically (most fit existing engines cheaply); do not build bespoke for them now. |
| Wrestling / Boxing / Judo / Mallakhamb / Yogasana | low-ICP, bespoke | Measured/judged/bout models; real AIU/KIUG blocks but lowest ROI for a scoring app. Park indefinitely. |

---

## 3. Games to ADD

**Decision order:** Throwball (now) → Kho Kho (bespoke, high) → Langdi (rides kho kho) → Ball Badminton (cheap) → Tug of War (light bespoke). Athletics is a Tier-1 add, sequenced after the raid family because of build size.

### 3.1 Throwball — ADD FIRST (zero bespoke)
Net sport, 7–9 a-side, sets to 25 (win-by-2), best-of-3 — **identical shape to volleyball**. Add as a `sets` registry entry with a 3-second-hold note and throwball defaults. Highest value-to-effort ratio on the board; unlocks the largest under-served girls' segment.

### 3.2 Kho Kho — ADD (bespoke `raid/innings` engine)
Turn/innings based, not a counter. **Engine sketch:**
- **Structure:** match = 2 innings (optionally 4 turns); each **turn** = one side chases (~9 min / 7 min per turn), the other defends (runs); sides then swap.
- **Chase vs defend:** active chasers tag runners; defenders (runners) survive on the field. Only the chasing side scores during its turn.
- **Outs:** +1 per runner tagged out (or forced foul). Track outs per turn and cumulative.
- **Dream run:** track individual runner survival time (time-of-survival bonus / recognition); "dream run" = longest unbroken survival — surface as a stat, feeds tie-breaks.
- **Time:** per-turn countdown clock; turn ends on clock expiry or all-out (all active runners out → remaining time carries as a batch of fresh runners in real rules — model as "all-out, reset runners, clock continues").
- **Win:** higher aggregate points across innings; dream-run/time-of-survival as tie-break.
- **Shared engine:** built to also power **Langdi** (same innings/tag/timed-turn shape, hopping constraint is gameplay-only).

### 3.3 Langdi — ADD (rides kho-kho engine)
4 innings × 9 min, hopping-tag, points per out, sides alternate. **No new engine** — a config profile on the kho-kho `raid/innings` engine. Ship in the same epic's tail.

### 3.4 Ball Badminton — ADD (cheap `sets` entry)
Sets to target, win-by-2. South-India schools/colleges. Registry entry only.

### 3.5 Tug of War — ADD (light bespoke)
Best-of-N pulls — a bout tally, not a points counter. Small standalone "best-of tally" mode. Universal sports-day event; low build cost, high one-off participation.

**Does everything make the cut?** Yes for the above five. **No** (for now) to Lagori, Netball, Tenni Koit, Shooting Ball, Beach Volleyball, Dodgeball — see §5; most are cheap `sets`/`goals` entries to add opportunistically, none justify bespoke engine work against the ICP today.

---

## 4. Games to FIX — Kabaddi off `goals`, onto a proper Raid engine

**Problem (grounded):** `sportRegistry.js` line 348 maps kabaddi to `engine: 'goals'`. It has Super Tackle / All-Out +2 quick buttons and SF/SA/SD standings, so casual score*keeping* works — but the model is structurally wrong. A generic increment counter has **no raider/defender turn model, no do-or-die raid, no empty-raid tracking, no bonus line, no all-out auto-detection.** For a Tier-0 mass sport this is the single highest-priority correctness fix.

**Bespoke `raid` engine sketch:**
- **Turn model:** alternating raids — one team sends a **raider** into the opponent half; the other team defends. Track whose raid it is; auto-advance turn after each raid resolves.
- **Raid points:** +1 per defender touched/bonus; raider banks points only on a safe return.
- **Tackle points:** +1 to defenders on a successful tackle (raider stopped).
- **Do-or-die raid:** after 2 consecutive empty raids by a team, the 3rd is do-or-die — raider must score or is out. Auto-flag and enforce.
- **Empty raid:** raid with zero points — track the empty-raid counter per team (feeds do-or-die).
- **Super raid / super tackle:** raid ≥3 points = super raid (stat); tackle with ≤3 defenders = super tackle (+extra point per rules) — keep as configurable toggles.
- **Bonus line / bonus point:** award bonus-line point when eligible (≥6 defenders on mat); toggle by ruleset.
- **All-out:** when a team loses all players, opponents get **+2** and the team revives — auto-detect from out-count, don't rely on a manual button.
- **Time:** two timed 20-min halves (config: PKL 2×20, school variants shorter).
- **Revivals:** players revive on points scored by their team; track on-mat count to drive all-out + bonus-line logic.

**Reuse:** the raid engine and the kho-kho raid/innings engine are **cousins, not the same** — kabaddi is continuous-clock raid/tackle; kho kho is turn/innings chase. Build kabaddi's raid engine and kho-kho's raid/innings engine as two profiles under a shared "turn-based / non-counter" scoring family so config, UI patterns, and stat surfacing are shared. Langdi rides the kho-kho profile.

---

## 5. Games to PARK — freeze polish

**Park (freeze polish, KEEP listed):** Pickleball, Squash, Rugby, Futsal, Handball, Tennis (beyond current), Netball, Beach Volleyball. These are already supported on generic engines and cost nothing to keep listed; freezing means **no new customization, quick-buttons, or per-sport UX investment** until Tier-0/Tier-1 is done. Keeping them listed preserves optionality and avoids the "why did you remove my sport" complaint.

**Park + consider HIDING behind an "All sports / More" expander (declutter the default India-first grid):** Squash, Rugby, Futsal, Pickleball — near-zero ICP footprint; surfacing them in the primary picker dilutes the India-first identity. Move to a secondary list, don't delete.

**Do NOT build (park indefinitely):** Wrestling / Boxing / Judo / Mallakhamb / Yogasana (bespoke measured/judged — lowest ROI), Dodgeball (bespoke elimination), Lagori (bespoke round/elimination) — real games but not worth bespoke engines against this ICP now. Revisit only if a specific school/college customer demands it.

**Principle:** parking is about **where polish effort goes**, not deletion. Default grid = India-first Tier-0/Tier-1; everything else lives one tap away.

---

## 6. Per-Game Customization Needs — Tier-0 set

| Sport | Customization the scoring experience needs |
|---|---|
| **Cricket** | Ball-by-ball; format presets (T20/T10/gully/box); **box-cricket wall-zone runs** (back wall = 4, upper net = 6, no-run option) as a config layer on `custom-cricket`; gully house-rules toggles (one-hand-one-bounce out, own-runs, no last-man). |
| **Kabaddi** | Full raid engine (§4): raid/tackle points, do-or-die, empty-raid, super raid/tackle, bonus line, all-out +2 auto, revivals, 2×20 halves + school-variant timer presets. |
| **Volleyball** | Sets to 25 / decider 15, win-by-2, best-of-5/3, rotation/serve tracking, quick set-length presets for casual (single set to 15/21). |
| **Badminton** | Rally to 21, win-by-2, cap 30, best-of-3, auto service rotation (present); casual single-game-to-11/21 preset. |
| **Football** | Goal counter, timed halves, small-sided presets (5-a-side, first-to-N, timed); own-goal handling. (Panna nutmeg-instant-win is an unsupported edge — skip.) |
| **Basketball** | Weighted +1/+2/+3, four quarters, foul/timeout counters, shot-clock optional (present config — keep). |
| **Throwball** | Sets to 25, win-by-2, best-of-3, 7–9 a-side, 3-second-hold reminder; mirror volleyball UX with throwball labels. |
| **Kho Kho** | Raid/innings engine (§3.2): turn timer, chase/defend swap, outs per turn, dream-run / time-of-survival stat, all-out reset. |

---

## 7. How This Reshapes the Plan — Kernel Actions

This is a **priority re-sequencing**, not a scope explosion. Two bespoke engines (raid, raid/innings) plus cheap registry adds carry almost all the ICP value; the niche-scorer polish backlog gets parked.

### New epics / issues to file
1. **EPIC: Raid scoring family (turn-based, non-counter).** Umbrella for kabaddi + kho-kho + langdi. Establishes the shared "turn-based scoring" family so config/UI/stat surfacing is reused.
   - **ISSUE (Tier-0, high): Kabaddi raid engine** — move kabaddi off `goals` (registry line 348) onto bespoke `raid`; raid/tackle/do-or-die/empty/super/bonus/all-out+2/revivals/2×20. **Correctness fix, highest priority in the family.**
   - **ISSUE (Tier-0, high): Kho Kho raid/innings engine** — new sport + engine: innings/turns, chase vs defend, outs, dream run, per-turn timer, all-out reset.
   - **ISSUE (Tier-1, med): Langdi profile** — config on the kho-kho engine (4×9 innings, hopping-tag). Ships in the epic tail.
2. **ISSUE (Tier-0, high, cheap): Throwball `sets` registry entry** — zero bespoke; land early, unblock the girls'-segment story.
3. **ISSUE (Tier-1, cheap): Ball Badminton `sets` registry entry.**
4. **ISSUE (Tier-1, med): Tug of War best-of-pulls tally mode** (light bespoke).
5. **ISSUE (Tier-1, LARGE — flag): Athletics `track-meet` engine** — times/distances/heats/finals, ranked results. File now, schedule after the raid family; largest single build, so call out the architecture cost explicitly.
6. **ISSUE (cricket config layer): Box-cricket wall-zone runs + gully house-rules toggles** on existing `custom-cricket`.

### Reprioritize / park
7. **PARK issues:** freeze any open polish/customization issues for Pickleball, Squash, Rugby, Futsal, Handball, Netball, Beach Volleyball — label `park:low-icp`, move out of active milestones. Keep sports listed.
8. **UI issue: India-first picker** — default grid = Tier-0/Tier-1; move Squash/Rugby/Futsal/Pickleball behind a "More sports" expander.
9. **Downgrade** any niche net-sport bespoke asks (Tenni Koit, Shooting Ball, Dodgeball, Lagori bespoke) to backlog / opportunistic-only.

### Milestone placement (M1 foundation → M3)
- **M1 (foundation, now):** Throwball `sets` entry (cheap win, validates the "add via registry" path). Kabaddi raid engine **kicks off** here — it is the Tier-0 correctness fix and the anchor of the raid family; foundational because it defines the shared turn-based scoring family M2 builds on. India-first picker declutter + park-label sweep.
- **M2:** Kho Kho raid/innings engine (+ Langdi profile in the tail). Ball Badminton + Tug of War land here. Box-cricket/gully config layer.
- **M3:** Athletics `track-meet` engine (largest bespoke, needs the family patterns settled first). Opportunistic cheap adds (Netball/Beach Volleyball/Tenni Koit) only if capacity remains.

**Net effect on build priority:** effort shifts **from niche net-sport scorer polish → to two bespoke engines (raid, raid/innings) + throwball**, which together convert the mis-served/missing *core mass* sports (kabaddi, kho kho, throwball, langdi) into first-class experiences. That is where the India-first ICP actually lives.

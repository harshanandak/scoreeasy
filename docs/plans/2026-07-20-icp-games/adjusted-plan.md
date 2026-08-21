# ScoreEasy — ICP-Driven Per-Game Bespoke Roadmap (Adjusted Plan)

This plan pivots the 17-epic/99-issue HiFi upgrade to an ICP-driven, per-game-bespoke model. The shared brutalist×HiFi design-system infrastructure — foundation primitives, nav, match-end, motion, and spectator primitives — still ships first. On top of it, each PRIORITY game gets a DEDICATED workflow that builds a deep bespoke experience — a game-specific scoring board, live/spectator screen, micro-animations, and signature moments — instead of the old generic "per-sport scorer residual chips." Low-ICP games are deregistered, not parked.

Reference source docs: `docs/plans/2026-07-20-icp-games/icp-game-strategy.md` and `docs/plans/2026-07-19-hifi-live-app-upgrade/{master-plan.md,decomposition.v2.json}`.

## A. Finalized Priority Tiers + Registry Decisions

Tier = ICP centrality, not current support state.

### Tier-0 — build deep bespoke experience NOW (the priority set, 8 games)

| Sport | Engine | One-line ICP justification |
|---|---|---|
| Cricket | custom-cricket ✅ | #1 informal game by a huge margin (33.4L tennis-ball matches logged 2025); the default ground game everywhere. |
| Kabaddi | needs raid engine (on goals today, mis-served) | Mass rural + school + AIU/KIUG sport; structurally mis-engined — highest-priority correctness fix. |
| Volleyball | sets ✅ | Top non-cricket ground game; minimal-space advantage drives rural/hostel/college play. |
| Badminton | sets ✅ | Ubiquitous park/colony/hostel play; SGFI + AIU + KIUG. |
| Football | goals ✅ | Broad + deep regional pockets (Bengal, Kerala, Goa, NE, Mumbai maidans). |
| Basketball | goals ✅ (weighted +1/+2/+3, quarters) | Urban/CBSE-school + inter-college staple; strong girls' participation. |
| Throwball | sets — ADD (zero bespoke engine) | THE structured girls' school/college net sport (90k+ institutions); highest value-to-effort gap. |
| Kho Kho | needs raid/innings engine — ADD | Curriculum-mandated (75-games push), strong girls', India won 2025 World Cup. |

### Tier-1 — bespoke experience LATER (after the template is proven on Tier-0)

| Sport | Engine | Note |
|---|---|---|
| Tennis | sets ✅ | Already configured — don't over-invest. |
| Table Tennis | sets ✅ | Common indoor school/hostel/college. |
| Hockey | goals ✅ | AIU/KIUG medal sport — Punjab/Odisha/Jharkhand. |
| Langdi | rides kho-kho raid/innings engine | Near-free once kho kho ships. |
| Ball Badminton | sets — ADD | Cheap; strong South-India schools. |
| Tug of War | light bespoke best-of-pulls tally | — |
| Athletics/Track & Field | needs bespoke track-meet engine | Largest single build — sequence last. |

### Kept-but-later — stay REGISTERED on their current generic engine, NO bespoke investment now (per user decision 1)

- **Hockey (goals)** — genuine AIU/KIUG + strong-state institutional footprint; already correctly engined.
- **Tennis (sets, nested 15/30/40 + tiebreak)** — present in better-resourced colleges; already fully configured.
- **Table Tennis (sets)** — common indoor school/hostel/college sport; already correctly engined.

Rationale for keeping these three but deregistering the other five: hockey/tennis/TT have real school/college ICP footprint AND are already correctly engined, so keeping them listed costs nothing and preserves optionality; the deregistered five are thin-ICP AND generic-engine with no real customization to lose.

### DEREGISTER — fully removed from sportRegistry.js, match data dropped, revisit later properly customized (per user decision 1)

| Sport | ICP justification for removal |
|---|---|
| Pickleball | Emerging-urban/elite niche; near-zero school+casual-ground footprint. |
| Squash | Elite-club sport; near-zero India-first footprint. |
| Rugby | Prestige/thin; negligible school+maidan play. |
| Futsal | Redundant with football (already Tier-0); no distinct ICP. |
| Handball | Near-zero school+casual-ground footprint. |

Note: Netball and Beach Volleyball are NOT in the registry (nothing to deregister); they stay on the opportunistic-add backlog.

## B. Per-Game Workflow Template (reusable, instantiated once PER priority game)

Each priority game gets a dedicated workflow running these phases. The workflow is game-bespoke, but every visual/motion output composes the SHARED brutalist×HiFi design system (tokens/primitives/motion kit) — never forks hex/keyframes, always honors the blend-governance contract + back-stack rules.

1. **Authentic-game research** — the game's real scoring flow (official + local/street/school variants), spectator expectations, and the 2-3 signature "what makes THIS game interesting" moments (e.g. cricket last-over chase, kabaddi do-or-die raid, volleyball match-point/deuce rally, kho kho dream run). Cite sources. Output: a one-page game brief.
2. **Engine mapping** — pick the shared engine profile (sets / goals / custom-cricket / raid) or flag genuinely-bespoke; specify the exact state model, quick-buttons, stat surfacing, and edge cases (all-out, tiebreak, super-over, do-or-die).
3. **Bespoke design within the system** — game-specific scoring board layout, live/spectator screen, data touchpoints, micro-animations, and signature-moment treatments — all composed from shared tokens/primitives/motion. Run a generate→critic→refine loop; produce screenshot mockups.
4. **TDD build** — engine/characterization + unit tests first (red-green-refactor), then screens on shared primitives; respect blend-governance + back-stack acceptance gates.
5. **Screenshot-verify in the real app** — run the app; capture board + live + spectator + each signature-moment state; verify against mockups and the design system; iterate to close gaps.
6. **Integrate & register** — registry entry/profile, India-first picker placement, spectator wiring, match-end (Result/Scorecard/Share) wiring; close the game's kernel epic.

## C. Kernel Reshape

### C.1 SHARED infra — KEEP, ships FIRST (game-agnostic; every per-game workflow consumes it)

- **M1:** Epic 1 Foundation (blend tokens + governance + keyframes + shared primitives MonoSheet/CaptionChip/SegmentedToggle/Avatar/Medallion/LiveDot/EmptyState + motion kit), Epic 2 Nav & IA (4-tab), Epic 3 Onboarding/auth/first-run, Epic 4 Dashboard Live-now band, Epic 7 In-match UX & scorer safety, Epic 8 Match-end flow (MonoMatchResult/Scorecard/Share #38-42), Epic 9 Utility/legal/cleanup.
- **M2:** Epic 10 Tournament shell extraction + standings correctness (#47/#50), Epic 11 Attribution & player-stats backends, Epic 13 History/Statistics spine, Epic 12 Settings/appearance, Epic 14 Live/spectator INFRA — specifically the shared parts: #76 broadcast stack, #77 public snapshot query + youth-privacy guard, #80 shared spectator primitives (LiveBadge/ShareLiveSheet/MomentumStrip/SpectatorCaptionChip), #78 share-live QR.

### C.2 SUPERSEDED / closed — generic per-sport residual work folded INTO per-game workflows

- Epic 6 per-sport scorer visual-blend chip issues #24-#30 (shared coaching selectors, cricket LO/test, tennis, sets, goals, basketball quarter/bonus) — for the 8 PRIORITY games these are absorbed into each game's bespoke workflow (the generic chip approach is replaced by deep bespoke boards). Keep only the reusable basketball quarter/bonus engine logic (#30) as an input to the Basketball workflow.
- #31/#32 Generic-live game routing/rebuild — resolved/mooted by deregistering the thin-ICP generic-engine sports; no generic MonoLiveGame rework needed.
- Per-sport SPECTATOR screens #81 (tennis), #83 (sets/goals), #84 (football), #86 (cricket) — folded into each game's per-game workflow. The shared spectator PRIMITIVES (#77/#80) remain shared infra in C.1.
- Standings per-sport column correctness (#50) stays SHARED, but priority-game column specifics are supplied by each game's workflow.

### C.3 NEW items

- **CHORE — Deregister low-ICP games** (M1): remove pickleball, squash, rugby, futsal, handball from sportRegistry.js; drop their match data; declutter the India-first picker.
- **CHORE — Throwball sets registry entry** (M1): zero bespoke engine; cheap win; validates the add-via-registry path; unlocks the girls' segment.
- **EPIC — Raid scoring family (shared turn-based / non-counter engine)** (M1 kickoff): umbrella establishing the shared turn-based scoring family so config/UI/stat surfacing is reused across kabaddi + kho kho + langdi.
  - ISSUE **Kabaddi raid engine** (Tier-0, high) — move kabaddi off goals (registry ~line 348) onto bespoke raid: raid/tackle/do-or-die/empty/super/bonus/all-out+2/revivals/2×20. Correctness fix, anchor of the family.
  - ISSUE **Kho Kho raid/innings engine** (Tier-0, high) — new sport+engine: innings/turns, chase-vs-defend, outs, dream run, per-turn timer, all-out reset.
  - ISSUE **Langdi profile** (Tier-1, med) — config on the kho-kho engine (4×9 innings, hopping-tag); ships in the epic tail.
- **EPIC (×8) — Per-game bespoke experience workflow**, one epic each for: Cricket, Kabaddi, Volleyball, Badminton, Football, Basketball, Throwball, Kho Kho. Each runs the Section-B template.
- **Tier-1 adds (file now, schedule later):** Ball Badminton sets entry, Tug of War best-of-pulls tally, Athletics track-meet engine (flag: largest single build).

### Milestone map

| Item | Milestone |
|---|---|
| All C.1 M1 foundation epics; Deregister chore; Throwball registry entry; Raid-family epic kickoff + Kabaddi raid engine start; PILOT per-game workflow (Volleyball) | M1 |
| Kho Kho raid/innings engine (+ Langdi tail); remaining Tier-0 per-game workflows (Throwball, Badminton, Cricket, Football, Basketball, Kabaddi experience); all C.1 M2 shared infra; Ball Badminton + Tug of War | M2 |
| Tier-1 bespoke workflows (Tennis, Table Tennis, Hockey); Athletics track-meet engine; opportunistic adds (Netball/Beach Volleyball) only if capacity remains | M3 |

## D. Sequence + Pilot

**Pilot = Volleyball.** Reasoning: it isolates the WORKFLOW from engine risk (already on the sets engine with real in-use match data — zero engine risk, like Throwball) while STILL fully exercising the bespoke muscles a cheap throwball pilot wouldn't — it has genuine signature moments (match point, deuce rally, per-set momentum swing) that stress the bespoke board + live/spectator + micro-animation + screenshot-verify phases. It is the app's namesake and best-understood sport, so the team can judge template quality against a known baseline. Throwball then becomes a near-free SECOND that validates the "port the template to a cousin sport" path (reuses volleyball's sets bespoke work) and unlocks the girls' segment. Kabaddi is deliberately NOT first: it is the first bespoke-ENGINE flagship, so it runs only after the design/verify template is proven, isolating engine risk from workflow risk.

Ordered build sequence:

1. **Volleyball** (pilot — proves template, zero engine risk, seeds the sets family)
2. **Throwball** (near-free sets-family port; unlocks girls' segment)
3. **Badminton** (third sets-family validation)
4. **Cricket** (flagship; custom-cricket already deep — bespoke board/spectator + last-over signature)
5. **Football** (goals-family bespoke)
6. **Basketball** (goals-family + quarter/bonus engine)
7. **Kabaddi** (first bespoke-engine flagship — raid engine + do-or-die signature)
8. **Kho Kho** (raid/innings engine)
9. **Tier-1 later:** Langdi → Tennis → Table Tennis → Hockey → Athletics.

## E. Concrete Kernel Actions (file / close / relabel)

**FILE (new):** deregister-low-icp-games chore (M1); throwball-sets-registry-entry chore (M1); Raid-scoring-family epic + 3 issues (kabaddi engine, kho kho engine, langdi profile); 8 per-game bespoke-workflow epics (Cricket, Kabaddi, Volleyball, Badminton, Football, Basketball, Throwball, Kho Kho); ball-badminton entry; tug-of-war tally; athletics track-meet engine.

**CLOSE / SUPERSEDE:** Epic 6 #24-#30 per-sport scorer chips (fold into per-game epics; retain #30 basketball quarter/bonus engine logic as an input); #31/#32 generic-live (mooted by deregister); spectator per-sport screens #81/#83/#84/#86 (fold into per-game epics).

**RELABEL / KEEP-SHARED:** keep Epics 1/2/3/4/7/8/9 + #47/#50/#76/#77/#78/#80 as shared infra shipping first; relabel hockey/tennis/table-tennis registry entries `kept:later` (registered, no bespoke now).

---

_Note: milestone boundaries (M1→M2→M3) remain re-planning checkpoints._

# Kabaddi raid engine

`src/utils/kabaddiEngine.js` is a pure, plain-JS Club standard rectangular engine.
It is deliberately not connected to the sport registry, setup, or current board.
It does not read clocks, write storage, sync events, or enforce competition quotas.
The caller must save the returned state before acknowledging a confirmed award.

## Stored model and selected policy

`version=1`, `schemaVersion=1`, and `rulesVersion='club-rectangular-v1'` identify
this draft format and policy. Configuration is captured at creation and checked
against the first event snapshot after play starts. Only half and interval
durations, opening team, team names and colour inputs are configurable. Unknown
configuration options are rejected, including other competition profiles.

Teams use indexes `0` and `1` throughout; courts swap without changing identity.
Each team's anonymous `A1…A7` / `B1…B7` slots partition into ordered `mat` and FIFO
`outQueue` arrays. These tokens preserve revival order; they are not jerseys,
positions, or player statistics. A queue record contains `slotId`, `outEventId`
and increasing `outSequence`. `unavailable` is reserved and must stay empty:
numbered rosters, cards, injuries and substitutions need a later approved policy.

Score categories are `touch`, `bonus`, `tackleBase`, `superTackleExtra`, `allOut`,
`technical`, and `defenderOut`. `teamTotal()` sums them. The additional
`defenderOut` category keeps referee-declared defender outs distinct from touches,
as the spec requests; it is also separate in result breakdowns.

The fixed club rules are seven starting slots, bonus at six defenders at raid
start, a 30-second advisory raid clock, two own empties followed by do-or-die,
empty streaks carried across halves, and draws allowed. Any raider out at a
raid-start defence of three or fewer earns a super tackle, including self-out
and do-or-die failure. Only the base dismissal revives one player. Every opponent
dismissal revives the oldest ordinary out slot; unused entitlements are discarded.
Eliminating the final active slot derives one all-out +2 and restores that side's
seven slots. Bonus, super-tackle extra, all-out and ordinary technical points
never produce additional revivals.

The design spec also describes a physical-tackle-only alternative. The brief
explicitly selects the broader policy and only one profile, so that alternative
is rejected rather than exposed as an unsupported setting. Management allowances
remain referee-managed; this engine implements no timeout, substitution or card
quotas.

## Public API

All mutations return a new state; they never alter the supplied state. Errors
throw with a `Kabaddi:` prefix. All durations and times use milliseconds.

```js
createKabaddiState({ halfMs = 1200000, intervalMs = 300000,
  openingRaidTeam = 0, names = ['Team A', 'Team B'],
  colours = ['#6d28d9', '#f97316'] } = {}) -> state
assertState(state) -> undefined // throws on unsupported/corrupt gameplay state
teamTotal(team) -> number
nextRaider(state) -> 0 | 1
isDoOrDie(state, team = state.nextRaidTeam) -> boolean
isSuperTackleOn(state) -> boolean

startHalf(state, { atMs = 0 } = {}) -> state
startRaid(state, { id, team = state.nextRaidTeam,
  raiderSlotId = state.mat[team][0], atMs = state.clock.anchorMonotonicMs } = {}) -> state
cancelRaid(state) -> state
applyRaid(state, event) -> state
preview(state, event) -> { outcome, points: [a,b], lost: [a,b],
  revived: [a,b], mat: [a,b], totals: [a,b], allOut,
  nextRaidTeam, superRaid }

remainingTime(state, atMs, which = 'half') -> number | null // 'half' or 'raid'
pause(state, { atMs = state.clock.anchorMonotonicMs } = {}) -> state
resume(state, { atMs = state.clock.anchorMonotonicMs } = {}) -> state
correctClock(state, { halfRemainingMs?, raidRemainingMs?, reason }) -> state
timeUp(state) -> state
finish(state) -> state
reopen(state) -> state
undo(state) -> state
result(state) -> { totals, winner: 0|1|null, draw, margin, final,
  breakdown: [{ raid, tackle, allOut, technical, defenderOut }, ...] }
```

Colours are the actual `deriveTeamColours()` outputs. `startRaid` snapshots the
raider, mat strengths, do-or-die eligibility, and clock start/duration. It does
not change turn or score. Drafts live in `activeRaid`; confirmed records live in
`events`. With no draft, `applyRaid` starts and resolves one atomically, using
`event.atMs` or the current clock anchor. Use explicit `startRaid` for a real
running raid. A supplied `raidId` must match that draft.

```js
let state = startHalf(createKabaddiState(), { atMs: 1000 });
state = startRaid(state, { id: 'local-raid-1', atMs: 2000 });
const ruling = { id: 'local-confirm-1', expectedRevision: state.revision,
  raidId: 'local-raid-1', type: 'touch', count: 2 };
const confirmation = preview(state, ruling);
state = applyRaid(state, ruling); // caller durably saves before acknowledging
```

## Atomic event inputs

Every event has a unique string `id` and one of these `type` values. Pass
`expectedRevision: state.revision` to reject stale confirmations. Identical
retries of an already confirmed ID return the existing state before checking
that old revision; changed payloads or retries of undone IDs throw. An undone
raid's replacement must use a fresh ID. Internal `admin-`, `undo-` and `reopen-`
ID prefixes are reserved. Input key order does not affect retry identity.

| Type | Inputs and meaning |
|---|---|
| `touch` | `count: 1…7`, optional `outsInOrder: [slotId,…]`; optional `bonusAwarded: true` with `bonusBeforeContact: true`. Count cannot exceed raid-start defence. |
| `bonus` | `bonusBeforeContact: true`; no dismissals. |
| `tackled` | Raider out. Optional valid prior bonus uses the same two bonus flags. No successful touch count. |
| `selfOut` | Raider ruled out; required referee `reason`. Optional valid prior bonus. |
| `empty` | Safe return without raid points. Third own empty resolves as `doOrDieFailure`, including the raider out and defensive award. |
| `defenderOut` | `count`, optional `outsInOrder`, required `reason`. Distinct score category; may derive all-out. |
| `mixed` | Required `reason` and ordered `dismissals: [{team,slotId,category}]`. Defender categories are `touch`/`defenderOut`; the sole raider's category is `tackleBase`. A failed raid cannot claim successful touches. Optional valid prior bonus. |
| `technical` | `to`, `reason`, explicit `turnEffect: 'none'|'forfeit'|'replay'`. Optional `offender: {team,slotId}` makes the knockout and one revival explicit. |

Any non-technical raid outcome may also include
`technicalAwards: [{to,reason},…]`. These ordinary awards have no extra outs or
revivals and stay in that raid's single confirmation/undo unit. For technical
knockouts use the explicit `technical` event.

When dismissal order is omitted, count-only mode selects active anonymous tokens
in their existing order. The default raider is the first active anonymous token.
These choices are deterministic, not claims about real player identity. Mixed
outcomes require an explicit order: the engine processes each dismissal, revival
and possible all-out before the next. It does not infer effects from net mat
counts. A super raid is touch+bonus ≥3 and adds no points.

Between raids, technical `none` preserves turn, raid count and streak. `forfeit`
explicitly consumes the turn and resets that raiding team's streak. An active
raid requires `forfeit` or `replay`; replay preserves turn/streak and cancels the
draft for a fresh start. A pending half deadline cannot replay into another raid.

## Clocks, halves and correction

The caller supplies monotonic anchors; ticks do not mutate state. Raid expiry
only reads as zero and never awards a point. `timeUp` is an explicit half-deadline
action. An in-flight raid enters `halfPending`/`fullPending` and must receive a
ruling before `halfTime`/`finishReview`. Half two starts opposite the opening
team and preserves scores, slots, queues and empty streaks. `finish` requires
explicit final review; `result().final` remains false before that.

Clock anchors belong to the caller's session. Before restoring/resuming in a new
session, use the paused saved remaining time and a fresh anchor through `resume`;
do not treat old monotonic anchors as transferable wall time. `persistedWallAnchor`
is reserved/null; wall-time recovery and durable storage are integration work.

Undo uses complete before/after gameplay snapshots plus ordered effects, rather
than inverses or replay of an evolving rules implementation. Snapshots exclude
the journal, keeping storage linear in action count. The immutable journal is
shared across transitions; mutation of returned states by consumers is unsupported.
`undo` appends a record identifying its target, restores score/mat/FIFO/turn/streak/
raid number exactly, and retains client IDs and increasing revision. It freezes
the saved pre-raid clock into paused review. Resume or a logged referee clock
correction is explicit; a running anchor never winds back automatically.

The latest administrative action is independently undoable. Clock actions inside
a completed raid are absorbed into that raid's undo boundary, so stepping back
cannot resurrect an already undone draft. Cancel the next draft before undo.
To cross halftime, undo `startHalf` first; a finished match must first `reopen` to
`finishReview`. Audit records are retained even when their gameplay effect is undone.

## Verification

`bun run test -- src/utils/kabaddiEngine.test.js` executes every worked example
from the supplied design spec, super-tackle thresholds for tackle and ruled-out
raiders, bonus eligibility, ordered all-out/revival, carried do-or-die, compound
awards, half/time-up/clock correction, all simple event undo units, JSON draft and
journal round-trips, identical retries, stale revision rejection, invalid inputs,
and a deterministic sequence of 250 legal raids with partition and undo checks.
These are engine tests; they do not establish durable offline saving, live sync,
rendered board behavior, or production deployment.

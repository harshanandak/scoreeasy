// Pure count-only Club standard rules. No storage, wall-clock reads or UI wiring.
import { deriveTeamColours, PRESETS } from '../lib/teamColour.js';

const VERSION = 1;
const RULES_VERSION = 'club-rectangular-v1';
const CATEGORIES = ['touch', 'bonus', 'tackleBase', 'superTackleExtra', 'allOut', 'technical', 'defenderOut'];
const PHASES = ['ready', 'playing', 'paused', 'halfPending', 'halfTime', 'fullPending', 'finishReview', 'finished'];
const PLAYING = ['playing', 'halfPending', 'fullPending'];
const OUTCOMES = ['touch', 'bonus', 'tackled', 'selfOut', 'empty', 'defenderOut', 'mixed', 'technical'];
const EVENT_KEYS = ['id', 'expectedRevision', 'raidId', 'type', 'count', 'bonusAwarded', 'bonusBeforeContact', 'outsInOrder', 'reason', 'dismissals', 'technicalAwards', 'to', 'offender', 'turnEffect', 'atMs'];
const clone = (value) => JSON.parse(JSON.stringify(value));
const check = (condition, message) => { if (!condition) throw new Error(`Kabaddi: ${message}`); };
const integer = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
const teamId = (value) => value === 0 || value === 1;
const slotsFor = (team) => Array.from({ length: 7 }, (_, i) => `${team === 0 ? 'A' : 'B'}${i + 1}`);

function rulesFor(halfMs, intervalMs) {
  return {
    profile: 'club', initialSlots: 7, halfMs, intervalMs, raidLimitMs: 30000,
    doOrDieLimit: 2, superTackleOutcomes: 'anyRaiderOut', superThresholdMoment: 'raidStart',
    carryEmptyAcrossHalf: true, drawAllowed: true,
    management: 'refereeManaged',
  };
}

/** Create a serialisable match. Teams are always indexes 0/1; slots are anonymous. */
export function createKabaddiState(options = {}) {
  check(options && typeof options === 'object' && Object.keys(options).every((key) => ['halfMs', 'intervalMs', 'openingRaidTeam', 'names', 'colours'].includes(key)), 'unsupported match configuration');
  const { halfMs = 1200000, intervalMs = 300000, openingRaidTeam = 0,
    names = ['Team A', 'Team B'], colours = PRESETS['Purple v Orange'] } = options;
  check(integer(halfMs, 1) && integer(intervalMs), 'halfMs must be positive and intervalMs nonnegative integer milliseconds');
  check(teamId(openingRaidTeam), 'openingRaidTeam must be 0 or 1');
  check(Array.isArray(names) && names.length === 2 && names.every((name) => typeof name === 'string' && name.trim()), 'two team names are required');
  check(Array.isArray(colours) && colours.length === 2, 'two team colours are required');
  const derived = deriveTeamColours(...colours);
  const rules = rulesFor(halfMs, intervalMs);
  return {
    version: VERSION, schemaVersion: VERSION, rulesVersion: RULES_VERSION, rules,
    teams: names.map((name, i) => ({ name, colours: derived[i === 0 ? 'A' : 'B'], score: Object.fromEntries(CATEGORIES.map((key) => [key, 0])) })),
    rosterMode: 'countOnly', mat: [slotsFor(0), slotsFor(1)], outQueue: [[], []], unavailable: [[], []],
    phase: 'ready', resumePhase: null, half: 1, openingRaidTeam, nextRaidTeam: openingRaidTeam,
    courtSide: [0, 1], emptyStreak: [0, 0], raidNumber: 0, nextOutSequence: 0,
    clock: { remainingAtAnchorMs: halfMs, anchorMonotonicMs: 0, running: false, persistedWallAnchor: null },
    activeRaid: null, events: [], revision: 0,
  };
}

/** Sum categories; there is no independent display score to drift. */
export function teamTotal(team) {
  return CATEGORIES.reduce((sum, category) => sum + team.score[category], 0);
}

/** Validate restored drafts before any mutation. Cards/numbered players require a later rules version. */
export function assertState(state) {
  check(state?.version === VERSION && state.schemaVersion === VERSION && state.rulesVersion === RULES_VERSION, 'unsupported state or rules version');
  check(integer(state.rules?.halfMs, 1) && integer(state.rules?.intervalMs), 'invalid half duration');
  check(JSON.stringify(state.rules) === JSON.stringify(rulesFor(state.rules.halfMs, state.rules.intervalMs)), 'unsupported rules profile');
  // Configuration is fixed by the first journal snapshot once play starts.
  if (state.events?.length) check(JSON.stringify(state.rules) === JSON.stringify(state.events[0].before.rules), 'rules profile cannot change midmatch');
  check(state.rosterMode === 'countOnly', 'only countOnly rosters are supported');
  check(PHASES.includes(state.phase) && [1, 2].includes(state.half), 'invalid phase or half');
  check(teamId(state.openingRaidTeam) && teamId(state.nextRaidTeam), 'invalid raiding team');
  check(integer(state.revision) && integer(state.raidNumber) && integer(state.nextOutSequence), 'invalid revision or sequence');
  check(Array.isArray(state.events) && state.revision === state.events.length, 'revision must match journal length');
  for (const field of ['teams', 'mat', 'outQueue', 'unavailable', 'emptyStreak', 'courtSide']) check(Array.isArray(state[field]) && state[field].length === 2, `invalid ${field}`);
  for (const team of [0, 1]) {
    check(CATEGORIES.every((key) => integer(state.teams[team]?.score?.[key])) && integer(teamTotal(state.teams[team])), 'score categories must be nonnegative safe integers');
    check(Object.keys(state.teams[team].score).every((key) => CATEGORIES.includes(key)), 'unknown score category');
    check(Array.isArray(state.mat[team]) && Array.isArray(state.outQueue[team]) && Array.isArray(state.unavailable[team]), 'mat, queue and unavailable must be arrays');
    check(state.unavailable[team].length === 0, 'card/injury restrictions are unsupported in countOnly v1');
    check(state.mat[team].length > 0, 'zero active slots is not a stable playable state');
    const partition = [...state.mat[team], ...state.outQueue[team].map((out) => out.slotId)];
    check(partition.length === 7 && new Set(partition).size === 7 && partition.every((slot) => slotsFor(team).includes(slot)), 'active and FIFO out slots must partition seven anonymous slots without duplicates');
    check(state.outQueue[team].every((out, i, queue) => typeof out.outEventId === 'string' && integer(out.outSequence, 1) && out.outSequence <= state.nextOutSequence && (i === 0 || out.outSequence > queue[i - 1].outSequence)), 'invalid FIFO out queue sequence');
    check(integer(state.emptyStreak[team]) && state.emptyStreak[team] <= 2, 'empty streak must be 0–2');
  }
  check(state.courtSide.includes(0) && state.courtSide.includes(1), 'court sides must partition 0/1');
  check(integer(state.clock?.remainingAtAnchorMs) && state.clock.remainingAtAnchorMs <= state.rules.halfMs && Number.isFinite(state.clock.anchorMonotonicMs) && typeof state.clock.running === 'boolean', 'invalid match clock');
  if (state.activeRaid) {
    const raid = state.activeRaid;
    check(typeof raid.id === 'string' && raid.id.trim() && integer(raid.startedAtRevision) && raid.startedAtRevision <= state.revision, 'invalid active raid identity/revision');
    check(raid.raidingTeam === state.nextRaidTeam && raid.startedInHalf === state.half, 'active raid ownership/half mismatch');
    check(state.mat[raid.raidingTeam].includes(raid.raiderSlotId), 'raider must be active');
    check(Array.isArray(raid.startMat) && raid.startMat.length === 2 && raid.startMat.every((n, i) => n === state.mat[i].length), 'active raid mat changed before resolution');
    check(raid.bonusEligibleAtStart === (raid.startMat[1 - raid.raidingTeam] >= 6) && raid.superEligibleAtStart === (raid.startMat[1 - raid.raidingTeam] <= 3), 'corrupt raid-start eligibility');
    check(raid.doOrDieAtStart === (state.emptyStreak[raid.raidingTeam] === 2), 'corrupt do-or-die snapshot');
    check(raid.startedBeforeHalfEnd === true && raid.raidClock?.durationMs === 30000 && integer(raid.raidClock.remainingAtAnchorMs) && raid.raidClock.remainingAtAnchorMs <= 30000 && Number.isFinite(raid.raidClock.anchorMonotonicMs) && typeof raid.raidClock.running === 'boolean', 'invalid active raid clock');
  }
}

function snapshot(state) {
  const { events, revision, ...game } = state;
  return clone(game);
}

function copyState(state) {
  // Keep the immutable journal by reference; never recursively clone match history.
  return { ...snapshot(state), events: state.events, revision: state.revision };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  check(value === null || typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value), 'event must contain JSON values only');
  return value;
}

function append(state, after, entry, before = snapshot(state)) {
  const next = { ...after, revision: state.revision + 1, events: [...state.events, { ...entry, before, after: snapshot(after) }] };
  assertState(next);
  return next;
}

function admin(state, after, action, details = {}) {
  return append(state, after, { id: `admin-${state.revision + 1}`, type: 'admin', action, ...details });
}

export function nextRaider(state) { return state.nextRaidTeam; }
export function isDoOrDie(state, team = state.nextRaidTeam) {
  check(teamId(team), 'team must be 0 or 1');
  return state.activeRaid?.raidingTeam === team ? state.activeRaid.doOrDieAtStart : state.emptyStreak[team] === 2;
}
export function isSuperTackleOn(state) {
  return state.activeRaid?.superEligibleAtStart ?? state.mat[1 - state.nextRaidTeam].length <= 3;
}

/** atMs is caller-supplied monotonic time. Reading expiry never resolves a raid. */
export function remainingTime(state, atMs, which = 'half') {
  check(Number.isFinite(atMs), 'atMs must be finite');
  check(['half', 'raid'].includes(which), 'unknown clock');
  const clock = which === 'raid' ? state.activeRaid?.raidClock : state.clock;
  if (!clock) return null;
  check(!clock.running || atMs >= clock.anchorMonotonicMs, 'clock cannot run backwards');
  return Math.max(0, clock.remainingAtAnchorMs - (clock.running ? Math.floor(atMs - clock.anchorMonotonicMs) : 0));
}

function frozenClock(state, atMs, which = 'half') {
  const clock = which === 'half' ? state.clock : state.activeRaid.raidClock;
  return { ...clock, remainingAtAnchorMs: remainingTime(state, atMs, which), anchorMonotonicMs: atMs, running: false, persistedWallAnchor: null };
}

/** Start half one or the referee-confirmed second half; no automatic revival. */
export function startHalf(state, { atMs = 0 } = {}) {
  assertState(state);
  check(['ready', 'halfTime'].includes(state.phase) && !state.activeRaid, 'startHalf requires ready or halfTime');
  check(Number.isFinite(atMs), 'atMs must be finite');
  const second = state.phase === 'halfTime';
  check(!second || state.half === 1, 'only two halves are supported');
  const after = copyState(state);
  after.phase = 'playing';
  after.resumePhase = null;
  if (second) {
    after.half = 2;
    after.nextRaidTeam = 1 - state.openingRaidTeam;
    after.courtSide = [...state.courtSide].reverse();
  }
  after.clock = { remainingAtAnchorMs: state.rules.halfMs, anchorMonotonicMs: atMs, running: true, persistedWallAnchor: null };
  return admin(state, after, 'startHalf');
}

/** Start a draft. Anonymous raider selection has no player-performance meaning. */
export function startRaid(state, { id, team = state.nextRaidTeam, raiderSlotId = state.mat[team]?.[0], atMs = state.clock.anchorMonotonicMs } = {}) {
  assertState(state);
  check(state.phase === 'playing' && !state.activeRaid, 'startRaid requires playing with no active raid');
  check(team === state.nextRaidTeam, 'raid team must be the next raiding team');
  check(typeof id === 'string' && id.trim(), 'raid id is required');
  check(state.mat[team].includes(raiderSlotId), 'raider must be active');
  check(remainingTime(state, atMs) > 0, 'half expired; call timeUp before a new raid');
  const after = copyState(state);
  const before = snapshot(state);
  before.clock = frozenClock(state, atMs);
  after.activeRaid = {
    id, raidingTeam: team, raiderSlotId, startedAtRevision: state.revision, startedInHalf: state.half, startedBeforeHalfEnd: true,
    startMat: state.mat.map((slots) => slots.length), bonusEligibleAtStart: state.mat[1 - team].length >= 6,
    superEligibleAtStart: state.mat[1 - team].length <= 3, doOrDieAtStart: state.emptyStreak[team] === 2,
    raidClock: { startedAtMs: atMs, durationMs: 30000, remainingAtAnchorMs: 30000, anchorMonotonicMs: atMs, running: true, persistedWallAnchor: null },
    draft: null, before,
  };
  return after;
}

export function cancelRaid(state) {
  assertState(state);
  check(state.activeRaid && (state.phase === 'playing' || (state.phase === 'paused' && state.resumePhase === 'playing')), 'only an ordinary active draft can be cancelled; pending time-up needs a ruling');
  // Cancelling a picker does not rewind the match clock or discard intervening admin records.
  return { ...copyState(state), activeRaid: null };
}

/** Explicit half deadline: an active raid still requires a referee outcome. */
export function timeUp(state) {
  assertState(state);
  check(state.phase === 'playing', 'timeUp requires playing');
  const after = copyState(state);
  after.clock = { ...after.clock, remainingAtAnchorMs: 0, running: false, persistedWallAnchor: null };
  after.phase = state.activeRaid ? (state.half === 1 ? 'halfPending' : 'fullPending') : (state.half === 1 ? 'halfTime' : 'finishReview');
  return admin(state, after, 'timeUp');
}

export function pause(state, { atMs = state.clock.anchorMonotonicMs } = {}) {
  assertState(state);
  check(PLAYING.includes(state.phase), 'pause requires playing or a pending deadline');
  const after = copyState(state);
  after.resumePhase = state.phase;
  after.phase = 'paused';
  after.clock = frozenClock(state, atMs);
  if (state.activeRaid) after.activeRaid.raidClock = frozenClock(state, atMs, 'raid');
  return admin(state, after, 'pause');
}

export function resume(state, { atMs = state.clock.anchorMonotonicMs } = {}) {
  assertState(state);
  check(state.phase === 'paused' && PHASES.includes(state.resumePhase), 'resume requires paused review');
  check(Number.isFinite(atMs), 'atMs must be finite');
  const after = copyState(state);
  after.phase = state.resumePhase;
  after.resumePhase = null;
  after.clock = { ...after.clock, anchorMonotonicMs: atMs, running: after.phase === 'playing' };
  if (after.activeRaid) after.activeRaid.raidClock = { ...after.activeRaid.raidClock, anchorMonotonicMs: atMs, running: PLAYING.includes(after.phase) };
  return admin(state, after, 'resume');
}

/** Referee clock correction is explicit, paused and journalled. */
export function correctClock(state, { halfRemainingMs, raidRemainingMs, reason } = {}) {
  assertState(state);
  check(state.phase === 'paused', 'clock correction requires paused review');
  requireReason(reason);
  check(halfRemainingMs !== undefined || raidRemainingMs !== undefined, 'clock correction needs a remaining time');
  const after = copyState(state);
  if (halfRemainingMs !== undefined) {
    check(integer(halfRemainingMs) && halfRemainingMs <= state.rules.halfMs, 'half correction exceeds configured duration');
    after.clock.remainingAtAnchorMs = halfRemainingMs;
  }
  if (raidRemainingMs !== undefined) {
    check(state.activeRaid && integer(raidRemainingMs) && raidRemainingMs <= 30000, 'raid correction requires an active raid and 0–30000 ms');
    after.activeRaid.raidClock.remainingAtAnchorMs = raidRemainingMs;
  }
  return admin(state, after, 'correctClock', { reason });
}

function validateInput(event) {
  check(event && typeof event === 'object' && !Array.isArray(event), 'raid event must be an object');
  check(Object.keys(event).every((key) => EVENT_KEYS.includes(key)), 'unsupported event field');
  check(typeof event.id === 'string' && event.id.trim() && !event.id.startsWith('admin-') && !event.id.startsWith('undo-') && !event.id.startsWith('reopen-'), 'unique client event id is required (admin/undo/reopen prefixes reserved)');
  check(OUTCOMES.includes(event.type), 'unsupported raid outcome');
  if (event.expectedRevision !== undefined) check(integer(event.expectedRevision), 'expectedRevision must be nonnegative');
  if (event.bonusAwarded !== undefined) check(typeof event.bonusAwarded === 'boolean', 'bonusAwarded must be boolean');
  if (event.bonusBeforeContact !== undefined) check(typeof event.bonusBeforeContact === 'boolean', 'bonusBeforeContact must be boolean');
  if (event.raidId !== undefined) check(typeof event.raidId === 'string' && event.raidId.trim(), 'raidId must be a string');
  if (event.technicalAwards !== undefined) {
    check(event.type !== 'technical' && Array.isArray(event.technicalAwards), 'technicalAwards must be an array on a raid outcome');
    for (const technical of event.technicalAwards) {
      check(technical && teamId(technical.to) && Object.keys(technical).every((key) => ['to', 'reason'].includes(key)), 'technical award requires a recipient and reason only');
      requireReason(technical.reason);
    }
  }
  canonical(event);
}

function requireReason(reason) { check(typeof reason === 'string' && reason.trim(), 'referee reason is required'); }

function dismissalOrder(state, event, defender) {
  check(integer(event.count, 1) && event.count <= 7, 'touch/out count must be an integer from 1 to 7');
  check(event.count <= state.mat[defender].length, 'count exceeds active defenders');
  const order = event.outsInOrder ?? state.mat[defender].slice(0, event.count);
  check(Array.isArray(order) && order.length === event.count, 'dismissal order must match count');
  check(new Set(order).size === order.length, 'duplicate dismissal');
  check(order.every((slot) => state.mat[defender].includes(slot)), 'dismissed defender must be active');
  return order;
}

function newEffects() { return { awards: [], lost: [[], []], revived: [[], []], allOut: [], ordered: [] }; }

function award(state, effects, team, category, points) {
  state.teams[team].score[category] += points;
  const effect = { kind: 'award', team, category, points };
  effects.awards.push(effect);
  effects.ordered.push(effect);
}

function dismiss(state, effects, eventId, team, slotId, category) {
  check(state.mat[team].includes(slotId), 'dismissed slot must be active');
  const recipient = 1 - team;
  award(state, effects, recipient, category, 1);
  state.mat[team].splice(state.mat[team].indexOf(slotId), 1);
  state.nextOutSequence += 1;
  state.outQueue[team].push({ slotId, outEventId: eventId, outSequence: state.nextOutSequence });
  effects.lost[team].push(slotId);
  effects.ordered.push({ kind: 'out', team, slotId });
  const revived = state.outQueue[recipient].shift();
  if (revived) {
    state.mat[recipient].push(revived.slotId);
    effects.revived[recipient].push(revived.slotId);
    effects.ordered.push({ kind: 'revive', team: recipient, slotId: revived.slotId });
  }
  if (state.mat[team].length === 0) {
    check(!effects.allOut.includes(team), 'second all-out from one raid is invalid');
    award(state, effects, recipient, 'allOut', 2);
    state.mat[team] = state.outQueue[team].map((out) => out.slotId);
    state.outQueue[team] = [];
    effects.allOut.push(team);
    effects.ordered.push({ kind: 'allOut', team, restored: [...state.mat[team]] });
  }
}

function completeRaid(state, raidingTeam) {
  state.nextRaidTeam = 1 - raidingTeam;
  state.raidNumber += 1;
  state.activeRaid = null;
  if (state.phase === 'halfPending') state.phase = 'halfTime';
  if (state.phase === 'fullPending') state.phase = 'finishReview';
}

/**
 * One atomic referee ruling -> new state. With no draft, snapshots an implicit
 * raid at event.atMs (or current clock anchor). Explicit startRaid is preferred.
 * Retrying an identical client id is a no-op, even with its old expectedRevision.
 */
export function applyRaid(state, event) {
  assertState(state);
  validateInput(event);
  const inputKey = JSON.stringify(canonical(event));
  const existing = state.events.find((entry) => entry.id === event.id);
  if (existing) {
    check(existing.inputKey === inputKey, 'client event id reused with different inputs');
    check(!state.events.some((entry) => entry.type === 'undo' && entry.targetId === event.id), 'client event was undone; use a new id for its replacement');
    return state;
  }
  if (event.expectedRevision !== undefined) check(event.expectedRevision === state.revision, 'expected revision is stale');
  check(PLAYING.includes(state.phase), 'scoring requires playing or an already-started pending raid');
  check(state.phase === 'playing' || state.activeRaid, 'deadline requires an existing raid');
  if (event.raidId !== undefined) check(state.activeRaid?.id === event.raidId, 'raidId does not match the active raid');
  const technical = event.type === 'technical';
  const current = technical || state.activeRaid ? copyState(state) : startRaid(state, { id: event.id, atMs: event.atMs ?? state.clock.anchorMonotonicMs });
  const raid = current.activeRaid;
  const raidingTeam = current.nextRaidTeam;
  const defender = 1 - raidingTeam;
  const effects = newEffects();
  let outcome = event.type;
  const bonus = event.type === 'bonus' || event.bonusAwarded === true;
  check(!bonus || ['touch', 'bonus', 'tackled', 'selfOut', 'mixed'].includes(event.type), 'empty/technical/defender-out cannot claim a raid bonus');
  if (bonus) {
    check(raid?.bonusEligibleAtStart, 'bonus requires at least six defenders at raid start');
    check(event.bonusBeforeContact === true, 'bonus must be referee-confirmed before contact');
  }
  if (!['touch', 'defenderOut'].includes(event.type)) check(event.count === undefined && event.outsInOrder === undefined, 'this outcome cannot include touch counts or dismissal order');
  if (event.type !== 'mixed') check(event.dismissals === undefined, 'ordered mixed dismissals require mixed outcome');
  if (!technical) check(event.to === undefined && event.offender === undefined && event.turnEffect === undefined, 'technical award fields require technical outcome');

  if (technical) {
    requireReason(event.reason);
    check(teamId(event.to), 'technical recipient must be 0 or 1');
    check(['none', 'forfeit', 'replay'].includes(event.turnEffect), 'technical turnEffect must be none, forfeit or replay');
    check(!raid || event.turnEffect !== 'none', 'an active raid needs an explicit forfeit or replay ruling');
    check(!['halfPending', 'fullPending'].includes(state.phase) || event.turnEffect === 'forfeit', 'pending deadline must resolve the raid, not replay it');
    check(event.turnEffect !== 'replay' || raid, 'replay requires an active raid');
    if (event.offender) {
      check(event.offender.team === 1 - event.to, 'technical offender must belong to the opponent');
      dismiss(current, effects, event.id, event.offender.team, event.offender.slotId, 'technical');
    } else award(current, effects, event.to, 'technical', 1);
    if (event.turnEffect === 'forfeit') {
      current.emptyStreak[raidingTeam] = 0;
      completeRaid(current, raidingTeam);
    } else if (event.turnEffect === 'replay') current.activeRaid = null;
  } else {
    if (event.type === 'touch' || event.type === 'defenderOut') {
      if (event.type === 'defenderOut') requireReason(event.reason);
      for (const slot of dismissalOrder(current, event, defender)) dismiss(current, effects, event.id, defender, slot, event.type === 'touch' ? 'touch' : 'defenderOut');
    } else if (event.type === 'tackled' || event.type === 'selfOut' || (event.type === 'empty' && raid.doOrDieAtStart)) {
      if (event.type === 'selfOut') requireReason(event.reason);
      if (event.type === 'empty') outcome = 'doOrDieFailure';
      dismiss(current, effects, event.id, raidingTeam, raid.raiderSlotId, 'tackleBase');
      if (raid.superEligibleAtStart) award(current, effects, defender, 'superTackleExtra', 1);
    } else if (event.type === 'mixed') {
      requireReason(event.reason);
      check(Array.isArray(event.dismissals) && event.dismissals.length > 0, 'mixed ruling requires ordered dismissals');
      const seen = new Set();
      const raiderOut = event.dismissals.some((out) => out.team === raidingTeam);
      check(!raiderOut || !event.dismissals.some((out) => out.category === 'touch'), 'failed raid cannot claim successful touch points');
      for (const out of event.dismissals) {
        check(teamId(out.team), 'invalid dismissal team');
        check(!seen.has(out.slotId), 'duplicate dismissal');
        seen.add(out.slotId);
        check(state.mat[out.team].includes(out.slotId), 'mixed dismissal must name a raid-start active slot');
        if (out.team === raidingTeam) check(out.slotId === raid.raiderSlotId && out.category === 'tackleBase', 'only the raider can be dismissed for a failed raid');
        else check(['touch', 'defenderOut'].includes(out.category), 'defender dismissal category must be touch or defenderOut');
        dismiss(current, effects, event.id, out.team, out.slotId, out.category);
        if (out.team === raidingTeam && raid.superEligibleAtStart) award(current, effects, defender, 'superTackleExtra', 1);
      }
    }
    if (bonus) award(current, effects, raidingTeam, 'bonus', 1);
    current.emptyStreak[raidingTeam] = outcome === 'empty' ? current.emptyStreak[raidingTeam] + 1 : 0;
    completeRaid(current, raidingTeam);
  }
  for (const technicalAward of event.technicalAwards ?? []) award(current, effects, technicalAward.to, 'technical', 1);
  const raidPoints = effects.awards.filter((item) => item.team === raidingTeam && ['touch', 'bonus'].includes(item.category)).reduce((sum, item) => sum + item.points, 0);
  return append(state, current, {
    id: event.id, type: technical ? 'technical' : 'raid', input: clone(event), inputKey,
    outcome, raidingTeam, half: state.half, raidNumber: current.raidNumber,
    effects, superRaid: raidPoints >= 3,
    // Clock actions taken inside this raid are part of its complete undo unit.
    absorbedAdminIds: raid ? state.events.slice(raid.startedAtRevision).filter((entry) => entry.type === 'admin').map((entry) => entry.id) : [],
  }, technical && (!raid || event.turnEffect !== 'forfeit') ? snapshot(state) : raid.before);
}

/** Numeric confirmation preview, using exactly the same validation and resolver. */
export function preview(state, event) {
  const after = applyRaid(state, event);
  const entry = after.events.find((item) => item.id === event.id);
  const effects = entry.effects;
  return {
    outcome: entry.outcome,
    points: [0, 1].map((team) => effects.awards.filter((item) => item.team === team).reduce((sum, item) => sum + item.points, 0)),
    lost: effects.lost.map((slots) => slots.length), revived: effects.revived.map((slots) => slots.length),
    mat: entry.after.mat.map((slots) => slots.length), totals: entry.after.teams.map(teamTotal),
    allOut: [...effects.allOut], nextRaidTeam: entry.after.nextRaidTeam, superRaid: entry.superRaid,
  };
}

/**
 * Undo latest action, retaining the journal. Full gameplay snapshots avoid inverse
 * ordering bugs around FIFO/all-out. Snapshots exclude history (linear storage).
 * Clocks resume only after review; revision and client ids never wind backwards.
 */
export function undo(state) {
  assertState(state);
  check(state.phase !== 'finished', 'reopen the finished match before undo');
  check(!state.activeRaid, 'cancel the pending draft before undo');
  const undone = new Set(state.events.filter((entry) => entry.type === 'undo').map((entry) => entry.targetId));
  const absorbed = new Set(state.events.flatMap((entry) => entry.absorbedAdminIds ?? []));
  const target = [...state.events].reverse().find((entry) => !['undo', 'reopen'].includes(entry.type) && !undone.has(entry.id) && !absorbed.has(entry.id));
  check(target, 'no action to undo');
  check(target.before.half === state.half || target.action === 'startHalf', 'undo the startHalf action to reopen the previous half first');
  const after = { ...clone(target.before), events: state.events, revision: state.revision };
  after.resumePhase = after.phase === 'paused' ? after.resumePhase : after.phase;
  after.phase = 'paused';
  after.clock.running = false;
  after.clock.persistedWallAnchor = null;
  if (after.activeRaid) {
    after.activeRaid.raidClock.running = false;
    after.activeRaid.raidClock.persistedWallAnchor = null;
  }
  return append(state, after, { id: `undo-${state.revision + 1}`, type: 'undo', targetId: target.id });
}

/** A reviewable result is derived at any time; final is true only after finish. */
export function result(state) {
  const totals = state.teams.map(teamTotal);
  return {
    totals, winner: totals[0] === totals[1] ? null : (totals[0] > totals[1] ? 0 : 1),
    draw: totals[0] === totals[1], margin: Math.abs(totals[0] - totals[1]), final: state.phase === 'finished',
    breakdown: state.teams.map(({ score }) => ({ raid: score.touch + score.bonus, tackle: score.tackleBase + score.superTackleExtra, allOut: score.allOut, technical: score.technical, defenderOut: score.defenderOut })),
  };
}

export function finish(state) {
  assertState(state);
  check(state.phase === 'finishReview' && !state.activeRaid, 'finish requires finishReview after the final raid ruling');
  return admin(state, { ...copyState(state), phase: 'finished' }, 'finish');
}

export function reopen(state) {
  assertState(state);
  check(state.phase === 'finished', 'reopen requires a finished match');
  return append(state, { ...copyState(state), phase: 'finishReview' }, { id: `reopen-${state.revision + 1}`, type: 'reopen' });
}

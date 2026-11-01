// Kabaddi scorer board <-> raid engine glue (no React). The engine (kabaddiEngine.js) owns every
// rule: who raids, bonus and do-or-die, super tackle, revival, all out, undo. This file turns the
// scorer's few taps into one engine ruling, asks the engine what that ruling would do (it runs
// the real applyRaid on the current state and reads the record back), and words the engine's
// output for the board. It never computes a score, a mat count or an eligibility itself.
import {
  applyRaid, createKabaddiState, isDoOrDie, isSuperTackleOn, pause, remainingTime, resume, startHalf, startRaid,
  teamTotal, timeUp, undo,
} from './kabaddiEngine.js';

/** A new match. `rosters` is the optional team list from setup: up to 7 names or shirt numbers per team. */
export function createBoardMatch({ halfMs, names, colours, openingRaidTeam = 0, rosters = [[], []] }) {
  return { state: createKabaddiState({ halfMs, names, colours, openingRaidTeam }), rosters: rosters.map((list) => (list ?? []).slice(0, 7)) };
}

const slotIndex = (slotId) => Number(slotId.slice(1)) - 1;

/** The player behind an engine slot: the team list entry when there is one, otherwise "Player N". */
export function playerName(match, team, slotId) {
  const entry = match.rosters[team]?.[slotIndex(slotId)];
  if (entry === undefined || entry === null || String(entry).trim() === '') return `Player ${slotIndex(slotId) + 1}`;
  return /^\d+$/.test(String(entry).trim()) ? `#${String(entry).trim()}` : String(entry).trim();
}

export const hasRoster = (match, team) => (match.rosters[team] ?? []).some((entry) => String(entry ?? '').trim());

/** The phase the board shows: an undo leaves the engine paused on top of the restored phase. */
export const boardPhase = (state) => (state.phase === 'paused' ? state.resumePhase : state.phase);

/** Engine state one ruling applies to: leave an undo pause and start the half on the first raid. */
function baseFor(state, atMs) {
  let next = state.phase === 'paused' ? resume(state, { atMs }) : state;
  if (next.phase === 'ready') next = startHalf(next, { atMs });
  return next;
}

/**
 * The engine ruling for what the scorer has picked, or null while it is incomplete.
 * pick = { kind: 'touch'|'empty'|'tackled'|null, bonus, count, outs: [slotId], raider: slotId|null }
 */
export function rulingFor(pick) {
  const bonus = pick.bonus ? { bonusAwarded: true, bonusBeforeContact: true } : {};
  if (pick.kind === 'touch') {
    const count = pick.outs?.length || pick.count;
    if (!count) return null;
    return { type: 'touch', count, ...(pick.outs?.length ? { outsInOrder: pick.outs } : {}), ...bonus };
  }
  if (pick.kind === 'tackled') return { type: 'tackled', ...bonus };
  if (pick.kind === 'empty' || (!pick.kind && pick.bonus)) return pick.bonus ? { type: 'bonus', bonusBeforeContact: true } : { type: 'empty' };
  return null;
}

let seq = 0;
const freshId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(seq += 1)}`;

/** Start the raid (with the named raider when the scorer picked one) and apply the ruling. */
function run(state, ruling, { atMs, raider, ids }) {
  const base = baseFor(state, atMs);
  const raidId = ids?.raid ?? freshId('raid');
  const started = startRaid(base, { id: raidId, atMs, ...(raider ? { raiderSlotId: raider } : {}) });
  const id = ids?.confirm ?? freshId('confirm');
  return applyRaid(started, { ...ruling, id, raidId, expectedRevision: started.revision });
}

/**
 * What the engine says this ruling would do, read from the record the real applyRaid writes.
 * Returns null when the engine rejects it (a key that cannot apply right now).
 */
export function tryRuling(state, ruling, { atMs, raider } = {}) {
  if (!ruling) return null;
  try {
    const after = run(state, ruling, { atMs, raider, ids: { raid: 'preview-raid', confirm: 'preview-confirm' } });
    return after.events.at(-1);
  } catch {
    return null;
  }
}

/** Confirm: the same ruling, with fresh ids, on the saved state. */
export function confirmRuling(match, ruling, { atMs, raider }) {
  return { ...match, state: run(match.state, ruling, { atMs, raider }) };
}

const pts = (entry, team, categories) => entry.effects.awards
  .filter((a) => a.team === team && (!categories || categories.includes(a.category)))
  .reduce((sum, a) => sum + a.points, 0);
const isSuper = (entry) => entry.effects.awards.some((a) => a.category === 'superTackleExtra');

/** True when the engine record has the raider out (tackled, or a lost do-or-die). */
export const raiderLost = (entry) => Boolean(entry && entry.effects.lost[entry.raidingTeam].length);

const nameList = (match, team, slots) => slots.map((slot) => playerName(match, team, slot)).join(', ');

/** The one plain line read back before Confirm, from the engine's own record of the ruling. */
export function readback(match, entry) {
  const names = match.state.teams.map((t) => t.name);
  const raider = entry.raidingTeam;
  const defender = 1 - raider;
  const named = (team) => hasRoster(match, team);
  const parts = [];
  if (entry.outcome === 'touch' || entry.outcome === 'bonus') {
    parts.push(`${names[raider]} +${pts(entry, raider)}`);
    const lost = entry.effects.lost[defender];
    if (entry.effects.allOut.includes(defender)) parts.push(`${names[defender]} all out`);
    else if (lost.length) parts.push(named(defender) ? `${nameList(match, defender, lost)} out` : `${names[defender]} ${lost.length} out`);
    const back = entry.effects.revived[raider];
    if (back.length) parts.push(named(raider) ? `${nameList(match, raider, back)} back` : `${names[raider]} ${back.length} back`);
  } else if (entry.outcome === 'empty') {
    parts.push('Empty raid', 'no points');
  } else {
    const head = isSuper(entry) ? 'Super tackle' : entry.outcome === 'doOrDieFailure' ? 'Do or die lost' : 'Tackled';
    parts.push(head, `${names[defender]} +${pts(entry, defender)}`);
    if (named(raider)) parts.push(`${nameList(match, raider, entry.effects.lost[raider])} out`);
    if (entry.effects.allOut.includes(raider)) parts.push(`${names[raider]} all out`);
    if (pts(entry, raider, ['bonus'])) parts.push(`${names[raider]} +1 bonus`);
  }
  return parts.join(' · ');
}

const WHAT = { empty: 'empty', bonus: 'bonus' };

/** The last confirmed raid on one line: "Raid 39 · Strikers 2 touches · +2". */
export function lastRaidLine(match) {
  const entry = liveRaids(match.state)[0];
  if (!entry) return '';
  const names = match.state.teams.map((t) => t.name);
  const raider = entry.raidingTeam;
  const defender = 1 - raider;
  const head = `Raid ${entry.raidNumber}`;
  if (entry.outcome === 'touch') return `${head} · ${names[raider]} ${entry.input.count} ${entry.input.count === 1 ? 'touch' : 'touches'}${pts(entry, raider, ['bonus']) ? ' + bonus' : ''} · +${pts(entry, raider)}`;
  if (WHAT[entry.outcome]) return `${head} · ${names[raider]} ${WHAT[entry.outcome]} · ${pts(entry, raider) ? `+${pts(entry, raider)}` : 'no points'}`;
  const tackle = `${names[defender]} ${isSuper(entry) ? 'super tackle' : 'tackle'} · +${pts(entry, defender)}`;
  return entry.outcome === 'doOrDieFailure' ? `${head} · ${names[raider]} do or die lost · ${tackle}` : `${head} · ${tackle}`;
}

/** Raid records still in force, newest first. */
export function liveRaids(state) {
  const undone = new Set(state.events.filter((e) => e.type === 'undo').map((e) => e.targetId));
  return state.events.filter((e) => e.type === 'raid' && !undone.has(e.id)).reverse();
}

/** The confirmed raid's big moment, if any (all out wins over super tackle). */
export function momentOf(entry) {
  if (!entry || entry.type !== 'raid') return null;
  if (entry.effects.allOut.length) {
    const team = 1 - entry.effects.allOut[0];
    return { kind: 'allOut', word: 'All out', team, points: pts(entry, team) };
  }
  if (isSuper(entry)) return { kind: 'superTackle', word: 'Super tackle', team: 1 - entry.raidingTeam, points: pts(entry, 1 - entry.raidingTeam) };
  return null;
}

const CLOCK_ACTIONS = new Set(['pause', 'resume', 'correctClock', 'timeUp']);

function nextUndoTarget(state) {
  const undone = new Set(state.events.filter((e) => e.type === 'undo').map((e) => e.targetId));
  const absorbed = new Set(state.events.flatMap((e) => e.absorbedAdminIds ?? []));
  return [...state.events].reverse().find((e) => !['undo', 'reopen'].includes(e.type) && !undone.has(e.id) && !absorbed.has(e.id)) ?? null;
}

/** One Undo tap = one scorer action: the latest raid (with any clock records after it) or a half start. */
export function undoAction(state) {
  let next = state;
  for (let target = nextUndoTarget(next); target; target = nextUndoTarget(next)) {
    next = undo(next);
    if (!(target.type === 'admin' && CLOCK_ACTIONS.has(target.action))) break;
  }
  return next;
}

export const canUndo = (state) => !state.activeRaid && state.phase !== 'finished' && nextUndoTarget(state) !== null;

const totalsOf = (state) => state.teams.map(teamTotal);

/** What Undo restores, read from the state undoAction() would produce: "24–23 · mat 5–3". */
export function undoHint(state) {
  if (!canUndo(state)) return '';
  const after = undoAction(state);
  return `${totalsOf(after).join('–')} · mat ${after.mat.map((m) => m.length).join('–')}`;
}

/** Everything the board shows about the match, straight from the engine. */
export function boardView(match, now) {
  const { state } = match;
  const phase = boardPhase(state);
  const playing = ['ready', 'playing'].includes(phase);
  return {
    phase,
    paused: state.phase === 'paused',
    totals: totalsOf(state),
    half: state.half,
    remainingMs: remainingTime(state, now) ?? state.rules.halfMs,
    raidingTeam: state.nextRaidTeam,
    raidNumber: state.raidNumber + 1,
    doOrDie: playing && isDoOrDie(state),
    superTackleOn: playing && isSuperTackleOn(state),
    mat: [0, 1].map((team) => ({
      on: state.mat[team].length,
      onMat: state.mat[team].map((slot) => ({ slot, name: playerName(match, team, slot) })),
      // Out players in revival order: the first one listed is the next back on the mat.
      out: state.outQueue[team].map((o) => ({ slot: o.slotId, name: playerName(match, team, o.slotId) })),
    })),
  };
}

export function togglePause(match, atMs) {
  const s = match.state;
  return { ...match, state: s.phase === 'paused' ? resume(s, { atMs }) : pause(s, { atMs }) };
}

export function undoMatch(match) {
  return { ...match, state: undoAction(match.state) };
}

export { timeUp, startHalf };

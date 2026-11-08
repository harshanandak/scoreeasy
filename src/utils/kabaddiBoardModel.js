// Kabaddi scorer board <-> raid engine glue (no React). The engine (kabaddiEngine.js) owns every
// rule: who raids, bonus and do-or-die, super tackle, revival, all out, undo. This file turns the
// scorer's few taps into one engine ruling, asks the engine what that ruling would do (it runs
// the real applyRaid on the current state and reads the record back), and words the engine's
// output for the board. It never computes a score, a mat count or an eligibility itself.
import {
  applyRaid, cancelRaid, createKabaddiState, isDoOrDie, isSuperTackleOn, pause, remainingTime, resume, startHalf, startRaid,
  teamTotal, timeUp, undo, editRaidDraft, undoRaidDraft, reopenLastRaid,
} from './kabaddiEngine.js';

/** A new match. `rosters` is the optional team list from setup: up to 7 names or shirt numbers per team. */
export function createBoardMatch({ halfMs, presetId, rules, names, colours, openingRaidTeam = 0, rosters = [[], []] }) {
  return { state: createKabaddiState({ ...(halfMs === undefined ? {} : { halfMs }), ...(presetId ? { presetId } : {}), ...(rules ? { rules } : {}), names, colours, openingRaidTeam }), rosters: rosters.map((list) => (list ?? []).slice(0, rules?.initialPlayers ?? 7)) };
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
  if (base.activeRaid) {
    // Round 4: the scorer already started this raid ("Raid by"); the ruling finishes it.
    return applyRaid(base, { ...ruling, id: ids?.confirm ?? freshId('confirm'), raidId: base.activeRaid.id, expectedRevision: base.revision });
  }
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

const RAIDER_OUT = { doOrDieFailure: 'Do or die lost', selfOut: 'Raider out', mixed: 'Touched, then tackled' };
// Round 5 sends a raid with a defender out of court through the engine's `mixed` outcome; its
// `reason` says how the raid ended, so the words stay true to what the scorer picked.
const mixedHow = (entry) => (entry.input.reason === 'Tackled' ? null : entry.input.reason === 'Raider stepped out' ? 'Raider out' : RAIDER_OUT.mixed);
const successful = (entry) => entry.outcome === 'touch' || entry.outcome === 'bonus' || (entry.outcome === 'mixed' && !raiderLost(entry));

/** The one plain line read back before Confirm, from the engine's own record of the ruling. */
/** `guessed`: the players out were not picked by the scorer (one-tap, not yet named), so say how
 *  many went out rather than echo the engine's placeholder names. */
export function readback(match, entry, { guessed = false, known = null, raiderNamed = true } = {}) {
  const names = match.state.teams.map((t) => t.name);
  if (entry.type === 'technical') return `Technical point · ${names[entry.input.to]} +${pts(entry, entry.input.to)}`;
  const raider = entry.raidingTeam;
  const defender = 1 - raider;
  const named = (team) => hasRoster(match, team);
  // `known.back(team, slots)` (round 4) returns the names only when the scorer named those players
  // when they went out, else null: a returning player the board never named stays a count.
  const backPart = (team, slots) => {
    if (known) {
      const who = known.back(team, slots);
      return who ? `${who.join(', ')} back` : `${names[team]} ${slots.length} back`;
    }
    return named(team) ? `${nameList(match, team, slots)} back` : `${names[team]} ${slots.length} back`;
  };
  const parts = [];
  if (successful(entry)) {
    if (entry.outcome === 'bonus') parts.push('Bonus only');
    parts.push(`${names[raider]} +${pts(entry, raider)}${entry.outcome !== 'bonus' && pts(entry, raider, ['bonus']) ? ' with bonus' : ''}`);
    const lost = entry.effects.lost[defender];
    if (entry.effects.allOut.includes(defender)) parts.push(`${names[defender]} all out`);
    else if (lost.length) parts.push(named(defender) && !guessed ? `${nameList(match, defender, lost)} out` : `${names[defender]} ${lost.length} out`);
    const back = entry.effects.revived[raider];
    if (back.length) parts.push(backPart(raider, back));
  } else if (entry.outcome === 'empty') {
    parts.push('Empty raid', 'no points');
  } else {
    const label = entry.outcome === 'mixed' ? mixedHow(entry) : RAIDER_OUT[entry.outcome];
    const how = entry.outcome === 'doOrDieFailure' ? null : label;
    const head = isSuper(entry) ? (how ? `${how} · super tackle` : 'Super tackle') : label ?? 'Tackled';
    parts.push(head, `${names[defender]} +${pts(entry, defender)}`);
    const outOfCourt = entry.effects.lost[defender];
    if (outOfCourt.length) parts.push(`${names[raider]} +${pts(entry, raider, ['defenderOut'])} · ${names[defender]} ${outOfCourt.length} out of court`);
    if (named(raider) && !guessed && raiderNamed) parts.push(`${nameList(match, raider, entry.effects.lost[raider])} out`);
    if (entry.effects.allOut.includes(raider)) parts.push(`${names[raider]} all out`);
    if (pts(entry, raider, ['bonus'])) parts.push(`${names[raider]} +1 bonus`);
    if (known && entry.effects.revived[defender].length) parts.push(backPart(defender, entry.effects.revived[defender]));
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
  if (entry.outcome === 'mixed' && !raiderLost(entry)) return `${head} · ${names[raider]} ${entry.effects.lost[defender].length} out · +${pts(entry, raider)}`;
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
    remainingMs: remainingTime(state, now),
    timed: state.rules.end.kind === 'timed',
    playerOuts: state.rules.strategy === 'rectangularOuts',
    rules: state.rules,
    progress: state.rules.end.kind === 'target' ? `First to ${state.rules.end.points}` : state.rules.end.kind === 'raids' ? `${state.raidsByTeam.join('?')} of ${state.rules.end.raidsPerTeam} raids each` : null,
    raidingTeam: state.nextRaidTeam,
    raidNumber: state.raidNumber + 1,
    raidActive: Boolean(state.activeRaid),
    raidMs: raidClockMs(state, now),
    raidTotalMs: raidClockTotalMs(state),
    seats: state.rules.initialPlayers,
    doOrDie: playing && isDoOrDie(state),
    superTackleOn: playing && isSuperTackleOn(state),
    mat: [0, 1].map((team) => ({
      on: state.mat[team].length,
      onMat: state.mat[team].map((slot) => ({ slot, name: playerName(match, team, slot) })),
      // All seven seats in shirt order, on the mat or not: the live raid's tokens keep their place.
      players: [...state.mat[team], ...state.outQueue[team].map((o) => o.slotId)].sort((x, y) => slotIndex(x) - slotIndex(y))
        .map((slot) => ({ slot, name: playerName(match, team, slot), on: state.mat[team].includes(slot) })),
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

// ---- one-tap variant (round 3) ----

/** The latest action still in force that scored or could have: a raid or a technical point. */
export function lastAction(state) {
  const undone = new Set(state.events.filter((e) => e.type === 'undo').map((e) => e.targetId));
  return [...state.events].reverse().find((e) => ['raid', 'technical'].includes(e.type) && !undone.has(e.id)) ?? null;
}

/** A technical point between raids: the engine's own ruling, turn and raid count unchanged. */
const technicalRuling = (team) => ({ type: 'technical', to: team, reason: 'Technical point', turnEffect: 'none' });

function runTechnical(state, team, { atMs, id }) {
  const base = baseFor(state, atMs);
  return applyRaid(base, { ...technicalRuling(team), id, expectedRevision: base.revision });
}

export function tryTechnical(state, team, { atMs }) {
  try {
    return runTechnical(state, team, { atMs, id: 'preview-technical' }).events.at(-1);
  } catch {
    return null;
  }
}

export function confirmTechnical(match, team, { atMs }) {
  return { ...match, state: runTechnical(match.state, team, { atMs, id: freshId('technical') }) };
}

/** The raider-out-in-a-struggle ruling ("touched, then tackled"): the engine's mixed outcome. */
export function touchedThenTackled(state, raider) {
  const team = state.nextRaidTeam;
  return { type: 'mixed', reason: 'Touched, then tackled', dismissals: [{ team, slotId: raider ?? state.mat[team][0], category: 'tackleBase' }] };
}

/**
 * Name the players in the raid just scored, without changing a single point: undo that raid and
 * apply the same ruling again at its original tap time (so the half clock reads exactly as before),
 * this time with the defenders out in order (`outs`) or the raider who went out (`raider`).
 * Only the latest action can be named; anything else returns null.
 */
export function renameLast(match, commit, { outs, raider }) {
  const target = nextUndoTarget(match.state);
  if (!target || target.id !== commit.id) return null;
  let ruling = commit.ruling;
  if (outs?.length) ruling = { ...ruling, count: outs.length, outsInOrder: outs };
  if (raider && ruling.type === 'mixed') ruling = { ...ruling, dismissals: ruling.dismissals.map((d) => ({ ...d, slotId: raider })) };
  try {
    const state = run(undoAction(match.state), ruling, { atMs: commit.atMs, raider: raider ?? commit.raider });
    const same = totalsOf(state).every((n, i) => n === totalsOf(match.state)[i]);
    return same ? { ...match, state } : null;
  } catch {
    return null;
  }
}

/** Undo bar label for the one-tap board: what the tap undoes and the score it goes back to. */
export function undoLabel(state) {
  const target = canUndo(state) ? nextUndoTarget(state) : null;
  if (!target) return '';
  const back = totalsOf(undoAction(state)).join('–');
  if (target.type === 'raid') return `Raid ${target.raidNumber} · back to ${back}`;
  if (target.type === 'technical') return `Technical · back to ${back}`;
  return undoHint(state);
}

// ---- round 4: Raid by (a started raid with the 30 s raid clock), flags on the mat icons ----

/** Raid by: start the raid now. The raid clock runs from this tap; the outcome key finishes it. */
export function beginRaid(match, { atMs, raider }) {
  const base = baseFor(match.state, atMs);
  return { ...match, state: startRaid(base, { id: freshId('raid'), atMs, ...(raider ? { raiderSlotId: raider, raiderNamed: true } : {}) }) };
}

/** Engine answers for the step-back control: a started raid can be cancelled, otherwise Undo. */
export function cancelActiveRaid(match) {
  try {
    return { ...match, state: cancelRaid(match.state) };
  } catch {
    return null;
  }
}

export const canCancelRaid = (state) => Boolean(state.activeRaid) && cancelActiveRaid({ state }) !== null;

export function stepBackLabel(state) {
  if (state.activeRaid) return canCancelRaid(state) ? `Cancel raid ${state.raidNumber + 1}` : '';
  return undoLabel(state);
}

/** Raid clock for the ring: ms left of the 30 s, or null when no raid has been started. */
export const raidClockMs = (state, atMs) => (state.activeRaid ? remainingTime(state, atMs, 'raid') : null);
export const raidClockTotalMs = (state) => state.activeRaid?.raidClock?.durationMs ?? state.rules.raidLimitMs;

const noFlag = { out: 0, back: 0, allOut: false, outText: null, backText: null };

/**
 * What the last raid did to each team's mat icons, from the engine's record: how many went out,
 * how many came back, an all out. Names only where the scorer named the players:
 * `outsNamed` (the players out were picked) and `namedOut[team][slot] = outEventId` (a returning
 * player was named when they left). Otherwise the text is a count; the board never guesses a name.
 */
export function raidFlags(match, entry, { outsNamed = false, namedOut = [{}, {}], raiderNamed = true } = {}) {
  if (!entry || entry.type !== 'raid') return [noFlag, noFlag];
  return [0, 1].map((team) => {
    const { lost, revived, allOut } = entry.effects;
    const isAllOut = allOut.includes(team);
    const restored = entry.effects.ordered.find((e) => e.kind === 'allOut' && e.team === team)?.restored ?? [];
    const out = isAllOut ? 0 : lost[team].length;
    const back = isAllOut ? restored.length : revived[team].length;
    const roster = hasRoster(match, team);
    const named = roster && outsNamed && (team !== entry.raidingTeam || raiderNamed);
    const outText = out ? `${named ? nameList(match, team, lost[team]) : out} out` : null;
    const wasNamed = (slot) => entry.before.outQueue[team].find((o) => o.slotId === slot)?.outEventId === namedOut[team]?.[slot];
    const backText = back && !isAllOut ? `${roster && revived[team].every(wasNamed) ? nameList(match, team, revived[team]) : back} back` : null;
    return { out, back, allOut: isAllOut, outText, backText };
  });
}

// ---- round 5: the raid happens live, points land when it ends ----
//
// Live marks and their undo history belong to activeRaid.draft in the engine.

const BONUS = { bonusAwarded: true, bonusBeforeContact: true };

/** The live draft for the active raid, or null (no raid, or a draft left over from another raid). */
export const draftOf = match => match.state.activeRaid?.draft?.raidId === match.state.activeRaid?.id ? match.state.activeRaid?.draft ?? null : null;

const withoutDraft = ({ draft: _draft, ...rest }) => rest;

export function beginLiveRaid(match, { atMs, raider }) {
  return beginRaid(withoutDraft(match), { atMs, raider });
}

export function markDefender(match, slotId, kind) {
  return { ...match, state: editRaidDraft(match.state, { kind: 'mark', slotId, mark: kind }) };
}
export function toggleBonus(match) {
  return { ...match, state: editRaidDraft(match.state, { kind: 'bonus' }) };
}
export function touchCount(match, count) {
  return { ...match, state: editRaidDraft(match.state, { kind: 'count', count }) };
}
export function undoMark(match) {
  return { ...match, state: undoRaidDraft(match.state) };
}
export function lastMark(match) {
  const draft = draftOf(match);
  if (!draft?.history?.length) return null;
  const before = draft.history.at(-1);
  if (before.bonus !== draft.bonus) return { bonus: true };
  return draft.marks.find(m => !before.marks.some(b => b.slot === m.slot && b.kind === m.kind)) ?? before.marks.at(-1) ?? null;
}

/**
 * Which players went out by the scorer's own tap? `namedOutMap(state)[team][slot] = outEventId` for
 * every slot now waiting to come back that left as a defender picked on the board. A raider who
 * went out is the engine's default slot, never a chosen player, so it is not in the map and the
 * board words it as a count.
 */
export function namedOutMap(state) {
  return state.outQueue.map((queue, team) => Object.fromEntries(queue.filter((o) => {
    const ev = state.events.find((e) => e.id === o.outEventId);
    return ev?.type === 'raid' && ev.raidingTeam !== team && (ev.input.outsInOrder || ev.input.dismissals);
  }).map((o) => [o.slotId, o.outEventId])));
}

/**
 * The one engine ruling for a draft and a result, or null when the draft cannot become one.
 *  safe       touched defenders out (+1 each), bonus counts; nothing marked is an empty raid
 *  tackled    raider out; touches do not score (engine rule), defenders out of court still do
 *  raiderOut  the raider stepped out of the court; scored like tackled
 */
export function rulingForDraft(state, draft, result) {
  const raid = state.activeRaid;
  if (!raid || !draft) return null;
  const defender = 1 - raid.raidingTeam;
  const bonus = draft.bonus ? BONUS : {};
  const marks = draft.marks.filter((m) => state.mat[defender].includes(m.slot));
  const stepped = marks.filter((m) => m.kind === 'out');
  const dismissal = (m) => ({ team: defender, slotId: m.slot, category: m.kind === 'touched' ? 'touch' : 'defenderOut' });
  const raiderDismissal = { team: raid.raidingTeam, slotId: raid.raiderSlotId, category: 'tackleBase' };
  if (result === 'safe') {
    if (!marks.length) return draft.bonus ? { type: 'bonus', bonusBeforeContact: true } : { type: 'empty' };
    if (!stepped.length) return { type: 'touch', count: marks.length, outsInOrder: marks.map((m) => m.slot), ...bonus };
    return { type: 'mixed', reason: 'Defender stepped out', dismissals: marks.map(dismissal), ...bonus };
  }
  if (result === 'tackled' || result === 'raiderOut') {
    const reason = result === 'tackled' ? 'Tackled' : 'Raider stepped out';
    if (!stepped.length) return result === 'tackled' ? { type: 'tackled', ...bonus } : { type: 'selfOut', reason, ...bonus };
    return { type: 'mixed', reason, dismissals: [...stepped.map(dismissal), raiderDismissal], ...bonus };
  }
  return null;
}

/** What the engine says the draft would do for a result: a preview, nothing is saved. */
export const previewDraft = (state, draft, result, { atMs }) => tryRuling(state, rulingForDraft(state, draft, result), { atMs });

/** End the raid: apply the one ruling and drop the draft. Null when the engine rejects it. */
export function landRaid(match, result, { atMs }) {
  const ruling = rulingForDraft(match.state, draftOf(match), result);
  if (!ruling) return null;
  try {
    return withoutDraft(confirmRuling(match, ruling, { atMs }));
  } catch {
    return null;
  }
}

/** Cancel a started raid (no score change) and drop its draft. */
export function cancelLiveRaid(match) {
  const cancelled = cancelActiveRaid(match);
  return cancelled && withoutDraft(cancelled);
}

/**
 * Undo the raid that just landed and reopen it live with the same marks, started again at its
 * original tap time, so the scorer can fix a mark and land it again. Null when the latest action
 * is not that raid.
 */
export function reopenRaid(match, { raidId, startedAtMs, atMs = startedAtMs ?? Date.now() } = {}) {
  if (raidId && nextUndoTarget(match.state)?.id !== raidId) return null;
  try {
    return { ...match, state: reopenLastRaid(match.state, { id: freshId('raid'), atMs }) };
  } catch { return null; }
}

export { timeUp, startHalf };

export function callDeadline(match, atMs) {
  const state = match.state.phase === 'paused' ? resume(match.state, { atMs }) : match.state;
  return { ...match, state: timeUp(state) };
}

export function startNextHalf(match, atMs) {
  const state = match.state.phase === 'paused' ? resume(match.state, { atMs }) : match.state;
  return { ...match, state: startHalf(state, { atMs }) };
}

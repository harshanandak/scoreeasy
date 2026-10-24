// Kabaddi quick match <-> raid engine glue (no React). The engine (kabaddiEngine.js) owns every
// rule: raids, revivals, all out, super tackle, do-or-die, bonus gates, undo snapshots. This file
// only stores it in the quick-match draft, migrates the old +1/+2 draft, groups engine undo
// records into the one action the scorer sees, and words engine output for the board.
import {
  applyRaid, assertState, createKabaddiState, pause, preview, resume, startHalf, startRaid, teamTotal, timeUp, undo,
} from './kabaddiEngine.js';

export const KABADDI_MATCH_VERSION = 1;
export const DEFAULT_HALF_MS = 20 * 60 * 1000;

/** Half length from the quick setup format: a timed match is two equal halves. */
export function halfMsFor(format) {
  const seconds = Number(format?.timeLimit);
  return format?.mode === 'timed' && Number.isFinite(seconds) && seconds >= 60
    ? Math.round((seconds * 1000) / 2)
    : DEFAULT_HALF_MS;
}

const teamNames = (names) => names.map((name, i) => (typeof name === 'string' && name.trim() ? name.trim() : `Team ${i ? 'B' : 'A'}`));

/**
 * A new count-only club match. `carried` holds points scored before raid tracking (an old
 * draft); they are added to the engine's totals and shown as their own line in the breakdown.
 */
export function createKabaddiMatch({ format, names, colours, openingRaidTeam = 0, carried = [0, 0] }) {
  const state = createKabaddiState({ halfMs: halfMsFor(format), openingRaidTeam, names: teamNames(names), colours });
  return { version: KABADDI_MATCH_VERSION, state, carried: carried.map((n) => Math.max(0, Math.floor(Number(n) || 0))) };
}

/** Before the first whistle the scorer may pick who raids first; afterwards it is fixed. */
export function withOpeningRaidTeam(match, team, { format, names, colours }) {
  if (match.state.revision !== 0) return match;
  return createKabaddiMatch({ format, names, colours, openingRaidTeam: team, carried: match.carried });
}

/** True when the saved value is a match this build can resume. */
export function isKabaddiMatch(value) {
  if (!value || value.version !== KABADDI_MATCH_VERSION || !Array.isArray(value.carried) || value.carried.length !== 2) return false;
  try {
    assertState(value.state);
    return true;
  } catch {
    return false;
  }
}

/**
 * The match a quick-match draft resumes. Drafts saved by this board carry `kabaddi`. Older
 * kabaddi drafts only had +1/+2 totals (gScore1/gScore2): those totals are kept as points scored
 * before raid tracking and the mat starts at 7–7, because the old board never recorded players.
 * @returns {{ match: object, migrated: boolean }}
 */
export function restoreKabaddiMatch(draft, setup) {
  if (isKabaddiMatch(draft?.kabaddi)) return { match: draft.kabaddi, migrated: false };
  const carried = [draft?.gScore1, draft?.gScore2].map((n) => Math.max(0, Math.floor(Number(n) || 0)));
  return { match: createKabaddiMatch({ ...setup, carried }), migrated: true };
}

/** Engine totals plus any points carried from an old draft. */
export function matchTotals(match) {
  return match.state.teams.map((team, i) => teamTotal(team) + match.carried[i]);
}

/** Caller-side clock: wall-clock milliseconds, never earlier than a saved anchor. */
export function clockNow(state, now = Date.now()) {
  return Math.max(now, state.clock.anchorMonotonicMs, state.activeRaid?.raidClock.anchorMonotonicMs ?? 0);
}

/** The phase the board shows: an undo leaves the engine paused on top of the restored phase. */
export function boardPhase(state) {
  return state.phase === 'paused' ? state.resumePhase : state.phase;
}

/** Leave the paused review an undo or a timeout left, so the next action runs on a live clock. */
export function resumeIfPaused(state, atMs) {
  return state.phase === 'paused' ? resume(state, { atMs }) : state;
}

/** First whistle (or the referee's whistle after an undo) and the raid it starts with. */
export function startNextRaid(state, { id, atMs }) {
  let next = resumeIfPaused(state, atMs);
  if (next.phase === 'ready') next = startHalf(next, { atMs });
  return startRaid(next, { id, atMs });
}

/**
 * The state a raid ruling applies to. A running raid (started on the whistle) is used as it is.
 * With no raid running the ruling is one implicit raid at `atMs` (the engine starts and resolves it
 * atomically, without a raid clock), after leaving any undo pause and starting the half if needed.
 */
function rulingBase(state, atMs) {
  if (state.activeRaid) return state;
  let next = resumeIfPaused(state, atMs);
  if (next.phase === 'ready') next = startHalf(next, { atMs });
  return next;
}

const rulingFor = (base, event, atMs) => ({
  ...event, expectedRevision: base.revision, ...(base.activeRaid ? { raidId: base.activeRaid.id } : { atMs }),
});

/** Apply one raid ruling, on the running raid or as an implicit raid from rest. */
export function applyQuickRaid(state, event, atMs) {
  const base = rulingBase(state, atMs);
  return applyRaid(base, rulingFor(base, event, atMs));
}

/** Engine preview of the same ruling, or null when the engine rejects it (a disabled key). */
export function previewQuickRaid(state, event, atMs) {
  try {
    const base = rulingBase(state, atMs);
    return preview(base, rulingFor(base, event, atMs));
  } catch {
    return null;
  }
}

export function startSecondHalf(state, atMs) {
  return startHalf(resumeIfPaused(state, atMs), { atMs });
}

/** Time up at the end of a half: freeze the clock where it stands, then hand over to the engine. */
export function callTimeUp(state, atMs) {
  return timeUp(resumeIfPaused(state, atMs));
}

export function togglePause(state, atMs) {
  return state.phase === 'paused' ? resume(state, { atMs }) : pause(state, { atMs });
}

const CLOCK_ACTIONS = new Set(['pause', 'resume', 'correctClock', 'timeUp']);

/** The record engine undo() would revert next (same selection as the engine). */
export function nextUndoTarget(state) {
  const undone = new Set(state.events.filter((entry) => entry.type === 'undo').map((entry) => entry.targetId));
  const absorbed = new Set(state.events.flatMap((entry) => entry.absorbedAdminIds ?? []));
  return [...state.events].reverse().find((entry) => !['undo', 'reopen'].includes(entry.type) && !undone.has(entry.id) && !absorbed.has(entry.id)) ?? null;
}

/**
 * One Undo tap = one scorer action: the latest raid (with any clock records after it, such as a
 * pause or the half's time up), or the start of a half. The engine restores the raid's own
 * pre-raid snapshot, so the clock records in between never leave a stale clock behind.
 */
export function undoAction(state) {
  let next = state;
  for (let target = nextUndoTarget(next); target; target = nextUndoTarget(next)) {
    next = undo(next);
    if (!(target.type === 'admin' && CLOCK_ACTIONS.has(target.action))) break;
  }
  return next;
}

export function canUndoAction(state) {
  return !state.activeRaid && state.phase !== 'finished' && nextUndoTarget(state) !== null;
}

/** Raid records still in force, newest first. */
export function raidLog(state) {
  const undone = new Set(state.events.filter((entry) => entry.type === 'undo').map((entry) => entry.targetId));
  return state.events.filter((entry) => entry.type === 'raid' && !undone.has(entry.id)).reverse();
}

const mats = (snapshot) => snapshot.mat.map((slots) => slots.length);
const scoreAt = (snapshot, carried) => snapshot.teams.map((team, i) => teamTotal(team) + carried[i]);
const pointsFor = (effects, team, categories) => effects.awards
  .filter((award) => award.team === team && (!categories || categories.includes(award.category)))
  .reduce((sum, award) => sum + award.points, 0);

const SELF_OUT = { 'Stepped out': 'stepped out', 'Lost cant': 'lost cant', 'Time ran out': 'time ran out' };

/** One sentence for a confirmed raid: who raided, what the referee gave. */
export function raidSummary(entry, names) {
  const raider = entry.raidingTeam;
  const defender = 1 - raider;
  const { input, effects } = entry;
  const bonus = pointsFor(effects, raider, ['bonus']) > 0 ? ' + bonus' : '';
  let what;
  if (entry.outcome === 'touch') what = `${input.count} touch${bonus}`;
  else if (entry.outcome === 'bonus') what = 'Bonus';
  else if (entry.outcome === 'tackled') what = `${pointsFor(effects, defender, ['superTackleExtra']) ? 'Super tackle' : 'Tackled'}${bonus}`;
  else if (entry.outcome === 'selfOut') what = `Raider out, ${SELF_OUT[input.reason] ?? 'ruled out'}${bonus}`;
  else if (entry.outcome === 'doOrDieFailure') what = `Do or die lost${pointsFor(effects, defender, ['superTackleExtra']) ? ' · super tackle' : ''}`;
  else if (entry.outcome === 'empty') what = 'Empty';
  else what = entry.outcome;
  const allOut = effects.allOut.length ? ' · All out' : '';
  return `${names[raider]} · ${what}${allOut}`;
}

/** A raid log row: number, sentence, score after it and the mat before → after. */
export function raidRow(entry, names, carried) {
  const before = mats(entry.before);
  const after = mats(entry.after);
  const changed = [0, 1].filter((team) => before[team] !== after[team] || entry.effects.allOut.includes(team));
  return {
    id: entry.id,
    number: entry.raidNumber,
    half: entry.half,
    text: raidSummary(entry, names),
    score: scoreAt(entry.after, carried),
    mat: changed.length
      ? changed.map((team) => `${names[team]} ${before[team]}→${after[team]}`).join(' · ')
      : `Mat ${after.join('–')}`,
  };
}

/** What the Undo button says it restores, read from the state undoAction() would produce. */
export function undoHint(match) {
  const { state, carried } = match;
  if (!canUndoAction(state)) return '';
  let after;
  try {
    after = undoAction(state);
  } catch {
    return '';
  }
  const lastUndone = after.events.at(-1).targetId;
  const target = state.events.find((entry) => entry.id === lastUndone);
  if (target?.type === 'admin' && target.action === 'startHalf') return state.half === 2 ? 'Back to half time' : 'Back to the start';
  return `Restore ${scoreAt(after, carried).join('–')} · mat ${mats(after).join('–')}`;
}

/**
 * Plain-language preview lines for an engine preview() result.
 * @returns {{ title: string, lines: string[] }}
 */
export function previewWords(result, state, names, carried) {
  const raider = state.nextRaidTeam;
  const defender = 1 - raider;
  const scorers = [raider, defender].filter((team) => result.points[team] > 0);
  let title = scorers.length ? scorers.map((team) => `${names[team]} +${result.points[team]}`).join(' · ') : 'No points';
  if (result.outcome === 'doOrDieFailure') title = `Raider out · ${title}`;
  const lines = [`Score ${result.totals.map((total, i) => total + carried[i]).join('–')}`];
  const mat = [0, 1].map((team) => {
    const parts = [];
    if (result.lost[team]) parts.push(`${result.lost[team]} out`);
    if (result.revived[team]) parts.push(`${result.revived[team]} back in`);
    return parts.length ? `${names[team]} ${parts.join(', ')}` : null;
  }).filter(Boolean);
  lines.push(`Mat ${result.mat[0]}–${result.mat[1]}${mat.length ? ` · ${mat.join(' · ')}` : ''}`);
  for (const team of result.allOut) lines.push(`All out! ${names[1 - team]} +2 · ${names[team]} back to 7`);
  lines.push(`${names[result.nextRaidTeam]} raid next`);
  return { title, lines };
}

/** The confirmed raid's big moment, if any: all out wins over super tackle. */
export function raidMoment(entry) {
  if (!entry || entry.type !== 'raid') return null;
  if (entry.effects.allOut.length) return { kind: 'allOut', team: entry.effects.allOut[0] };
  if (entry.effects.awards.some((award) => award.category === 'superTackleExtra')) return { kind: 'superTackle', team: 1 - entry.raidingTeam };
  return null;
}

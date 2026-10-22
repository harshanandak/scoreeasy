// Kit S2 quick setup (plan 2026-10-22 §9 S2): the format choices one segmented control offers per
// sport, the format object each choice produces, and the one-line rules summary under it. Pure (no
// React). It reads the rules the scorers already play to (sportRegistry config, sportDefaults,
// cricketCalculations, quickMatchSets) and adds none: the summary states what the board will do.
import { CRICKET_FORMATS } from '../../../utils/cricketCalculations';
import { applyStandardDefaults } from '../../../utils/sportDefaults';

const CRICKET_LABELS = { test: 'Test', gully: 'Gully' };

const DEFAULT_TIME_PRESETS = [
  { label: '10 min', value: 600 },
  { label: '20 min', value: 1200 },
  { label: '30 min', value: 1800 },
];
const DEFAULT_POINT_PRESETS = [5, 10, 15, 20];

const GOALS_MODES = [
  { id: 'timed', label: 'Timed' },
  { id: 'points', label: 'First to' },
  { id: 'free', label: 'Free play' },
];

function setFormatsOf(sportConfig) {
  return sportConfig?.config?.setFormats || [];
}

/** "set" for volleyball and tennis, "game" where the registry calls a set a game (badminton, TT). */
function setWord(sportConfig) {
  return /game/i.test(setFormatsOf(sportConfig)[0]?.label || '') ? 'game' : 'set';
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * The main format choices for a sport.
 * @returns {{ kind: 'cricket'|'sets'|'goals'|null, choices: {id: string, label: string}[] }}
 */
export function formatChoices(sportConfig) {
  const engine = sportConfig?.engine;
  if (engine === 'custom-cricket') {
    return { kind: 'cricket', choices: CRICKET_FORMATS.map((f) => ({ id: f.id, label: CRICKET_LABELS[f.id] || f.name })) };
  }
  if (engine === 'sets') {
    return { kind: 'sets', choices: setFormatsOf(sportConfig).map((f) => ({ id: `sets-${f.sets}`, label: f.label })) };
  }
  if (engine === 'goals') return { kind: 'goals', choices: GOALS_MODES };
  return { kind: null, choices: [] };
}

/** Which main choice the current format is (cricket reads its preset id). */
export function selectedFormatChoice(sportConfig, format = {}, cricketPreset = null) {
  const engine = sportConfig?.engine;
  if (engine === 'custom-cricket') return cricketPreset;
  if (engine === 'sets') return format.type === 'best-of' ? `sets-${format.sets || 3}` : 'sets-1';
  if (engine === 'goals') return format.mode || 'free';
  return null;
}

/**
 * The format a sets or goals choice produces. It keeps the sport's standard rules (points, cap,
 * win-by) and any points the scorer already chose, and changes only what the choice names.
 */
export function applyFormatChoice(sportConfig, choiceId, prev = {}) {
  const engine = sportConfig?.engine;
  const defaults = applyStandardDefaults(sportConfig?.id, {});
  if (engine === 'sets') {
    const sets = Number(String(choiceId).replace('sets-', '')) || 1;
    const points = prev.points || defaults.points || sportConfig?.config?.pointsPerSet || 25;
    if (sets === 1) {
      const target = prev.type === 'single' && prev.target ? prev.target : points;
      return { ...defaults, ...prev, type: 'single', sets: 1, points, target };
    }
    const { target: _singleTarget, ...rest } = prev;
    return { ...defaults, ...rest, type: 'best-of', sets, points };
  }
  if (engine === 'goals') {
    const config = sportConfig?.config || {};
    if (choiceId === 'timed') {
      const presets = config.timePresets || DEFAULT_TIME_PRESETS;
      return { ...defaults, mode: 'timed', timeLimit: prev.timeLimit || defaults.timeLimit || presets.at(-1).value };
    }
    if (choiceId === 'points') {
      const presets = config.pointPresets || DEFAULT_POINT_PRESETS;
      return { ...defaults, mode: 'points', target: prev.mode === 'points' && prev.target ? prev.target : presets[0] };
    }
    return { ...defaults, mode: 'free' };
  }
  return prev;
}

/**
 * The second row a goals sport shows under Timed or First to: the clock or the target.
 * @returns {{ label: string, options: {id: string, label: string}[], selected: string } | null}
 */
export function goalsDetail(sportConfig, format = {}) {
  if (sportConfig?.engine !== 'goals') return null;
  const config = sportConfig.config || {};
  if (format.mode === 'timed') {
    const options = (config.timePresets || DEFAULT_TIME_PRESETS).map((p) => ({ id: `time-${p.value}`, label: p.label }));
    return { label: 'Match length', options, selected: `time-${format.timeLimit}` };
  }
  if (format.mode === 'points') {
    const unit = config.scoringUnit || 'point';
    const options = (config.pointPresets || DEFAULT_POINT_PRESETS).map((n) => ({ id: `pts-${n}`, label: plural(n, unit) }));
    return { label: 'Play to', options, selected: `pts-${format.target}` };
  }
  return null;
}

export function applyGoalsDetail(format, detailId) {
  const [kind, raw] = String(detailId).split('-');
  const value = Number(raw);
  if (kind === 'time') return { ...format, mode: 'timed', timeLimit: value };
  if (kind === 'pts') return { ...format, mode: 'points', target: value };
  return format;
}

/** The point presets the sets rules editor offers (the registry's single-set list). */
export function setPointPresets(sportConfig) {
  return setFormatsOf(sportConfig).find((f) => f.sets === 1)?.points || [];
}

function cricketLine(format) {
  let length;
  if (format.trackOvers === false) length = format.maxBalls ? `${format.maxBalls} balls` : 'No ball limit';
  else length = format.overs ? plural(format.overs, 'over') : 'Unlimited overs';
  const innings = (format.totalInnings || 2) === 4 ? '2 innings each' : '1 innings each';
  const parts = [length, `${format.players || 6} players`, innings];
  if (format.solo) parts.push('bat only');
  return parts.join(' · ');
}

function setsLine(sportConfig, format) {
  const config = sportConfig?.config || {};
  if (sportConfig?.id === 'tennis') {
    const games = format.points || config.pointsPerSet || 6;
    const at = format.customization?.tiebreakAt || config.tiebreakAt;
    return [`${games} games a set`, at ? `tiebreak at ${at}–${at}` : null].filter(Boolean).join(' · ');
  }
  const word = setWord(sportConfig);
  if (format.type === 'best-of') {
    // Mirrors getSetWinRule (quickMatchSets.js): points, win-by and cap from the format first.
    const points = format.points || config.pointsPerSet || 25;
    const winBy = format.customization?.winBy || config.winBy || 2;
    const cap = format.customization?.pointCap || config.maxPoints;
    const parts = [`${points} points a ${word}`, `win by ${winBy}`];
    if ((format.sets || 1) > 1 && config.deciderPoints && config.deciderPoints !== points) {
      parts.push(`decider to ${config.deciderPoints}`);
    }
    if (cap) parts.push(`cap ${cap}`);
    return parts.join(' · ');
  }
  // Single set: the scorer validates with format.target, the sport's win-by and its max points.
  const target = format.target || format.points || config.pointsPerSet || 25;
  const parts = [`First to ${target}`, `win by ${config.winBy ?? 2}`];
  if (config.maxPoints) parts.push(`cap ${config.maxPoints}`);
  return parts.join(' · ');
}

function goalsLine(sportConfig, format) {
  const config = sportConfig?.config || {};
  if (format.mode === 'timed') {
    const minutes = Math.round((format.timeLimit || 0) / 60);
    return `${minutes} min on the clock · ${config.drawAllowed === false ? 'no draws' : 'draws allowed'}`;
  }
  if (format.mode === 'points') {
    return `First to ${plural(format.target || 5, config.scoringUnit || 'point')} wins`;
  }
  return 'No limit · finish when you are done';
}

/** The one-line rules summary under the format control: what the board will play to. */
export function setupRulesLine(sportConfig, format = {}) {
  const engine = sportConfig?.engine;
  if (engine === 'custom-cricket') return cricketLine(format);
  if (engine === 'sets') return setsLine(sportConfig, format);
  if (engine === 'goals') return goalsLine(sportConfig, format);
  return '';
}

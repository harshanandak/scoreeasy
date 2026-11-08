import { validateKabaddiRules } from './kabaddiRules';

const phases = ['ready', 'playing', 'paused', 'halfPending', 'halfTime', 'fullPending', 'finishReview', 'finished'];
const playing = ['playing', 'halfPending', 'fullPending'];
const categories = ['touch', 'bonus', 'tackleBase', 'superTackleExtra', 'allOut', 'technical', 'defenderOut'];
const check = ok => { if (!ok) throw new Error('Invalid kabaddi public state'); };
const count = (n, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= 0 && n <= max;
const pair = (values, max) => Array.isArray(values) && values.length === 2 && values.every(n => count(n, max));
const teamIndex = n => n === 0 || n === 1;
const text = s => typeof s === 'string' && s.trim().length > 0;
const slot = (id, team, seats) => typeof id === 'string' && new RegExp(`^${team ? 'B' : 'A'}([1-9]|1[0-2])$`).test(id) && Number(id.slice(1)) <= seats;
const slotPair = (values, seats) => Array.isArray(values) && values.length === 2 && values.every((ids, team) => Array.isArray(ids) && ids.length <= seats && new Set(ids).size === ids.length && ids.every(id => slot(id, team, seats)));

function assertClock(clock, limit) {
  if (limit === null) { check(clock === null); return; }
  check(clock && count(clock.remainingAtAnchorMs, limit) && Number.isFinite(clock.anchorMonotonicMs) && typeof clock.running === 'boolean' && clock.persistedWallAnchor === null);
}

/** Shared by the public write boundary and the spectator's projection boundary. */
export function assertKabaddiRaid(raid, rules) {
  check(raid && text(raid.id) && count(raid.number) && raid.number > 0 && [1, 2].includes(raid.half) && teamIndex(raid.team));
  check(count(raid.seats, 12) && raid.seats >= 2);
  const seats = raid.seats;
  check(['touch', 'bonus', 'tackled', 'selfOut', 'empty', 'defenderOut', 'mixed', 'doOrDieFailure'].includes(raid.outcome));
  for (const field of ['points', 'scoreBefore', 'score']) check(pair(raid[field]));
  for (const field of ['matBefore', 'mat', 'lost', 'revived']) check(pair(raid[field], seats));
  check(slotPair(raid.lostSlots, seats) && slotPair(raid.revivedSlots, seats));
  for (const team of [0, 1]) {
    check(raid.scoreBefore[team] + raid.points[team] === raid.score[team]);
    check(raid.lostSlots[team].length === raid.lost[team] && raid.revivedSlots[team].length === raid.revived[team]);
  }
  check(raid.raiderSlot === null || slot(raid.raiderSlot, raid.team, seats));
  check(raid.allOut === null || teamIndex(raid.allOut));
  check(['bonus', 'superTackle', 'superRaid', 'doOrDie'].every(field => typeof raid[field] === 'boolean'));
  check(count(raid.touches, seats) && count(raid.raidPoints) && raid.raidPoints <= raid.points[raid.team]);
  check(count(raid.defendersAtStart, seats) && raid.defendersAtStart === raid.matBefore[1 - raid.team]);
  check(count(raid.emptyStreakAfter) && count(raid.allOutPoints, 10));
  check(raid.halfLeftMs === null || count(raid.halfLeftMs));
  if (rules) {
    check(seats === rules.initialPlayers && raid.allOutPoints === rules.outs.allOutPoints);
    check(rules.end.kind === 'timed' ? count(raid.halfLeftMs, rules.end.halfMs) : raid.halfLeftMs === null);
  }
}

export function assertKabaddiSnapshot(k, totals) {
  check(k && k.version === 1);
  validateKabaddiRules(k.rules);
  const rules = k.rules;
  const seats = rules.initialPlayers;
  check(Array.isArray(k.scores) && k.scores.length === 2);
  const scores = k.scores.map(score => {
    check(score && Object.keys(score).length === categories.length && categories.every(key => count(score[key])));
    const total = categories.reduce((sum, key) => sum + score[key], 0);
    check(count(total));
    return total;
  });
  if (totals !== undefined) check(pair(totals) && totals.every((total, team) => total === scores[team]));
  check(slotPair(k.mat, seats) && slotPair(k.outQueue, seats));
  for (const team of [0, 1]) {
    const slots = [...k.mat[team], ...k.outQueue[team]];
    check(k.mat[team].length > 0 && slots.length === seats && new Set(slots).size === seats);
    if (rules.strategy === 'pointsOnly') check(k.outQueue[team].length === 0);
  }
  check(pair(k.emptyStreak) && pair(k.raidsByTeam) && count(k.raidNumber) && k.raidsByTeam[0] + k.raidsByTeam[1] === k.raidNumber);
  check(k.emptyStreak.every(n => n <= (rules.doOrDie?.emptyRaids ?? 0)));
  check([1, 2].includes(k.half) && teamIndex(k.nextRaidTeam) && phases.includes(k.phase));
  check(k.phase === 'paused' ? phases.includes(k.resumePhase) && k.resumePhase !== 'paused' : k.resumePhase === null);
  const phase = k.phase === 'paused' ? k.resumePhase : k.phase;
  assertClock(k.clock, rules.end.kind === 'timed' ? rules.end.halfMs : null);
  if (k.clock) check(k.clock.running === (k.phase === 'playing'));
  check(k.halfTimeScore === null || pair(k.halfTimeScore) && k.halfTimeScore.every((n, team) => n <= scores[team]));
  check(['undecided', 'decided', 'abandoned'].includes(k.resultType));
  if (k.lastRaid !== null) {
    assertKabaddiRaid(k.lastRaid, rules);
    check(k.lastRaid.number <= k.raidNumber && k.lastRaid.half <= k.half && k.lastRaid.score.every((n, team) => n <= scores[team]));
  }
  if (k.activeRaid !== null) {
    const raid = k.activeRaid;
    check(raid && text(raid.id) && playing.includes(phase) && raid.raidingTeam === k.nextRaidTeam);
    check(slot(raid.raiderSlotId, raid.raidingTeam, seats) && k.mat[raid.raidingTeam].includes(raid.raiderSlotId) && typeof raid.raiderNamed === 'boolean');
    check(pair(raid.startMat, seats) && raid.startMat.every((n, team) => n === k.mat[team].length));
    const defenders = raid.startMat[1 - raid.raidingTeam];
    check(raid.bonusEligibleAtStart === Boolean(rules.bonus.enabled && defenders >= rules.bonus.minDefenders));
    check(raid.superEligibleAtStart === Boolean(rules.superTackle && defenders <= rules.superTackle.maxDefenders));
    check(raid.doOrDieAtStart === Boolean(rules.doOrDie && k.emptyStreak[raid.raidingTeam] === rules.doOrDie.emptyRaids));
    assertClock(raid.raidClock, rules.raidLimitMs);
    if (raid.raidClock) check(raid.raidClock.running === (k.phase !== 'paused'));
  } else check(!['halfPending', 'fullPending'].includes(phase));
}

export function assertKabaddiUpdate(update, rules) {
  check(update && ['raid', 'raidStart', 'undo', 'state'].includes(update.kind));
  if (update.kind === 'raid') assertKabaddiRaid(update.raid, rules);
  if (update.kind === 'raidStart') check(text(update.raidId));
  if (update.kind === 'undo') check(text(update.targetId));
}

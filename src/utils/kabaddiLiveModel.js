// Kabaddi live VIEWER model (no React). The spectator page never decides a rule: everything here is
// folded from the raid engine's own state and journal (kabaddiEngine.js via kabaddiQuickMatch.js) —
// totals, mat, sitting queue, clocks, do-or-die, super-tackle eligibility, and each confirmed raid's
// effects (awards by category, outs, revivals, all outs). It only words and groups that output for
// someone watching, so the viewer can never disagree with the scorer's board.
import { isDoOrDie, isSuperTackleOn, remainingTime, result, teamTotal } from './kabaddiEngine.js';
import { boardPhase, matchTotals, raidLog } from './kabaddiQuickMatch.js';

const RAID = ['touch', 'bonus'];
const TACKLE = ['tackleBase', 'superTackleExtra'];
const EXTRAS = ['technical', 'defenderOut'];
const sumAwards = (effects, team, categories) => effects.awards
  .filter((award) => award.team === team && categories.includes(award.category))
  .reduce((sum, award) => sum + award.points, 0);
const totalsOf = (snapshot, carried) => snapshot.teams.map((team, i) => teamTotal(team) + carried[i]);
const matOf = (snapshot) => snapshot.mat.map((slots) => slots.length);

/** A half clock as m:ss (ceil, like the board). */
export function clockText(ms) {
  const s = Math.ceil(Math.max(0, ms ?? 0) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * One confirmed raid, as a viewer reads it. Oldest first from raidStory().
 * `halfLeftMs` is the half clock when the raid started (the engine's frozen pre-raid snapshot).
 */
function storyEntry(entry, carried) {
  const team = entry.raidingTeam;
  const defender = 1 - team;
  const { effects } = entry;
  const points = [0, 1].map((t) => effects.awards.filter((a) => a.team === t).reduce((s, a) => s + a.points, 0));
  return {
    id: entry.id,
    number: entry.raidNumber,
    half: entry.half,
    team,
    outcome: entry.outcome,
    touches: entry.input.count && entry.outcome === 'touch' ? entry.input.count : 0,
    bonus: sumAwards(effects, team, ['bonus']) > 0,
    raidPoints: sumAwards(effects, team, RAID),
    points,
    scoreBefore: totalsOf(entry.before, carried),
    score: totalsOf(entry.after, carried),
    matBefore: matOf(entry.before),
    mat: matOf(entry.after),
    lost: effects.lost.map((slots) => slots.length),
    revived: effects.revived.map((slots) => slots.length),
    allOut: effects.allOut.length ? effects.allOut[0] : null,
    superTackle: sumAwards(effects, defender, ['superTackleExtra']) > 0,
    superRaid: entry.superRaid,
    doOrDie: entry.before.emptyStreak[team] === 2,
    defendersAtStart: entry.before.mat[defender].length,
    emptyStreakAfter: entry.after.emptyStreak[team],
    halfLeftMs: entry.before.clock.remainingAtAnchorMs,
  };
}

/** Every raid still in force, oldest first. */
export function raidStory(match) {
  return raidLog(match.state).reverse().map((entry) => storyEntry(entry, match.carried));
}

/** Points by kind for each team, summed from the raid log's awards (the breakdown a viewer wants). */
export function pointsBreakdown(match) {
  const totals = [0, 1].map(() => ({ raid: 0, touch: 0, bonus: 0, tackle: 0, superTackle: 0, allOut: 0, extras: 0 }));
  for (const entry of raidLog(match.state)) {
    for (const award of entry.effects.awards) {
      const t = totals[award.team];
      if (RAID.includes(award.category)) t.raid += award.points;
      if (award.category === 'touch') t.touch += award.points;
      if (award.category === 'bonus') t.bonus += award.points;
      if (TACKLE.includes(award.category)) t.tackle += award.points;
      if (award.category === 'superTackleExtra') t.superTackle += award.points;
      if (award.category === 'allOut') t.allOut += award.points;
      if (EXTRAS.includes(award.category)) t.extras += award.points;
    }
  }
  // Points scored before raid tracking (an old +1/+2 draft) have no kind; they count as extras.
  match.carried.forEach((n, i) => { totals[i].extras += n; });
  return totals;
}

/** Cross-check used by tests: the folded breakdown agrees with the engine's own result(). */
export function engineBreakdown(match) {
  return result(match.state).breakdown;
}

/**
 * The live situation right now. `now` is the viewer's clock on the same monotonic base as the
 * scorer's anchors (the broadcast would carry the anchors; see NOTES).
 */
export function liveNow(match, now) {
  const { state } = match;
  const names = state.teams.map((team) => team.name);
  const phase = boardPhase(state);
  const raid = state.activeRaid;
  const inPlay = ['playing', 'halfPending', 'fullPending'].includes(phase);
  const at = Math.max(now, state.clock.anchorMonotonicMs);
  const raider = raid ? raid.raidingTeam : state.nextRaidTeam;
  const defender = 1 - raider;
  const mat = state.mat.map((slots) => slots.length);
  return {
    names,
    totals: matchTotals(match),
    half: state.half,
    phase: state.phase === 'paused' ? 'paused' : phase,
    inPlay,
    halfLeftMs: remainingTime(state, at, 'half'),
    raid: raid ? {
      team: raid.raidingTeam,
      leftMs: remainingTime(state, Math.max(at, raid.raidClock.anchorMonotonicMs), 'raid'),
      number: state.raidNumber + 1,
      defendersAtStart: raid.startMat[defender],
    } : null,
    raider,
    defender,
    doOrDie: inPlay && isDoOrDie(state, raider),
    superTackleOn: inPlay && isSuperTackleOn(state),
    bonusLive: inPlay && mat[defender] >= 6,
    mat,
    sitting: state.outQueue.map((queue) => queue.length),
    emptyStreak: [...state.emptyStreak],
    nextRaidNumber: state.raidNumber + 1,
  };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The last raid in words, for someone who wasn't watching the mat. */
export function raidWords(entry, names) {
  const team = entry.team;
  const defender = 1 - team;
  const who = names[team];
  const them = names[defender];
  let headline;
  let line;
  if (entry.outcome === 'touch') {
    headline = `${who} +${entry.points[team]}`;
    line = `${who} raider touched ${plural(entry.touches, 'defender')}${entry.bonus ? ', crossed the bonus line' : ''} and made it back.`;
  } else if (entry.outcome === 'bonus') {
    headline = `${who} +1 bonus`;
    line = `${who} raider crossed the bonus line and got back without a touch.`;
  } else if (entry.outcome === 'tackled' || entry.outcome === 'selfOut') {
    headline = entry.superTackle ? `Super tackle · ${them} +${entry.points[defender]}` : `${them} +${entry.points[defender]}`;
    const caught = entry.outcome === 'selfOut' ? 'was ruled out' : `was tackled by ${entry.defendersAtStart} ${them} ${entry.defendersAtStart === 1 ? 'defender' : 'defenders'}`;
    line = `${who} ${entry.doOrDie ? 'do-or-die ' : ''}raider ${caught}.`;
  } else if (entry.outcome === 'doOrDieFailure') {
    headline = `Do or die lost · ${them} +${entry.points[defender]}`;
    line = `${who} raider came back empty on a do-or-die raid and is out.`;
  } else if (entry.outcome === 'empty') {
    headline = 'Empty raid · no points';
    line = `${who} raider came back without a touch.${entry.emptyStreakAfter === 2 ? ` Their next raid is do or die.` : ''}`;
  } else {
    headline = `${entry.points.map((p, i) => (p ? `${names[i]} +${p}` : null)).filter(Boolean).join(' · ') || 'No points'}`;
    line = 'Referee ruling.';
  }
  const extra = [];
  if (entry.allOut !== null) extra.push(`All out! ${names[entry.allOut]} lost their whole side: ${names[1 - entry.allOut]} +2 and ${names[entry.allOut]} back to 7.`);
  for (const t of [0, 1]) {
    if (entry.revived[t] && entry.allOut !== t) extra.push(`${names[t]} bring ${plural(entry.revived[t], 'player')} back.`);
  }
  return { headline, line, extra };
}

/**
 * Key moments, newest first: all outs, super tackles, super raids, do-or-die raids, lead changes,
 * and half time. Each carries the raid it came from, the half clock and the score after.
 */
export function keyMoments(match) {
  const story = raidStory(match);
  const names = match.state.teams.map((team) => team.name);
  const out = [];
  let leader = null;
  for (const e of story) {
    const base = { raid: e.number, half: e.half, clock: clockText(e.halfLeftMs), score: e.score };
    if (e.allOut !== null) out.push({ ...base, kind: 'allOut', team: 1 - e.allOut, text: `All out on ${names[e.allOut]}`, detail: `${names[1 - e.allOut]} +${e.points[1 - e.allOut]} in the raid` });
    if (e.superTackle) out.push({ ...base, kind: 'superTackle', team: 1 - e.team, text: `Super tackle by ${names[1 - e.team]}`, detail: `${plural(e.defendersAtStart, 'defender')} stopped the raider · +2` });
    if (e.superRaid) out.push({ ...base, kind: 'superRaid', team: e.team, text: `Super raid by ${names[e.team]}`, detail: `${e.raidPoints} raid points in one raid` });
    if (e.doOrDie && !e.superTackle) {
      const won = e.raidPoints > 0;
      out.push({ ...base, kind: won ? 'doOrDieWon' : 'doOrDieLost', team: won ? e.team : 1 - e.team, text: `Do or die ${won ? 'won' : 'lost'} · ${names[e.team]}`, detail: won ? `+${e.raidPoints} when it had to score` : `${names[1 - e.team]} +${e.points[1 - e.team]}` });
    }
    const lead = Math.sign(e.score[0] - e.score[1]);
    const now = lead > 0 ? 0 : lead < 0 ? 1 : leader;
    if (lead !== 0 && leader !== null && now !== leader) out.push({ ...base, kind: 'leadChange', team: now, text: `${names[now]} take the lead`, detail: `${e.score[now]}–${e.score[1 - now]}` });
    if (lead !== 0) leader = now;
  }
  const ht = halfTimeScore(match);
  if (ht) {
    const raidsH1 = story.filter((e) => e.half === 1);
    out.push({ raid: (raidsH1.at(-1)?.number ?? 0) + 0.5, half: 1, clock: '0:00', score: ht, kind: 'halfTime', team: null, text: 'Half time', detail: `${names[0]} ${ht[0]}–${ht[1]} ${names[1]}` });
  }
  return out.sort((a, b) => b.raid - a.raid);
}

/** The score when half 1 ended, from the journal's time-up record (null before half time). */
export function halfTimeScore(match) {
  const { state, carried } = match;
  if (state.half === 1 && boardPhase(state) !== 'halfTime') return null;
  const undone = new Set(state.events.filter((entry) => entry.type === 'undo').map((entry) => entry.targetId));
  const end = state.events.find((entry) => entry.type === 'admin' && entry.action === 'timeUp' && entry.before.half === 1 && !undone.has(entry.id));
  return end ? totalsOf(end.after, carried) : null;
}

/** Per-half story: points each side scored in the half, raids, all outs, super tackles, biggest lead. */
export function halfStory(match) {
  const story = raidStory(match);
  const ht = halfTimeScore(match);
  const halves = [];
  for (const half of [1, 2]) {
    const raids = story.filter((e) => e.half === half);
    if (!raids.length) continue;
    const start = half === 1 ? [0, 0].map((n, i) => n + match.carried[i]) : (ht ?? raids[0].scoreBefore);
    const end = raids.at(-1).score;
    let biggest = { margin: 0, team: null };
    for (const e of raids) {
      const m = e.score[0] - e.score[1];
      if (Math.abs(m) > biggest.margin) biggest = { margin: Math.abs(m), team: m > 0 ? 0 : 1 };
    }
    halves.push({
      half,
      points: [0, 1].map((t) => end[t] - start[t]),
      score: end,
      raids: raids.length,
      allOuts: [0, 1].map((t) => raids.filter((e) => e.allOut === 1 - t).length),
      superTackles: [0, 1].map((t) => raids.filter((e) => e.superTackle && e.team === 1 - t).length),
      emptyRaids: [0, 1].map((t) => raids.filter((e) => e.team === t && e.outcome === 'empty').length),
      biggest,
    });
  }
  return halves;
}

import { deriveTeamColours } from '../lib/teamColour';
import { halfTimeScore, raidStory, storyEntry } from './kabaddiLiveModel';

const clockCopy = clock => clock ? { remainingAtAnchorMs: clock.remainingAtAnchorMs, anchorMonotonicMs: clock.anchorMonotonicMs, running: clock.running, persistedWallAnchor: null } : null;

/** Public game data only. Names belong to match metadata; draft marks and journal stay local. */
export function kabaddiSnapshot(match) {
  const s = match.state;
  const raid = s.activeRaid;
  return {
    version: 1, rules: s.rules, scores: s.teams.map(t => t.score), mat: s.mat,
    outQueue: s.outQueue.map(q => q.map(p => p.slotId)), phase: s.phase, resumePhase: s.resumePhase,
    half: s.half, nextRaidTeam: s.nextRaidTeam, raidNumber: s.raidNumber, raidsByTeam: s.raidsByTeam,
    emptyStreak: s.emptyStreak, clock: clockCopy(s.clock),
    activeRaid: raid ? { id: raid.id, raidingTeam: raid.raidingTeam, raiderSlotId: raid.raiderSlotId,
      raiderNamed: raid.raiderNamed === true, startMat: raid.startMat, bonusEligibleAtStart: raid.bonusEligibleAtStart,
      superEligibleAtStart: raid.superEligibleAtStart, doOrDieAtStart: raid.doOrDieAtStart, raidClock: clockCopy(raid.raidClock) } : null,
    halfTimeScore: halfTimeScore(match), lastRaid: raidStory(match).at(-1) ?? null,
    resultType: match.resultType ?? (s.phase === 'finished' ? 'decided' : 'undecided'),
  };
}

/** Engine transitions, including empty raids, get their own idempotent outbox item. */
export function kabaddiUpdates(before, after) {
  const updates = after.state.events.slice(before.state.events.length).filter(e => ['raid', 'technical', 'undo', 'admin', 'reopen'].includes(e.type)).map(e => ({
    type: e.type === 'raid' ? 'kabaddi_raid' : e.type === 'undo' ? 'kabaddi_undo' : 'kabaddi_state',
    data: e.type === 'raid' ? { kind: 'raid', raid: storyEntry(e) } : e.type === 'undo' ? { kind: 'undo', targetId: e.targetId } : { kind: 'state' },
  }));
  if (after.state.activeRaid && before.state.activeRaid?.id !== after.state.activeRaid.id) updates.push({ type: 'raid_start', data: { kind: 'raidStart', raidId: after.state.activeRaid.id } });
  return updates;
}

/** Rebuild a display model from whitelisted state + paginated public raid records. No scoring. */
export function kabaddiWatchMatch(snapshot, meta, events) {
  const k = snapshot.kabaddi;
  const colours = deriveTeamColours(meta?.teamA?.color, meta?.teamB?.color);
  const names = [meta?.teamA?.name ?? 'Team A', meta?.teamB?.name ?? 'Team B'];
  const story = new Map();
  for (const event of [...events].sort((a, b) => a.seq - b.seq)) {
    const update = event.kabaddi;
    if (update?.kind === 'raid') story.set(update.raid.id, update.raid);
    if (update?.kind === 'undo') story.delete(update.targetId);
  }
  if (k.lastRaid) story.set(k.lastRaid.id, k.lastRaid);
  return {
    state: { ...k, teams: k.scores.map((score, i) => ({ score, name: names[i], colours: colours[i ? 'B' : 'A'] })),
      outQueue: k.outQueue.map(q => q.map(slotId => ({ slotId }))), events: [] },
    carried: [0, 0], halfTimeScore: k.halfTimeScore, resultType: k.resultType,
    story: [...story.values()].filter(e => e.number <= k.raidNumber).sort((a, b) => a.number - b.number),
  };
}

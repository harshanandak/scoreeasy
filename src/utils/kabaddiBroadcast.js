import { deriveTeamColours } from '../lib/teamColour';
import { halfTimeScore, raidStory, storyEntry } from './kabaddiLiveModel';
import { assertKabaddiSnapshot, assertKabaddiUpdate } from './kabaddiPublicState';

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
  if (before.state.activeRaid && !after.state.activeRaid && updates.length === 0) updates.push({ type: 'kabaddi_state', data: { kind: 'state' } });
  return updates;
}

/** Rebuild a display model from whitelisted state + paginated public raid records. No scoring. */
export function kabaddiWatchMatch(snapshot, meta, events) {
  try {
    const totals = snapshot && ('pointsA' in snapshot || 'pointsB' in snapshot) ? [snapshot.pointsA, snapshot.pointsB] : undefined;
    assertKabaddiSnapshot(snapshot?.kabaddi, totals);
    for (const event of events) if (event.kabaddi) {
      if (!Number.isSafeInteger(event.seq) || event.seq < 1) return null;
      assertKabaddiUpdate(event.kabaddi, snapshot.kabaddi.rules);
    }
    if ([meta?.teamA?.name, meta?.teamB?.name].some(name => name !== undefined && typeof name !== 'string')) return null;
    const players = meta?.players ?? [];
    if (!Array.isArray(players) || players.some(p => !p || !['A', 'B'].includes(p.team) || typeof p.name !== 'string' || (p.slotId !== undefined && (typeof p.slotId !== 'string' || !new RegExp(`^${p.team}([1-9]|1[0-2])$`).test(p.slotId))))) return null;
    return projectWatchMatch(snapshot, meta, events);
  } catch { return null; }
}

function projectWatchMatch(snapshot, meta, events) {
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

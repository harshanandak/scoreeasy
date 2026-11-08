import { Infer, v } from 'convex/values';
import { validateKabaddiRules } from '../../src/utils/kabaddiRules.js';

const pair = v.array(v.number());
const nullableNumber = v.union(v.null(), v.number());
const clock = v.union(v.null(), v.object({ remainingAtAnchorMs: v.number(), anchorMonotonicMs: v.number(), running: v.boolean(), persistedWallAnchor: v.null() }));
const score = v.object({ touch: v.number(), bonus: v.number(), tackleBase: v.number(), superTackleExtra: v.number(), allOut: v.number(), technical: v.number(), defenderOut: v.number() });
const rules = v.object({
  schemaVersion: v.literal(2), rulesVersion: v.literal('rectangular-v2'), presetId: v.string(), presetRevision: v.literal(1), source: v.string(),
  strategy: v.union(v.literal('rectangularOuts'), v.literal('pointsOnly')), initialPlayers: v.number(), squadLimit: nullableNumber,
  end: v.union(v.object({ kind: v.literal('timed'), halves: v.literal(2), halfMs: v.number(), intervalMs: v.number() }), v.object({ kind: v.literal('target'), points: v.number() }), v.object({ kind: v.literal('raids'), raidsPerTeam: v.number() })),
  raidLimitMs: nullableNumber, expiry: v.literal('refereeRuling'),
  bonus: v.union(v.object({ enabled: v.literal(false) }), v.object({ enabled: v.literal(true), minDefenders: v.number(), eligibility: v.literal('raidStart'), beforeContact: v.literal(true), points: v.literal(1), revives: v.literal(false) })),
  superTackle: v.union(v.null(), v.object({ maxDefenders: v.number(), moment: v.literal('raidStart'), outcomes: v.union(v.literal('physicalTackle'), v.literal('anyRaiderOut')), extraPoints: v.literal(1) })),
  doOrDie: v.union(v.null(), v.object({ emptyRaids: v.number(), onFailure: v.literal('raiderOut'), carryAcrossHalf: v.boolean() })),
  outs: v.object({ mode: v.union(v.literal('fifo'), v.literal('pointsOnly')), revival: v.union(v.literal('onePerOpponentOut'), v.literal('none')), allOutPoints: v.number(), restore: v.union(v.literal('allOrdinary'), v.literal('none')) }),
  lobby: v.union(v.literal('none'), v.literal('refereeManaged')), boundary: v.union(v.literal('none'), v.literal('refereeManaged')), tie: v.union(v.literal('draw'), v.literal('refereeDecision')), technical: v.union(v.literal('off'), v.literal('refereeManaged')), management: v.literal('refereeManaged'),
  court: v.union(v.null(), v.object({ shape: v.literal('rectangle'), lengthM: v.number(), widthM: v.number() })),
});

export const kabaddiRaidValidator = v.object({
  id: v.string(), number: v.number(), half: v.number(), team: v.number(), outcome: v.string(), touches: v.number(), bonus: v.boolean(), raidPoints: v.number(), points: pair,
  scoreBefore: pair, score: pair, matBefore: pair, mat: pair, lost: pair, lostSlots: v.array(v.array(v.string())), revivedSlots: v.array(v.array(v.string())),
  raiderSlot: v.union(v.null(), v.string()), revived: pair, allOut: nullableNumber, superTackle: v.boolean(), superRaid: v.boolean(), doOrDie: v.boolean(),
  defendersAtStart: v.number(), emptyStreakAfter: v.number(), halfLeftMs: nullableNumber, allOutPoints: v.number(), seats: v.number(),
});

export const kabaddiSnapshotValidator = v.object({
  version: v.literal(1), rules, scores: v.array(score), mat: v.array(v.array(v.string())), outQueue: v.array(v.array(v.string())),
  phase: v.string(), resumePhase: v.union(v.null(), v.string()), half: v.number(), nextRaidTeam: v.number(), raidNumber: v.number(), raidsByTeam: pair, emptyStreak: pair, clock,
  activeRaid: v.union(v.null(), v.object({ id: v.string(), raidingTeam: v.number(), raiderSlotId: v.string(), raiderNamed: v.boolean(), startMat: pair, bonusEligibleAtStart: v.boolean(), superEligibleAtStart: v.boolean(), doOrDieAtStart: v.boolean(), raidClock: clock })),
  halfTimeScore: v.union(v.null(), pair), lastRaid: v.union(v.null(), kabaddiRaidValidator), resultType: v.union(v.literal('undecided'), v.literal('decided'), v.literal('abandoned')),
});

export const kabaddiUpdateValidator = v.union(
  v.object({ kind: v.literal('raidStart'), raidId: v.string() }),
  v.object({ kind: v.literal('raid'), raid: kabaddiRaidValidator }),
  v.object({ kind: v.literal('undo'), targetId: v.string() }),
  v.object({ kind: v.literal('state') }),
);

export function validateKabaddiSnapshot(k: Infer<typeof kabaddiSnapshotValidator>, points: number[]) {
  validateKabaddiRules(k.rules);
  const check = (ok: boolean) => { if (!ok) throw new Error('Invalid kabaddi public state'); };
  const pairOfCounts = (values: number[]) => values.length === 2 && values.every(n => Number.isSafeInteger(n) && n >= 0);
  check(k.scores.length === 2 && k.mat.length === 2 && k.outQueue.length === 2 && pairOfCounts(k.emptyStreak) && pairOfCounts(k.raidsByTeam));
  check(k.raidsByTeam[0] + k.raidsByTeam[1] === k.raidNumber && [1, 2].includes(k.half) && [0, 1].includes(k.nextRaidTeam));
  check(['ready', 'playing', 'paused', 'halfPending', 'halfTime', 'fullPending', 'finishReview', 'finished'].includes(k.phase));
  for (const team of [0, 1]) {
    const values = Object.values(k.scores[team]);
    check(values.every(n => Number.isSafeInteger(n) && n >= 0) && values.reduce((a, b) => a + b, 0) === points[team]);
    const slots = [...k.mat[team], ...k.outQueue[team]];
    check(slots.length === k.rules.initialPlayers && new Set(slots).size === slots.length && slots.every(s => new RegExp(`^${team ? 'B' : 'A'}([1-9]|1[0-2])$`).test(s) && Number(s.slice(1)) <= k.rules.initialPlayers));
  }
}

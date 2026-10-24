import { scenes } from './fixture.js';
import { teamTotal, remainingTime, isDoOrDie, isSuperTackleOn } from '../src/utils/kabaddiEngine.js';
const REST = 10_000_000;
for (const [name, f] of Object.entries(scenes)) {
  const { match: { state: s }, now } = f(REST);
  console.log(name, s.phase, 'half', s.half, s.teams.map(teamTotal).join('-'), 'mat', s.mat.map((m) => m.length).join('-'), 'next', s.nextRaidTeam, 'streak', s.emptyStreak.join(''),
    'left', remainingTime(s, now) / 1000, s.activeRaid ? `raid ${remainingTime(s, now, 'raid') / 1000}s` : '', 'dod', isDoOrDie(s), 'super', isSuperTackleOn(s), 'raids', s.raidNumber,
    'allouts', s.events.filter((e) => e.type === 'raid' && e.effects.allOut.length).map((e) => e.raidNumber).join(','));
}

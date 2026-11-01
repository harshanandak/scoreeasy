// Exploration harness (k2 viewer). ?view=k2|ref &v=r4|r3 (r4 default) &s=allout|rest|raid|moment|half|end
//   &court=idle|raid|result (pin the round 4 court to a moment; omit to follow the raids)
//   &tab=live|raids|stats &names=1|0 &theme=light|dark &out=1 (off-the-court moment)
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import KabaddiWatch from '../src/designs/design1-mono/live/KabaddiWatch';
import KabaddiWatchR3 from '../src/designs/design1-mono/live/KabaddiWatchR3';
import MonoWatchMatch from '../src/designs/design1-mono/MonoWatchMatch';
import { liveNow, raidStory } from '../src/utils/kabaddiLiveModel';
import { buildFixture, ROSTER } from './fixture.js';
import '../src/index.css';
import '../src/designs/design1-mono/mono.css';

const root = createRoot(document.getElementById('root'));
let match;
let now;

// What master's broadcast carries for kabaddi today: totals, "40 min match", one point event per
// scoring raid (bigger gainer only), nothing for empty raids.
function legacyLive() {
  const live = liveNow(match, now);
  const story = raidStory(match);
  const t0 = Date.now() - story.length * 31_000;
  const events = story.filter((e) => e.points[0] + e.points[1] > 0).map((e, i) => {
    const team = e.points[0] >= e.points[1] ? 0 : 1;
    return { seq: i + 1, type: 'point', team: team === 0 ? 'A' : 'B', value: e.points[team], runningA: e.score[0], runningB: e.score[1], at: t0 + e.number * 31_000 };
  }).reverse();
  const final = ['finished', 'finishReview'].includes(live.phase);
  return {
    'live:getByToken': { sport: 'kabaddi', scorecardKind: 'goals', pointsA: live.totals[0], pointsB: live.totals[1], setsA: 0, setsB: 0, setScores: [], currentUnit: 1, periodLabel: '40 min match', status: final ? 'final' : 'live', lastEventAt: Date.now() },
    'live:getMeta': { teamA: { name: live.names[0] }, teamB: { name: live.names[1] } },
    events,
  };
}

// window.__show('s=raid&theme=dark') re-renders without a reload (used by the contrast sweep).
function show(search) {
const params = new URLSearchParams(search);
const stage = params.get('s') || 'rest';
document.documentElement.classList.toggle('dark', params.get('theme') === 'dark');
({ match, now } = buildFixture(stage));
let app;
if (params.get('view') === 'ref') {
  window.__live = legacyLive();
  app = (
    <MemoryRouter initialEntries={['/live/demo']}>
      <Routes><Route path="/live/:token" element={<MonoWatchMatch />} /></Routes>
    </MemoryRouter>
  );
} else {
  const Page = params.get('v') === 'r3' ? KabaddiWatchR3 : KabaddiWatch;
  app = (
    <Page
      match={match}
      now={now}
      roster={params.get('names') === '0' ? null : ROSTER}
      initialTab={params.get('tab') || 'live'}
      showOut={params.get('out') === '1'}
      courtStage={params.get('court') || undefined}
    />
  );
}
root.render(<div key={search}>{app}</div>);
}
window.__show = show;
show(location.search);

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import KabaddiLive from '../src/designs/design1-mono/scoring/KabaddiLiveBoard';
import KabaddiWatch from '../src/designs/design1-mono/live/KabaddiWatch';
import KabaddiSetup from '../src/designs/design1-mono/kit/KabaddiSetup';
import { useTeamColours } from '../src/designs/design1-mono/scoring/useTeamColours';
import { createKabaddiMatch } from '../src/utils/kabaddiQuickMatch';
import { resolveKabaddiRules } from '../src/utils/kabaddiRules';
import { beginLiveRaid, landRaid, markDefender, toggleBonus } from '../src/utils/kabaddiBoardModel';
import { buildEnd, buildOpen, buildRest } from './fixture';
import '../src/index.css';
import '../src/designs/design1-mono/mono.css';

const NOW = 1800000000000;
const params = new URLSearchParams(location.search);
const scene = params.get('scene') || 'scorer-between';
document.documentElement.classList.toggle('dark', params.get('theme') === 'dark');
const initial = () => {
  if (scene === 'scorer-quick') return createKabaddiMatch({ format: { kabaddiRules: resolveKabaddiRules('quick') }, names: ['Royals', 'Strikers'], colours: [undefined, undefined] });
  if (scene === 'viewer-fulltime') return buildEnd(NOW);
  if (scene === 'scorer-super' || scene === 'scorer-allout' || scene === 'viewer-raids' || scene === 'viewer-stats') {
    let match = beginLiveRaid(buildRest(NOW), { atMs: NOW });
    if (scene === 'scorer-allout') {
      for (const slot of match.state.mat[1 - match.state.nextRaidTeam]) match = markDefender(match, slot, 'touched');
      return landRaid(match, 'safe', { atMs: NOW });
    }
    return landRaid(match, 'tackled', { atMs: NOW });
  }
  let match = buildOpen(NOW, { named: scene.startsWith('viewer') });
  if (scene === 'scorer-between') return match;
  match = beginLiveRaid(match, { atMs: NOW, raider: scene.startsWith('viewer') ? match.state.mat[match.state.nextRaidTeam][0] : undefined });
  if (scene === 'viewer-live') return match;
  match = markDefender(match, match.state.mat[1 - match.state.nextRaidTeam][0], 'touched');
  if (scene === 'scorer-live' || scene === 'scorer-result') return toggleBonus(match);
  return landRaid(match, 'safe', { atMs: NOW });
};

function Preview() {
  const style = useTeamColours('#dc2626', '#2563eb', 'kabaddi');
  const [format, setFormat] = useState({ kabaddiRules: resolveKabaddiRules(scene === 'setup-standard' ? 'standard' : 'quick') });
  const [notice, setNotice] = useState('');
  if (scene.startsWith('setup')) return <main className="kit-screen" style={{ maxWidth: 560, margin: 'auto', padding: '24px 20px' }}>
    <h1>Kabaddi</h1><p>Royals v Strikers</p><KabaddiSetup format={format} onChange={setFormat} />
  </main>;
  const key = `kabaddi-acceptance:${scene}`;
  const match = JSON.parse(localStorage.getItem(key) || 'null') || initial();
  if (scene.startsWith('viewer')) return <KabaddiWatch match={match} now={NOW} roster={match.rosters}
    initialTab={scene === 'viewer-raids' ? 'raids' : scene === 'viewer-stats' ? 'stats' : 'live'}
    courtStage={scene === 'viewer-backsafe' ? 'result' : scene === 'viewer-live' ? 'raid' : undefined} />;
  return <KabaddiLive initialMatch={match} colourStyle={style} title="Royals v Strikers" subtitle="Kabaddi"
    now={() => NOW} onSave={next => { localStorage.setItem(key, JSON.stringify(next)); return true; }}
    onFinish={() => setNotice('Finish requested')} onDiscard={() => setNotice('Discard requested')} notice={notice ? <p>{notice}</p> : null} />;
}

createRoot(document.getElementById('root')).render(<Preview />);

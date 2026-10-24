// Exploration harness (viewer `v`): the real KabaddiLiveView over engine-built fixture stages.
// ?v=broadcast|story &s=allout|rest|raid|moment|half|end &theme=light|dark
import { createRoot } from 'react-dom/client';
import KabaddiLiveView from '../src/designs/design1-mono/live/KabaddiLiveView';
import { buildFixture } from './fixture.js';
import '../src/index.css';
import '../src/designs/design1-mono/mono.css';

const params = new URLSearchParams(window.__params ?? location.search);
const stage = params.get('s') || 'rest';
document.documentElement.classList.toggle('dark', params.get('theme') === 'dark');
const { match, now } = buildFixture(stage);
function App() {
  return (
    <div className="min-h-screen font-swiss" style={{ background: 'var(--se-color-canvas)', color: 'var(--se-color-ink-strong)' }}>
      <main id="main-content">
        <KabaddiLiveView match={match} now={now} variant={params.get('v') || 'broadcast'} showMoment={stage === 'moment' || stage === 'allout'} />
      </main>
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);

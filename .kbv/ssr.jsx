import { renderToString } from 'react-dom/server';
import KabaddiLiveView from '../src/designs/design1-mono/live/KabaddiLiveView';
import { buildFixture } from './fixture.js';
const [v, s] = process.argv.slice(2);
const t = Date.now();
const { match, now } = buildFixture(s);
const t1 = Date.now();
const html = renderToString(<KabaddiLiveView match={match} now={now} variant={v} showMoment />);
console.log('fixture ms', t1 - t, 'render ms', Date.now() - t1, html.length);

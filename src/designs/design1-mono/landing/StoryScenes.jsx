import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { storyFrame } from './storyTimelines';

function Check() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
}
function Rolling({ value, pop = false }) {
  return <span key={value} className={pop ? 'pop' : 'roll'}>{value}</span>;
}
Rolling.propTypes = { value: PropTypes.string.isRequired, pop: PropTypes.bool };
const CHIP = { online: ['', 'Online'], nosignal: ['warn', 'No signal'], saved: ['warn', 'Saved here'], live: ['', 'Live'], synced: ['ok', 'Arrived'] };
function Chip({ kind }) {
  const [style, label] = CHIP[kind];
  return <span className={`chip ${style}`}><span className={`dot${kind === 'live' ? ' pulse' : ''}`} />{label}</span>;
}
Chip.propTypes = { kind: PropTypes.string.isRequired };
const DESCRIPTIONS = [
  'Tap who won the point. Deuce, advantage and game are called for you.',
  'A wrong tap is fixed with one Undo.',
  'Friends follow live. With no signal, goals are saved and arrive later.',
  'Nine sports. Set point, all out and win by 2 are called for you.',
];
const MOMENTS = [['Volleyball', 'Set point · 24–22'], ['Kabaddi', 'All out · +2'], ['Badminton', '20 all · win by 2']];

export default function StoryScenes({ index, state, reduced }) {
  const frames = useRef({});
  useEffect(() => { frames.current[index] = state; }, [index, state]);
  return DESCRIPTIONS.map((description, i) => {
    const s = i === index ? state : frames.current[i] ?? storyFrame(i, 0);
    return (
      <article key={description} className={`scene ${i === index ? 'on' : 'off'}`} aria-hidden={i !== index}
        aria-roledescription="slide" aria-label={`${i + 1} of 4: ${description}`}>
        <div className="k-row">
          <div className="kicker" style={i === 0 ? { color: '#c6e83a' } : undefined}><i />{
            i === 0 ? <>Tennis · Game <span>{s.gameNo}</span></> : ['', 'Cricket · Over 19', 'Football · Live', '9 sports'][i]
          }</div>
          <span className="perk" style={{ '--pc': ['#16205a', '#1840c4', '#06502a', '#3f1c9c'][i] }}><Check />{['No sign-up', 'Free', 'Works offline', 'Rules built in'][i]}</span>
        </div>
        <div className="body">
          {i === 0 && <>
            <p className="call" style={{ color: '#c6e83a' }}><Rolling value={s.call} pop /></p>
            <div className="t-rows">{[['a', 'Asha', s.ga, s.pa], ['b', 'Meera', s.gb, s.pb]].map(([id, name, games, points]) => (
              <div className="t-row" key={id} data-player={name}>
                {s.tap === id && !reduced && <span key={s.step} className="tap go" />}
                <div className="who"><span className="nm">{name}<span className="srv" hidden={s.srv !== id} aria-label={`${name} serving`} role="img" /></span><span className="gm">Games <Rolling value={games} /></span></div>
                <span className="pt" aria-label={`${name} points`}><Rolling value={points} /></span>
              </div>
            ))}</div>
          </>}
          {i === 1 && <>
            <div className="c-top">
              <div><div className="c-runs" aria-label="Runs this over"><Rolling value={s.runs} /></div><div className="c-lbl">Runs this over</div></div>
              <span className={`undo${s.press ? ' press' : ''}`}>
                {s.gone && !reduced && <span className="tap go" style={{ background: 'rgba(24,64,196,.35)' }} />}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 010 11H11" /></svg>Undo
              </span>
            </div>
            <div className="balls" aria-label="Over deliveries">{Array.from({ length: s.slots }, (_, n) => {
              const value = s.balls[n];
              return <span key={n} className={`ball${value ? ' f' : ''}${value === '6' ? ' six' : ''}${value === 'W' ? ' w' : ''}`} aria-label={`Ball ${n + 1}: ${value ?? 'not bowled'}`}>{value}</span>;
            })}{s.gone && !reduced && <span className="removed-six" aria-hidden="true">6</span>}</div>
          </>}
          {i === 2 && <div className="l-pair">{[['You score', s.you, s.youChip], ['Riya watches', s.riya, s.riyaChip]].map(([who, score, chip]) => (
            <div className="ph" key={who}><span className="who">{who}</span><span className="sc"><Rolling value={score} /></span><span className="tm">City</span><Chip kind={chip} /></div>
          ))}</div>}
          {i === 3 && <div className="m-list">{MOMENTS.map(([sport, moment], n) => (
            <div key={sport} className={`mom${n < s.moms ? ' shown' : ''}`}><span className="sp">{sport}</span><span className="w">{moment}</span></div>
          ))}</div>}
        </div>
        <p className="caption">{['Tap who won the point. The rules call the rest.', 'Wrong tap? One Undo fixes the over.', 'Friends follow live. No signal? Goals wait, then land.', 'Set point, all out, win by 2. Called for you.'][i]}</p>
      </article>
    );
  });
}
StoryScenes.propTypes = {
  index: PropTypes.number.isRequired,
  state: PropTypes.object.isRequired,
  reduced: PropTypes.bool.isRequired,
};

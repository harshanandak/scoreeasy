import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { getHomePath, loadReturningPlayerState, markAppEntered } from '../../../utils/appEntry';
import { BrandMark, GoArrow } from '../kit/KitParts';
import SportPicker from '../kit/SportPicker';
import StoryScenes from './StoryScenes';
import { STORIES } from './storyTimelines';
import useHomeStory, { useHomeMedia } from './useHomeStory';
import { homeStoryTokens } from '../theme/sportsTokens';
import './landing.css';

function ColourLayers({ index }) {
  return <div className="hero-bg" aria-hidden="true">{STORIES.map((story, i) => (
    <i key={story.theme} className={i === index ? 'on' : ''} style={{ background: story.gradient }} />
  ))}</div>;
}
ColourLayers.propTypes = { index: PropTypes.number.isRequired };

export default function GuestLanding() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [returningPlayer, setReturningPlayer] = useState(loadReturningPlayerState);
  const ctaPointer = useRef(false);
  const wide = useHomeMedia('(min-width: 900px)');
  const reduced = useHomeMedia('(prefers-reduced-motion: reduce)');
  const stageRef = useRef(null);
  const pickerHeading = useRef(null);
  const [hold, setHold] = useState({ hover: false, focus: false, press: false });
  const ctaHeld = Object.values(hold).some(Boolean);
  const story = useHomeStory(stageRef, reduced, ctaHeld);
  const [labelIndex, setLabelIndex] = useState(0);
  const [nudgeGone, setNudgeGone] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const lastPaused = useRef(false);
  const [pickerKeyboardFocus, setPickerKeyboardFocus] = useState(false);
  const themeMeta = useRef(null);

  useEffect(() => {
    const refresh = () => setReturningPlayer(loadReturningPlayerState());
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);
  useEffect(() => { if (!ctaHeld) setLabelIndex(story.index); }, [story.index, ctaHeld]);
  useEffect(() => {
    const existing = document.querySelector('meta[name="theme-color"]');
    const meta = existing ?? document.createElement('meta');
    const previous = meta.getAttribute('content');
    if (!existing) { meta.name = 'theme-color'; document.head.appendChild(meta); }
    themeMeta.current = meta;
    return () => {
      if (!existing) meta.remove();
      else if (previous === null) meta.removeAttribute('content');
      else meta.setAttribute('content', previous);
    };
  }, []);
  useEffect(() => { themeMeta.current?.setAttribute('content', STORIES[story.index].theme); }, [story.index]);
  useEffect(() => {
    if (lastPaused.current === story.paused) return;
    lastPaused.current = story.paused;
    setAnnouncement(story.paused ? 'Paused' : 'Playing');
  }, [story.paused]);
  useEffect(() => {
    const timer = setTimeout(() => setNudgeGone(true), 5200);
    return () => clearTimeout(timer);
  }, []);

  const setReason = (reason, value) => setHold((current) => ({ ...current, [reason]: value }));
  const startSport = (sport) => {
    markAppEntered();
    navigate(`/${sport.id}/quick`, { state: { newMatch: true } });
  };
  const start = (event) => {
    const selected = STORIES[labelIndex];
    if (selected.sport) startSport({ id: selected.sport });
    else {
      setPickerKeyboardFocus(event.detail === 0 && event.currentTarget.matches(':focus-visible'));
      pickerHeading.current?.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      pickerHeading.current?.focus({ preventScroll: true });
    }
  };

  return (
    <div className="home-stage-page" data-screen="guest-landing" style={{ ...homeStoryTokens.cssVariables, '--accent': story.index === 0 ? 'var(--home-tennis-accent)' : 'var(--home-white)' }}>
      <header className="hero">
        <ColourLayers index={story.index} />
        <div className="in">
          <nav className="top" aria-label="Main">
            <Link className="brand" to={getHomePath(isAuthenticated)} aria-label="Score Easy home"><BrandMark />Score Easy</Link>
            {!isAuthenticated && <div className="top-actions">
              {returningPlayer && <Link className="my-matches" to="/app">My matches</Link>}
              <Link className="signin se-ctl" to="/login">Sign in</Link>
            </div>}
          </nav>
          <div className="grid">
            <div className="lead">
              <h1>Score your <br />next match <br /><span className="ul">{wide ? 'from the sideline' : 'on your phone'}<svg viewBox="0 0 120 16" preserveAspectRatio="none" aria-hidden="true"><path d="M2.5 9.6C26 6.4 58 5 117 6.6C96 7.6 70 9.4 48 12.6" vectorEffect="non-scaling-stroke" /></svg></span>.</h1>
            </div>
            <section
              ref={stageRef} className="stage" tabIndex={0} aria-roledescription="carousel"
              aria-label="How scoring works. Swipe or use arrow keys to change stories. Tap or press Space to pause or play."
              data-story={story.index} data-playing={story.playing} {...story.handlers}
            >
              <StoryScenes index={story.index} state={story.state} reduced={reduced} />
              {story.paused && <span className="pause-mark" data-testid="pause-mark" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1" width="3" height="10" rx="1" /><rect x="7" y="1" width="3" height="10" rx="1" /></svg>
              </span>}
              <span className="stage-live" role="status" aria-live="polite">{announcement}</span>
              <button className="story-pause" type="button" onClick={story.togglePaused}
                aria-label={story.paused ? 'Play stories' : 'Pause stories'}>
                {story.paused ? 'Play stories' : 'Pause stories'}
              </button>
            </section>
            <div className="act">
              <div className={`nudge${nudgeGone ? ' gone' : ''}`} aria-hidden="true">
                <div className="nudge-art">
                  <svg viewBox="-10 -10 190 60" focusable="false">
                    <g transform="translate(46 22) rotate(-4)"><text className="w" style={{ '--i': 0 }} fontSize="21">Go on, </text></g>
                    <g transform="translate(94 20) rotate(-2)"><text className="w" style={{ '--i': 1 }} fontSize="22">try </text></g>
                    <g transform="translate(122 21) rotate(-5)"><text className="w" style={{ '--i': 2 }} fontSize="26">one!</text></g>
                    <path className="shaft" pathLength="1" d="M44 16C41 16.3 31.3 16.7 26 18C20.7 19.3 15.7 21.3 12 24C8.3 26.7 5.3 32.3 4 34" />
                    <path className="echo" pathLength="1" transform="translate(.7 .6)" d="M44 16C41 16.3 31.3 16.7 26 18C20.7 19.3 15.7 21.3 12 24C8.3 26.7 5.3 32.3 4 34" />
                    <path className="head" pathLength="1" d="M15.1 29.4Q10.8 30.7 4 34Q3 30.4 3.9 24.5" />
                  </svg>
                </div>
              </div>
              <button type="button" className="cta" onClick={start} aria-label={STORIES[labelIndex].label}
                onPointerEnter={(event) => { if (event.pointerType === 'mouse') setReason('hover', true); }} onPointerLeave={() => setReason('hover', false)}
                onFocus={() => { if (!ctaPointer.current) setReason('focus', true); }} onBlur={() => { ctaPointer.current = false; setReason('focus', false); }}
                onPointerDown={(event) => { ctaPointer.current = true; event.currentTarget.setPointerCapture?.(event.pointerId); setReason('focus', false); setReason('press', true); }}
                onPointerUp={() => setReason('press', false)} onPointerCancel={() => setReason('press', false)}
                onLostPointerCapture={() => setReason('press', false)}>
                <span className="lbls" aria-hidden="true">{STORIES.map((item, i) => (
                  <span key={item.label} className={`lbl${i === labelIndex ? '' : i < labelIndex ? ' above' : ' below'}`}>{item.label}</span>
                ))}</span><span className="go"><GoArrow /></span>
              </button>
              <p className="acct">or <Link to="/signup">create a free account</Link></p>
            </div>
          </div>
        </div>
      </header>

      <div className="in canvas">
        <section className="steps" aria-labelledby="home-how">
          <p className="eyebrow" id="home-how">3 steps to the first point</p>
          <ol>
            <li><b>1</b><span>Pick a sport<small>9 ready</small></span></li>
            <li><b>2</b><span>Add teams<small>or just names</small></span></li>
            <li><b>3</b><span>Tap to score<small>rules do the rest</small></span></li>
          </ol>
        </section>
        <section className="sports" aria-labelledby="home-pick" data-keyboard-focus={pickerKeyboardFocus}>
          <div className="sec-h"><h2 id="home-pick" ref={pickerHeading} tabIndex={-1}>Pick your sport</h2><Link to="/play" onClick={markAppEntered}>See all</Link></div>
          <SportPicker onSelect={startSport} idPrefix="home" showPopularHeading={false} showMoreHeading={false} />
        </section>
      </div>

      <footer className="end" aria-labelledby="home-keep">
        <ColourLayers index={story.index} />
        <div className="in">
          <div className="end-grid">
            <div><h2 id="home-keep">Keep every match.</h2><p>Save your matches and stats to a free account, and pick them up on any phone.</p></div>
            <div className="end-act">
              <Link className="cta" to="/signup">Create a free account<span className="go"><GoArrow /></span></Link>
              <p className="end-login">Have an account? <Link to="/login">Log in</Link></p>
            </div>
          </div>
          <div className="end-foot"><span>© 2026 Score Easy</span><nav aria-label="Legal">
            <Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/contact">Contact</Link>
          </nav></div>
        </div>
      </footer>
    </div>
  );
}

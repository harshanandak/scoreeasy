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
                    <title>Go on, try one!</title>
                    <g transform="translate(46 22) rotate(-4)"><path className="w" style={{ '--i': 0 }} d="M3.3 1Q2.8 0.5 2.5 -0.2Q2.2 -1 2.2 -1.7Q2.2 -3 2.4 -4.4Q2.6 -5.8 3 -7Q3.3 -7.7 3.6 -8.5Q3.9 -9.3 4.3 -10Q4.6 -10.7 4.9 -11.2Q5.6 -12.3 6.3 -13Q7 -13.6 7.3 -13.8Q7.9 -14.1 8.7 -14.3Q9.5 -14.4 10.3 -14.3Q10.9 -14.1 11.4 -13.9Q11.9 -13.6 12.3 -13.2Q12.6 -13 12.7 -12.7Q12.8 -12.5 12.8 -12.3Q12.8 -11.9 12.5 -11.7Q12.2 -11.4 11.9 -11.3Q11.5 -11.2 11.3 -11.4Q11 -11.8 10.8 -12Q10.5 -12.2 10.3 -12.3Q10 -12.5 9.6 -12.5Q9.3 -12.5 8.8 -12.4Q8.4 -12.2 8 -11.9Q7.8 -11.8 7.6 -11.5Q7.4 -11.3 7.1 -11Q6.8 -10.6 6.6 -10.3Q6 -9.3 5.6 -8.3Q5.2 -7.3 4.9 -6.1Q4.7 -5.6 4.6 -4.9Q4.4 -4.2 4.3 -3.5Q4.1 -2.9 4.1 -2.3Q4 -1.6 4.1 -1.2Q4.2 -0.8 4.6 -0.6Q4.9 -0.5 5.5 -0.6Q6.1 -0.8 6.6 -1.1Q7.2 -1.4 7.7 -1.8Q8.2 -2.3 8.7 -3Q9 -3.7 9.3 -4.3Q9.5 -4.9 9.5 -5.2Q9.5 -5.5 9.2 -5.5Q8.3 -5.5 7.8 -5.6Q7.3 -5.7 7.1 -6Q6.8 -6.1 6.8 -6.5Q6.8 -6.9 7.2 -7.1Q7.5 -7.3 8.2 -7.4Q8.8 -7.4 9.5 -7.3Q10.1 -7.2 10.5 -7Q11 -6.8 11.2 -6.3Q11.3 -5.9 11.4 -5.4Q11.4 -4.9 11.3 -4.4Q11.1 -3.7 10.8 -3Q10.4 -2.3 9.9 -1.6Q9.6 -1.2 9 -0.7Q8.5 -0.2 7.9 0.2Q7.3 0.6 6.8 0.8Q5.9 1.2 5 1.4Q4.1 1.5 3.3 1ZM13.9 -0.1Q13.6 -0.1 13.5 -0.3Q13.3 -0.4 13.1 -0.5Q12.7 -1 12.4 -1.4Q12.2 -1.9 12.3 -2.3Q12.3 -2.5 12.3 -2.6Q12.3 -2.8 12.3 -2.8Q12.2 -2.9 12.2 -2.9Q12.3 -2.9 12.3 -3Q12.5 -3 12.4 -3.3Q12.4 -3.4 12.5 -4Q12.7 -4.5 13 -5Q13.2 -5.2 13.4 -5.6Q13.7 -5.9 14 -6.3Q14.3 -6.6 14.5 -6.8Q15.1 -7.3 15.5 -7.6Q16 -7.8 16.4 -7.9Q16.9 -8 17.4 -8Q17.9 -8 18.2 -7.7Q18.7 -7.5 18.9 -7.1Q19.1 -6.8 19.1 -6.2Q19.2 -5.6 19 -4.7Q18.8 -3.8 18 -2.6Q17.5 -1.8 16.9 -1.4Q16.4 -1 15.8 -0.6Q15.4 -0.3 14.9 -0.3Q14.4 -0.2 13.9 -0.1ZM16 -2.7Q16.5 -3.1 16.7 -3.6Q16.9 -4.1 17.1 -4.7Q17.2 -4.9 17.3 -5.1Q17.3 -5.4 17.3 -5.7Q17.2 -6 17.1 -6Q16.9 -6.2 16.7 -6.1Q16.5 -6 16.3 -5.8Q15.6 -5.3 15.1 -4.6Q14.6 -3.9 14.3 -3Q14.3 -2.4 14.5 -2.2Q14.6 -1.9 15 -2Q15.5 -2.1 16 -2.7ZM26.6 -0.1Q26.3 -0.1 26.2 -0.3Q26 -0.4 25.8 -0.5Q25.4 -1 25.1 -1.4Q24.9 -1.9 24.9 -2.3Q25 -2.5 25 -2.6Q25 -2.8 25 -2.8Q24.9 -2.9 24.9 -2.9Q25 -2.9 25 -3Q25.1 -3 25.1 -3.3Q25.1 -3.4 25.2 -4Q25.4 -4.5 25.7 -5Q25.9 -5.2 26.1 -5.6Q26.4 -5.9 26.7 -6.3Q27 -6.6 27.2 -6.8Q27.7 -7.3 28.2 -7.6Q28.6 -7.8 29.1 -7.9Q29.6 -8 30.1 -8Q30.6 -8 30.9 -7.7Q31.4 -7.5 31.6 -7.1Q31.8 -6.8 31.8 -6.2Q31.9 -5.6 31.7 -4.7Q31.5 -3.8 30.7 -2.6Q30.1 -1.8 29.6 -1.4Q29.1 -1 28.5 -0.6Q28.1 -0.3 27.6 -0.3Q27.1 -0.2 26.6 -0.1ZM28.7 -2.7Q29.2 -3.1 29.4 -3.6Q29.6 -4.1 29.8 -4.7Q29.9 -4.9 29.9 -5.1Q30 -5.4 29.9 -5.7Q29.9 -6 29.8 -6Q29.6 -6.2 29.4 -6.1Q29.2 -6 28.9 -5.8Q28.3 -5.3 27.8 -4.6Q27.2 -3.9 27 -3Q27 -2.4 27.1 -2.2Q27.3 -1.9 27.7 -2Q28.1 -2.1 28.7 -2.7ZM40 -0.5Q39.5 -0.5 39.2 -0.7Q38.9 -0.9 38.7 -1.3Q38.6 -1.7 38.6 -2Q38.6 -2.4 38.7 -2.8Q38.7 -3.1 38.7 -3.4Q38.7 -3.4 38.7 -3.5Q38.7 -3.7 38.7 -3.8Q38.7 -4.1 38.6 -4.1Q38.5 -4.2 38.2 -4.1Q37.7 -3.9 37.2 -3.6Q36.7 -3.2 36.2 -2.8Q35.6 -2.3 35 -1.8Q34.5 -1.3 34.3 -1Q34.1 -0.7 33.9 -0.7Q33.7 -0.6 33.5 -0.7Q33.3 -0.8 33.1 -1Q33 -1.2 32.8 -1.4Q32.6 -1.7 32.5 -1.8Q32.5 -2.1 32.6 -2.4Q32.6 -2.7 32.7 -3Q32.9 -3.3 33 -3.6Q33.1 -3.8 33.2 -3.9Q33.3 -4.1 33.4 -4.3Q33.5 -4.6 33.6 -5Q33.8 -5.3 33.9 -5.7Q34.1 -6.2 34.3 -6.6Q34.4 -7 34.5 -7.5Q34.5 -7.5 34.5 -7.6Q34.5 -7.7 34.6 -7.7H34.6H34.7Q34.8 -7.8 35.2 -7.7Q35.6 -7.7 35.8 -7.5Q36.3 -7.1 36.3 -6.5Q36.2 -5.9 35.6 -4.9Q35.5 -4.6 35.3 -4.3Q35.2 -4 35.2 -3.9Q35.2 -3.9 35.3 -4Q35.5 -4.2 35.7 -4.3Q36 -4.5 36.1 -4.6Q36.2 -4.7 36.6 -5Q37 -5.3 37.4 -5.6Q37.8 -5.9 38.1 -6.1Q38.3 -6.3 38.6 -6.4Q39 -6.6 39.1 -6.6Q39.3 -6.6 39.6 -6.5Q39.9 -6.3 40.2 -6.1Q40.4 -5.9 40.5 -5.8Q40.5 -5.7 40.4 -5.5Q40.4 -5.4 40.4 -5.3Q40.4 -5 40.4 -4.5Q40.4 -4 40.4 -3.5Q40.4 -3.1 40.3 -2.7Q40.3 -2.7 40.4 -2.7Q40.4 -2.6 40.4 -2.6Q40.4 -2.5 40.4 -2.5Q40.4 -2.4 40.4 -2.4Q40.4 -2.3 40.5 -2.1Q40.6 -2 40.6 -1.8Q40.7 -1.6 40.8 -1.4Q40.8 -1.1 40.5 -0.8Q40.2 -0.6 40 -0.5ZM41.5 1.8Q41.2 1.8 41.1 1.7Q40.9 1.6 40.8 1.4Q40.8 1.3 40.9 1.2Q41 1.1 41.1 0.9Q41.4 0.7 41.6 0.4Q41.8 0.1 42 -0.2Q42.1 -0.5 42.3 -0.7Q42.3 -0.9 42.4 -1.2Q42.5 -1.6 42.6 -1.9Q42.6 -2.1 42.6 -2.2Q42.6 -2.4 42.7 -2.5Q42.9 -2.6 43.1 -2.7Q43.3 -2.8 43.6 -2.6Q43.8 -2.4 44 -1.6Q44 -1.2 44 -0.8Q43.9 -0.4 43.6 0.1Q43.6 0.3 43.3 0.6Q43 0.9 42.8 1.2Q42.5 1.5 42.4 1.5Q42.4 1.5 42.3 1.6Q42.2 1.6 42.1 1.7Q42 1.8 41.9 1.8Q41.7 1.8 41.5 1.8Z" /></g>
                    <g transform="translate(94 20) rotate(-2)"><path className="w" style={{ '--i': 1 }} d="M3.8 0Q3.5 -0 3.2 -0.3Q2.9 -0.5 2.7 -0.8Q2.5 -1.2 2.4 -1.4Q2.4 -1.4 2.4 -1.5Q2.3 -1.6 2.3 -1.6Q2.2 -1.6 2.2 -2.1Q2.2 -2.7 2.3 -3.3Q2.3 -3.9 2.4 -4.3Q2.5 -4.7 2.8 -5.3Q3 -5.9 3.1 -6.4L3.7 -7.6L2.8 -7.9Q2.7 -7.9 2.6 -8.1Q2.5 -8.2 2.5 -8.3Q2.5 -8.4 2.7 -8.8Q2.9 -9.1 3 -9.1Q3.1 -9.1 3.4 -9.1Q3.7 -9.1 4 -9.1Q4.2 -9.1 4.3 -9.2Q4.4 -9.2 4.5 -9.3Q4.6 -9.3 4.6 -9.5Q4.7 -9.7 4.8 -9.9Q4.9 -10 5.1 -10.3Q5.2 -10.6 5.3 -10.8Q5.4 -11 5.6 -11.3Q5.7 -11.5 5.9 -11.7Q6 -11.9 6.2 -12.1Q6.4 -12.2 6.9 -12.3Q7.3 -12.4 7.6 -12.1Q7.8 -11.9 7.8 -11.7Q7.9 -11.5 7.7 -11.2Q7.5 -10.8 7.2 -10.5Q7 -10.2 6.8 -9.8Q6.5 -9.3 6.7 -9.3Q6.9 -9.2 7.9 -9.4Q8.6 -9.5 8.8 -9.2Q9.1 -9 9.2 -8.6Q9.2 -8.1 9.1 -8Q8.9 -7.9 8.1 -7.9Q7.5 -7.8 7.1 -7.8Q6.8 -7.8 6.6 -7.8Q6.3 -7.7 6.2 -7.7Q6.1 -7.7 6 -7.7Q5.8 -7.7 5.7 -7.6Q5.6 -7.5 5.5 -7.3Q5.5 -7.2 5.3 -6.8Q5.1 -6.4 4.8 -6Q4.5 -5.1 4.3 -4.2Q4.1 -3.4 4 -2.6Q3.9 -2.1 4 -1.9Q4.1 -1.8 4.6 -1.7Q4.8 -1.7 5.3 -1.7Q5.7 -1.8 6 -1.8Q6.3 -2 6.5 -2.1Q6.8 -2.2 7 -2.3Q7.2 -2.4 7.4 -2.6Q7.6 -2.7 7.6 -2.7Q7.7 -2.9 7.9 -2.6Q8.1 -2.4 8.2 -2.1Q8.2 -1.9 8.1 -1.5Q8 -1.1 7.3 -0.7Q6.3 -0.1 5.3 0Q4.3 0.1 3.8 0ZM9.9 -0.6Q9.7 -0.7 9.5 -1Q9.2 -1.2 9.3 -1.7Q9.4 -2.3 9.5 -2.8Q9.6 -3.2 9.7 -3.8Q9.8 -4.1 10 -4.8Q10.2 -5.4 10.4 -6.1Q10.7 -6.9 11 -7.6Q11.3 -8.2 11.5 -8.6Q11.7 -8.8 12.2 -8.8Q12.7 -8.8 12.8 -8.6Q13.1 -8.4 13 -7.9Q12.9 -7.4 12.4 -6.4Q12.3 -6.1 12.1 -5.8Q11.9 -5.5 11.9 -5.3Q11.8 -5.1 11.9 -5.2Q12.1 -5.4 12.4 -5.7Q12.8 -6 13.2 -6.4Q13.6 -6.7 13.9 -6.9Q14.3 -7.1 14.4 -7.2Q14.6 -7.3 14.8 -7.4Q15 -7.5 15.1 -7.5Q15.6 -7.8 16.2 -7.7Q16.8 -7.7 17 -7.3Q17 -7.1 17.1 -7.1Q17.2 -7 17.2 -7Q17.3 -7 17.3 -6.9Q17.3 -6.8 17.3 -6.8Q17.3 -6.7 17 -6.4Q16.7 -6.1 16.4 -6.1Q16.1 -6.1 15.9 -6Q15.7 -5.9 15.4 -5.8Q14.5 -5.3 13.8 -4.9Q13.2 -4.5 12.5 -3.8Q12.3 -3.6 12.1 -3.4Q12 -3.3 11.8 -3Q11.7 -2.9 11.6 -2.5Q11.5 -2.1 11.4 -1.8Q11.3 -1.5 11.3 -1.4Q11.3 -1.4 11.2 -1.2Q11.2 -1 11 -0.8Q10.8 -0.4 10.5 -0.3Q10.3 -0.2 9.9 -0.6ZM17.1 4.6Q16.3 4.7 15.6 4.6Q14.8 4.5 14.4 4.2Q13.9 4 13.7 3.6Q13.6 3.1 13.9 2.9Q14.1 2.6 14.5 2.6Q14.9 2.5 15 2.7Q15.2 2.8 15.5 3Q15.9 3.2 16.5 3.1Q17 3 17.4 2.6Q17.8 2.2 18.1 1.8Q18.3 1.6 18.7 0.9Q19.1 0.2 19.6 -0.6Q20 -1.5 20.3 -2.2Q20.4 -2.3 20.5 -2.6Q20.6 -2.8 20.7 -3Q20.8 -3.2 20.9 -3.5Q21 -3.7 21.1 -3.8Q21.1 -3.9 21.3 -4.2Q21.4 -4.6 21.6 -4.9Q21.7 -5.2 21.9 -5.9Q22.1 -6.5 22.4 -6.9Q22.6 -7.4 22.8 -7.7Q22.9 -8 23.1 -8.1Q23.3 -8.2 23.5 -8.2Q23.7 -8.2 23.9 -8.1Q24.2 -7.9 24.4 -7.6Q24.5 -7.3 24.5 -7Q24.5 -6.6 24.1 -6Q24 -5.5 23.7 -5Q23.5 -4.6 23.4 -4.5Q23.3 -4.2 23.2 -3.9Q23 -3.6 22.9 -3.3Q22.5 -2.4 22.2 -1.9Q22 -1.3 21.7 -0.9Q21.5 -0.4 21.3 0.2Q20.8 1 20.3 1.7Q19.8 2.5 19.3 3.1Q19.1 3.3 18.7 3.6Q18.3 4 17.8 4.2Q17.4 4.5 17.1 4.6ZM19.8 -0.4Q19.5 -0.4 19.1 -0.8Q18.7 -1.2 18.5 -1.7Q18.2 -2.1 18.3 -2.3Q18.3 -2.4 18.3 -2.5Q18.3 -2.5 18.3 -2.5Q18.1 -2.5 18.1 -2.9Q18 -3.3 18 -3.9Q17.9 -4.5 17.9 -5.1Q18 -5.8 18 -6.3Q18.1 -6.7 18.1 -7.1Q18.1 -7.6 18.1 -7.8Q18.1 -8.2 18.2 -8.4Q18.4 -8.6 18.5 -8.7Q19.3 -9 19.7 -8.3Q20.1 -7.6 20 -6Q19.9 -5.1 19.9 -4.3Q19.9 -3.5 20.1 -2.9Q20.2 -2.4 20.6 -2.1Q20.7 -2 20.7 -1.8Q20.7 -1.5 20.5 -1.2Q20.3 -0.8 20.2 -0.6Q20 -0.4 19.8 -0.4Z" /></g>
                    <g transform="translate(122 21) rotate(-5)"><path className="w" style={{ '--i': 2 }} d="M4.4 -0.2Q4 -0.2 3.8 -0.3Q3.6 -0.4 3.4 -0.7Q2.9 -1.2 2.6 -1.8Q2.3 -2.4 2.3 -2.8Q2.4 -3 2.4 -3.2Q2.4 -3.4 2.4 -3.4Q2.3 -3.6 2.3 -3.6Q2.4 -3.6 2.4 -3.7Q2.6 -3.7 2.5 -4Q2.5 -4.2 2.7 -4.9Q2.9 -5.6 3.3 -6.2Q3.5 -6.5 3.8 -6.9Q4.1 -7.4 4.5 -7.8Q4.8 -8.2 5.1 -8.5Q5.8 -9 6.4 -9.4Q6.9 -9.7 7.5 -9.8Q8.1 -10 8.7 -10Q9.3 -10 9.7 -9.5Q10.3 -9.3 10.5 -8.8Q10.8 -8.4 10.8 -7.7Q10.9 -6.9 10.7 -5.8Q10.5 -4.7 9.4 -3.2Q8.8 -2.2 8.1 -1.7Q7.5 -1.2 6.8 -0.8Q6.2 -0.4 5.6 -0.3Q5 -0.2 4.4 -0.2ZM7 -3.4Q7.6 -3.8 7.8 -4.4Q8.1 -5 8.4 -5.8Q8.5 -6 8.5 -6.4Q8.6 -6.7 8.5 -7.1Q8.5 -7.4 8.3 -7.5Q8.1 -7.7 7.9 -7.6Q7.6 -7.5 7.3 -7.2Q6.5 -6.6 5.8 -5.7Q5.2 -4.9 4.9 -3.7Q4.8 -3 5.1 -2.7Q5.3 -2.4 5.8 -2.5Q6.3 -2.7 7 -3.4ZM20.9 -0.6Q20.4 -0.7 20 -0.9Q19.6 -1.1 19.4 -1.7Q19.3 -2.1 19.3 -2.5Q19.3 -3 19.3 -3.4Q19.4 -3.8 19.4 -4.2Q19.4 -4.2 19.4 -4.4Q19.4 -4.5 19.4 -4.7Q19.3 -5 19.2 -5.1Q19.1 -5.2 18.7 -5.1Q18.2 -4.8 17.5 -4.4Q16.9 -4 16.2 -3.4Q15.5 -2.9 14.8 -2.2Q14.2 -1.6 13.9 -1.2Q13.7 -0.8 13.4 -0.8Q13.2 -0.7 12.9 -0.9Q12.7 -1 12.5 -1.2Q12.3 -1.5 12 -1.8Q11.8 -2.1 11.7 -2.2Q11.7 -2.6 11.8 -3Q11.9 -3.3 12 -3.7Q12.1 -4 12.3 -4.5Q12.5 -4.7 12.5 -4.9Q12.6 -5.1 12.8 -5.3Q12.9 -5.7 13.1 -6.1Q13.3 -6.6 13.4 -7Q13.7 -7.7 13.9 -8.2Q14 -8.7 14.1 -9.3Q14.1 -9.3 14.2 -9.4Q14.2 -9.5 14.3 -9.5H14.4H14.4Q14.6 -9.7 15.1 -9.6Q15.6 -9.5 15.8 -9.3Q16.4 -8.8 16.4 -8.1Q16.3 -7.3 15.6 -6.1Q15.4 -5.7 15.2 -5.3Q15 -5 15 -4.8Q15 -4.8 15.2 -5Q15.4 -5.1 15.7 -5.4Q16 -5.6 16.2 -5.7Q16.3 -5.8 16.8 -6.2Q17.2 -6.6 17.7 -6.9Q18.3 -7.3 18.6 -7.5Q18.8 -7.7 19.3 -8Q19.7 -8.2 19.8 -8.2Q20.1 -8.2 20.5 -8Q20.9 -7.8 21.2 -7.6Q21.5 -7.3 21.6 -7.1Q21.6 -7 21.5 -6.9Q21.5 -6.7 21.5 -6.6Q21.5 -6.1 21.5 -5.6Q21.5 -5 21.5 -4.4Q21.5 -3.8 21.4 -3.3Q21.4 -3.3 21.4 -3.3Q21.4 -3.2 21.5 -3.2Q21.4 -3.1 21.5 -3.1Q21.5 -3 21.5 -3Q21.5 -2.8 21.6 -2.7Q21.7 -2.5 21.8 -2.2Q21.9 -2 22 -1.7Q22 -1.4 21.6 -1Q21.3 -0.7 20.9 -0.6ZM29 -0.5Q28.2 -0.1 27.3 -0Q26.4 0.1 25.7 -0.2Q24.9 -0.5 24.5 -1.1Q24.2 -1.5 24 -2.2Q23.7 -3 23.9 -4.2Q24 -5.4 24.6 -6.7Q25.2 -7.9 26.1 -8.8Q26.9 -9.8 27.9 -10.1Q28.3 -10.2 28.7 -10.3Q29.1 -10.3 29.7 -10.3Q30.3 -10.2 30.8 -10Q31.2 -9.8 31.4 -9.5Q31.8 -9.1 32 -8.7Q32.1 -8.3 32.1 -8Q32 -7.1 31.3 -6.2Q30.7 -5.2 29.6 -4.7Q29.2 -4.5 28.6 -4.5Q28 -4.4 27 -4.7Q26.3 -4.8 26.1 -4.5Q25.9 -4.3 26 -3.5Q26 -3 26.2 -2.7Q26.4 -2.3 26.8 -2.2Q27.4 -2.1 27.7 -2.2Q27.9 -2.3 28.3 -2.5Q28.5 -2.6 28.7 -2.8Q28.9 -2.9 29.1 -3.1Q29.3 -3.2 29.5 -3.3Q29.6 -3.4 29.7 -3.4Q29.8 -3.5 30 -3.5Q30.3 -3.4 30.5 -3.1Q30.8 -2.9 30.9 -2.6Q30.9 -2.4 30.6 -2Q30.3 -1.6 29.9 -1.2Q29.5 -0.8 29 -0.5ZM28.6 -6.3Q28.8 -6.4 29.2 -6.7Q29.5 -7 29.8 -7.3Q30.1 -7.6 30.1 -7.8Q30.1 -8.1 29.7 -8.3Q29.3 -8.5 28.7 -8.4Q28.5 -8.3 28.2 -8.1Q27.9 -7.9 27.7 -7.6Q27.4 -7.3 27.2 -7Q27 -6.7 26.9 -6.6Q27 -6.4 27.3 -6.3Q27.6 -6.3 28 -6.3Q28.4 -6.3 28.6 -6.3ZM35.2 -4.2Q34.5 -4.1 34.1 -4.8Q33.6 -5.5 34.1 -7.4Q34.3 -7.7 34.4 -8Q34.5 -8.3 34.5 -8.5Q34.6 -8.8 34.7 -9.3Q34.9 -9.8 35.1 -10.2Q35.3 -10.6 35.4 -10.7Q35.5 -10.7 35.6 -10.9Q35.7 -11 35.7 -11.2Q35.7 -11.4 35.8 -11.7Q35.9 -12 36 -12.1Q36 -12.2 36.1 -12.3Q36.2 -12.5 36.2 -12.6Q36.2 -12.7 36.3 -12.8Q36.3 -12.9 36.3 -13Q36.6 -13.4 36.9 -14.2Q37.3 -15 37.7 -15.9Q38.1 -16.8 38.3 -17.5Q38.6 -18.3 38.6 -18.4Q38.6 -18.6 38.7 -18.8Q38.8 -19 39.1 -18.9Q39.2 -19 39.4 -19Q39.6 -19 39.7 -19Q39.7 -19 39.9 -18.9Q40.1 -18.8 40.3 -18.6Q40.5 -18.4 40.6 -18.1Q40.6 -17.8 40.6 -17.5Q40.6 -17 40.2 -16.4Q39.9 -15.8 39.5 -15Q39.2 -14.5 39 -14.1Q38.7 -13.6 38.7 -13.5Q38.7 -13.4 38.6 -13.2Q38.5 -13 38.4 -12.7Q38.2 -12.4 38.1 -12.1Q37.9 -11.7 37.8 -11.4Q37.7 -11.1 37.7 -11Q37.7 -10.9 37.7 -10.8Q37.6 -10.7 37.5 -10.6Q37.4 -10.6 37.4 -10.5Q37.4 -10.3 37.4 -10.3Q37.4 -10.2 37.3 -9.8Q37.2 -9.5 36.9 -8.9Q36.4 -7.6 36.2 -6.7Q36 -5.9 35.9 -5.4Q35.9 -4.7 35.6 -4.5Q35.4 -4.3 35.2 -4.2ZM33.8 -0.2Q33.3 0.1 32.9 0Q32.6 0 32.1 -0.3Q31.6 -0.8 31.8 -1.4Q31.9 -1.9 32.7 -2.4Q33.2 -2.7 33.4 -2.7Q33.7 -2.8 34.2 -2.5Q35.1 -2 35 -1.3Q34.9 -0.7 33.8 -0.2Z" /></g>
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

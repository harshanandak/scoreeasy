import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import { getSportById } from '../../../models/sportRegistry';
import { deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import { sportIdentityVars } from '../../../lib/sportIdentity';
import { SportBadge } from '../kit/KitParts';
import { buildDemo } from './landingDemo';

/* Home's scoreboard: a slideshow of five sports, each on its own board (cricket overs and the
   chase, tennis sets and points, volleyball sets and serve...) with one line that names a feature.
   Every board is built by the sport's engine (landingDemo.js). `steps` are the engine inputs the
   slide plays in order: [] is the opening state, then one point is scored; badminton then undoes
   it. Timing lives in CSS animations (a progress fill and invisible ticks), so pausing is one
   class and reduced motion (no animation) also means no autoplay. */
export const SLIDES = [
  { sportId: 'cricket', tagline: 'Every ball counted. The chase worked out.', steps: [[], ['B']] },
  { sportId: 'tennis', tagline: 'Deuce, advantage and tiebreaks, handled for you.', steps: [[], ['A']] },
  { sportId: 'volleyball', tagline: 'Sets, points and the serve, always right.', steps: [[], ['A']] },
  { sportId: 'football', tagline: 'Friends follow every goal from one link.', steps: [[], ['B']], live: true },
  { sportId: 'badminton', tagline: 'Tapped the wrong side? Undo puts it back.', steps: [[], ['B'], []], undo: true },
];

/* When each step plays, in ms after its slide opens; a slide holds 4.6 s (.home-dot-fill). */
const STEP_AT_MS = [0, 1500, 3000];

/* A number that rolls in (a short rise and fade) only when it differs from the step before. */
function Num({ value, before, className }) {
  const changed = before !== undefined && before !== value;
  return (
    <span key={changed ? `n-${value}` : 'base'} className={`${className}${changed ? ' home-roll' : ''}`}>{value}</span>
  );
}
Num.propTypes = { value: PropTypes.string.isRequired, before: PropTypes.string, className: PropTypes.string.isRequired };

function Board({ slide, step }) {
  const sport = getSportById(slide.sportId);
  const demo = buildDemo(slide.sportId, slide.steps[step]);
  const before = step > 0 ? buildDemo(slide.sportId, slide.steps[step - 1]) : null;
  const { cols, cells, serving } = demo.board;
  const columns = `minmax(0, 1fr) ${'2.6em '.repeat(cols.length)}auto`;
  const foot = demo.chase ?? demo.context;

  return (
    <div className="home-board" style={teamColourVars(deriveTeamColours(...demo.colours))}>
      <div className="home-board-head">
        <SportBadge sportId={sport.id} />
        <span className="home-board-sport">{sport.name}</span>
        {slide.live && <span className="home-board-live"><i aria-hidden="true" />Live</span>}
        {slide.undo && (
          <span className={`home-board-undo${step === 2 ? ' is-done' : ''}`}>
            <span>Undo</span><span aria-hidden="true">Undone</span>
          </span>
        )}
      </div>
      <div className="home-board-grid" style={{ gridTemplateColumns: columns }}>
        <span aria-hidden="true" />
        {cols.map((label) => <span key={label} className="home-board-label">{label}</span>)}
        <span aria-hidden="true" />
        {demo.teams.map((team, side) => (
          <div key={team.name} className="home-board-row" style={{ display: 'contents' }}>
            <span className="home-board-team">
              <i className={`home-board-bar home-board-bar-${side ? 'b' : 'a'}`} aria-hidden="true" />
              {team.name}
              <i className={`home-board-serve${serving === side ? ' is-on' : ''}`} aria-hidden="true" />
              {serving === side && <span className="sr-only">, serving</span>}
            </span>
            {cells[side].map((cell, i) => (
              <Num key={cols[i]} className="home-board-cell" value={cell} before={before?.board.cells[side][i]} />
            ))}
            <span className="home-board-score">
              <Num className="home-board-num" value={team.score} before={before?.teams[side].score} />
              {team.suffix && <Num className="home-board-suffix" value={team.suffix} before={before?.teams[side].suffix} />}
            </span>
          </div>
        ))}
      </div>
      <p className="home-board-foot">{foot}</p>
    </div>
  );
}
Board.propTypes = {
  step: PropTypes.number.isRequired,
  slide: PropTypes.shape({
    sportId: PropTypes.string.isRequired,
    steps: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)).isRequired,
    live: PropTypes.bool,
    undo: PropTypes.bool,
  }).isRequired,
};

export default function ScoreSlides() {
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState(null);
  const [direction, setDirection] = useState('next');
  const [steps, setSteps] = useState(() => SLIDES.map(() => 0));
  const [hold, setHold] = useState({ hover: false, focus: false, touch: false, hidden: false });
  const [reduced, setReduced] = useState(false);
  const pointer = useRef(null);
  const paused = Object.values(hold).some(Boolean);

  useEffect(() => {
    const onVisibility = () => setHold((h) => ({ ...h, hidden: document.hidden }));
    document.addEventListener('visibilitychange', onVisibility);
    const query = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const onMotion = () => setReduced(Boolean(query?.matches));
    onMotion();
    query?.addEventListener?.('change', onMotion);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      query?.removeEventListener?.('change', onMotion);
    };
  }, []);

  const go = (next, dir = next > index ? 'next' : 'back') => {
    const target = (next + SLIDES.length) % SLIDES.length;
    if (target === index) return;
    setDirection(dir);
    setPrevious(index);
    setIndex(target);
    setSteps((all) => all.map((value, i) => (i === target ? 0 : value)));
  };
  const own = (handler) => (event) => { if (event.target === event.currentTarget) handler(); };
  const setStep = (value) => setSteps((all) => all.map((current, i) => (i === index ? value : current)));

  const onPointerDown = (event) => {
    pointer.current = { x: event.clientX, y: event.clientY };
    if (event.pointerType !== 'mouse') setHold((h) => ({ ...h, touch: true }));
  };
  const onPointerEnd = (event) => {
    const start = pointer.current;
    pointer.current = null;
    setHold((h) => ({ ...h, touch: false }));
    if (!start || event.type === 'pointercancel') return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(event.clientY - start.y)) go(index + (dx < 0 ? 1 : -1), dx < 0 ? 'next' : 'back');
  };

  return (
    <section
      className={`home-slides${paused ? ' is-paused' : ''}`}
      data-dir={direction}
      aria-roledescription="carousel"
      aria-label="Score Easy, one sport at a time"
      data-testid="landing-example"
      onMouseEnter={() => setHold((h) => ({ ...h, hover: true }))}
      onMouseLeave={() => setHold((h) => ({ ...h, hover: false }))}
      onFocus={() => setHold((h) => ({ ...h, focus: true }))}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHold((h) => ({ ...h, focus: false })); }}
    >
      <div
        className="home-slides-card"
        aria-live={paused || reduced ? 'polite' : 'off'}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {SLIDES.map((slide, i) => {
          const active = i === index;
          const sport = getSportById(slide.sportId);
          return (
            <div
              key={slide.sportId}
              className={`home-slide${active ? ' is-active' : ''}${i === previous ? ' is-leaving' : ''}`}
              style={sportIdentityVars(slide.sportId)}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${SLIDES.length}: ${sport.name}`}
              aria-hidden={active ? undefined : 'true'}
            >
              <Board slide={slide} step={steps[i]} />
              <p className="home-slide-tag">{slide.tagline}</p>
              {active && slide.steps.slice(1).map((_, k) => (
                <span
                  key={`${index}-${k}`}
                  className="home-tick"
                  style={{ animationDuration: `${STEP_AT_MS[k + 1]}ms` }}
                  onAnimationEnd={own(() => setStep(k + 1))}
                  aria-hidden="true"
                />
              ))}
            </div>
          );
        })}
      </div>
      <div className="home-slides-dots" role="group" aria-label="Choose a sport to show">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.sportId}
            type="button"
            className="home-dot"
            aria-label={`Show ${getSportById(slide.sportId).name}`}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => go(i)}
          >
            <span className="home-dot-track" aria-hidden="true">
              {i === index && <span key={index} className="home-dot-fill" onAnimationEnd={own(() => go(index + 1, 'next'))} />}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

import PropTypes from 'prop-types';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getSportById } from '../../../models/sportRegistry';
import { deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import { sportIdentityVars } from '../../../lib/sportIdentity';
import { SportBadge } from '../kit/KitParts';
import { buildDemo } from './landingDemo';
import { RAIL_COPIES, homeCard, nearestCard, settleCard, wrapIndex } from './railLoop';

/* Home's boards: a swipe rail of five sports, each on its own board (cricket overs and the chase,
   tennis sets and points, volleyball sets and serve...) with one line that names a feature.
   Every board is built by the sport's engine (landingDemo.js). `steps` are the engine inputs the
   board plays in order: [] is the opening state, then one point is scored; badminton then undoes
   it. The rail loops forever (railLoop.js) and moves on by itself after each board has played.
   Timing lives in CSS animations (invisible ticks), so pausing is one class and reduced motion
   (no animation) also means no autoplay: the boards stay still and the rail is still swipeable. */
export const SLIDES = [
  { sportId: 'cricket', tagline: 'Every ball counted. The chase worked out.', steps: [[], ['B']] },
  { sportId: 'tennis', tagline: 'Deuce, advantage and tiebreaks, handled for you.', steps: [[], ['A']] },
  { sportId: 'volleyball', tagline: 'Sets, points and the serve, always right.', steps: [[], ['A']] },
  { sportId: 'football', tagline: 'Friends follow every goal from one link.', steps: [[], ['B']], live: true },
  { sportId: 'badminton', tagline: 'Tapped the wrong side? Undo puts it back.', steps: [[], ['B'], []], undo: true },
];

/* When each step plays, in ms after its board comes into view; the board then holds until 4.6 s
   (.home-advance) before the rail moves on. */
const STEP_AT_MS = [0, 1500, 3000];
const HOLD_MS = 4600;
const SETTLE_MS = 140;

/* A number that rolls in (a short rise and fade) only when it differs from the step before. */
function Num({ value, before, className }) {
  const changed = before !== undefined && before !== value;
  return (
    <span key={changed ? `n-${value}` : 'base'} className={`${className}${changed ? ' home-roll' : ''}`}>{value}</span>
  );
}
Num.propTypes = { value: PropTypes.string.isRequired, before: PropTypes.string, className: PropTypes.string.isRequired };

const Board = memo(function Board({ slide, step }) {
  const sport = getSportById(slide.sportId);
  const demo = buildDemo(slide.sportId, slide.steps[step]);
  const before = step > 0 ? buildDemo(slide.sportId, slide.steps[step - 1]) : null;
  const { cols, cells, serving } = demo.board;
  const columns = `minmax(0, 1fr) ${'2.2em '.repeat(cols.length)}auto`;
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
});
Board.propTypes = {
  step: PropTypes.number.isRequired,
  slide: PropTypes.shape({
    sportId: PropTypes.string.isRequired,
    steps: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)).isRequired,
    live: PropTypes.bool,
    undo: PropTypes.bool,
  }).isRequired,
};

const COUNT = SLIDES.length;

/* Width of one card plus its gap, from the layout; 0 before the rail has a layout. */
function cardPitch(rail) {
  const [first, second] = rail?.children ?? [];
  return first && second ? second.offsetLeft - first.offsetLeft : 0;
}

export default function ScoreSlides() {
  const railRef = useRef(null);
  const activeRef = useRef(0);
  const reducedRef = useRef(false);
  const settleTimer = useRef(0);
  const [active, setActive] = useState(0);
  const [round, setRound] = useState(0);
  const [steps, setSteps] = useState(() => SLIDES.map(() => 0));
  const [hold, setHold] = useState({ hover: false, focus: false, touch: false, hidden: false, moving: false });
  const [reduced, setReduced] = useState(false);
  const paused = Object.values(hold).some(Boolean);

  useEffect(() => {
    const onVisibility = () => setHold((h) => ({ ...h, hidden: document.hidden }));
    document.addEventListener('visibilitychange', onVisibility);
    const query = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const onMotion = () => { reducedRef.current = Boolean(query?.matches); setReduced(reducedRef.current); };
    onMotion();
    query?.addEventListener?.('change', onMotion);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      query?.removeEventListener?.('change', onMotion);
    };
  }, []);

  const showBoard = useCallback((board) => {
    if (board === activeRef.current) return;
    activeRef.current = board;
    setActive(board);
    setRound((r) => r + 1);
  }, []);

  /* A swipe, a key or an auto-advance has come to rest: step out of the clone copies, unseen, and
     put every board that is not showing back to its opening state. */
  const settle = useCallback(() => {
    window.clearTimeout(settleTimer.current);
    const rail = railRef.current;
    const pitch = cardPitch(rail);
    if (pitch > 0) {
      const card = nearestCard(rail.scrollLeft, pitch, COUNT);
      const home = settleCard(card, COUNT);
      if (home !== card) rail.scrollLeft = home * pitch;
      showBoard(wrapIndex(home, COUNT));
    }
    setHold((h) => (h.moving ? { ...h, moving: false } : h));
    setSteps((all) => all.map((value, i) => (i === activeRef.current ? value : 0)));
  }, [showBoard]);

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;
    const pitch = cardPitch(rail);
    if (pitch > 0) rail.scrollLeft = homeCard(0, COUNT) * pitch;

    const onScroll = () => {
      const width = cardPitch(rail);
      if (width > 0) showBoard(wrapIndex(nearestCard(rail.scrollLeft, width, COUNT), COUNT));
      setHold((h) => (h.moving ? h : { ...h, moving: true }));
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(settle, SETTLE_MS);
    };
    const onResize = () => {
      const width = cardPitch(rail);
      if (width > 0) rail.scrollLeft = homeCard(activeRef.current, COUNT) * width;
    };
    rail.addEventListener('scroll', onScroll, { passive: true });
    rail.addEventListener('scrollend', settle);
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(settleTimer.current);
      rail.removeEventListener('scroll', onScroll);
      rail.removeEventListener('scrollend', settle);
      window.removeEventListener('resize', onResize);
    };
  }, [settle, showBoard]);

  /* Move by whole cards. Under reduced motion the move is instant. */
  const move = useCallback((by) => {
    const rail = railRef.current;
    const pitch = cardPitch(rail);
    if (!(pitch > 0)) return;
    const card = nearestCard(rail.scrollLeft, pitch, COUNT);
    const target = Math.min(Math.max(card + by, 0), COUNT * RAIL_COPIES - 1);
    const left = target * pitch;
    const behavior = reducedRef.current ? 'auto' : 'smooth';
    if (typeof rail.scrollTo === 'function') rail.scrollTo({ left, behavior });
    else rail.scrollLeft = left;
  }, []);

  const own = (handler) => (event) => { if (event.target === event.currentTarget) handler(); };
  const setStep = (value) => setSteps((all) => all.map((current, i) => (i === active ? value : current)));

  const onKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    move(event.key === 'ArrowRight' ? 1 : -1);
  };

  return (
    <section
      className={`home-slides${paused ? ' is-paused' : ''}`}
      aria-roledescription="carousel"
      aria-label="Score Easy, one sport at a time"
      data-testid="landing-example"
      data-active={active}
      onMouseEnter={() => setHold((h) => ({ ...h, hover: true }))}
      onMouseLeave={() => setHold((h) => ({ ...h, hover: false }))}
      onFocus={() => setHold((h) => ({ ...h, focus: true }))}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHold((h) => ({ ...h, focus: false })); }}
    >
      <div
        ref={railRef}
        className="home-rail"
        role="group"
        aria-label="Boards, swipe sideways"
        aria-live={paused || reduced ? 'polite' : 'off'}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => { if (event.pointerType !== 'mouse') setHold((h) => ({ ...h, touch: true })); }}
        onPointerUp={() => setHold((h) => ({ ...h, touch: false }))}
        onPointerCancel={() => setHold((h) => ({ ...h, touch: false }))}
      >
        {Array.from({ length: RAIL_COPIES * COUNT }, (_, card) => {
          const i = card % COUNT;
          const slide = SLIDES[i];
          const real = Math.floor(card / COUNT) === 1;
          const sport = getSportById(slide.sportId);
          return (
            <div
              key={card}
              className={`home-slide${real && i === active ? ' is-active' : ''}`}
              style={sportIdentityVars(slide.sportId)}
              data-clone={real ? undefined : 'true'}
              role={real ? 'group' : undefined}
              aria-roledescription={real ? 'slide' : undefined}
              aria-label={real ? `${i + 1} of ${COUNT}: ${sport.name}` : undefined}
              aria-hidden={real ? undefined : 'true'}
            >
              <Board slide={slide} step={steps[i]} />
              <p className="home-slide-tag">{slide.tagline}</p>
              {real && i === active && !reduced && slide.steps.slice(1).map((_, k) => (
                <span
                  key={`${round}-${k}`}
                  className="home-tick"
                  style={{ animationDuration: `${STEP_AT_MS[k + 1]}ms` }}
                  onAnimationEnd={own(() => setStep(k + 1))}
                  aria-hidden="true"
                />
              ))}
              {real && i === active && !reduced && (
                <span
                  key={`${round}-next`}
                  className="home-tick home-advance"
                  style={{ animationDuration: `${HOLD_MS}ms` }}
                  onAnimationEnd={own(() => move(1))}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Arrow buttons are for a mouse on desktop; phones swipe, so CSS hides them there. */}
      <div className="home-rail-nav">
        <button type="button" className="se-ctl home-rail-btn" aria-label="Previous board" onClick={() => move(-1)}>&larr;</button>
        <button type="button" className="se-ctl home-rail-btn" aria-label="Next board" onClick={() => move(1)}>&rarr;</button>
      </div>
    </section>
  );
}

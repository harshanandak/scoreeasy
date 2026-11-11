import PropTypes from 'prop-types';
import { useCallback, useRef, useState } from 'react';
import { CardPlayer } from './HomeCards';
import { CARDS, longestLoop } from './cardTimelines';
import { wrapIndex } from './railLoop';
import { useHold, useInView, useReducedMotion, useTabHidden, usingKeyboard } from './railHooks';
import { useDeadline } from './useTimeline';

/* Home's card rail on phones and tablets: `per` cards on show (one on a phone, two on a tablet), the
   rest one swipe away, looping forever. Which cards are on show is state (`start`), never read back
   from a scroll position, so nothing a finger or a resize does to the layout can strand it. Each
   page plays its cards once, then the next page replaces it (useDeadline, which also retries if the
   end is ever missed). It stands still while a finger or the pointer is on it, while keyboard focus is
   in it, while the tab is hidden, while less than half of it is on screen, and when the visitor taps
   Pause (WCAG 2.2.2). Under reduced motion nothing plays or advances: each card shows its still frame,
   and swiping, the arrow keys and the dots still work. */

const COUNT = CARDS.length;
const SWIPE_PX = 44;

const PauseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="5" y="4" width="5" height="16" rx="1.5" /><rect x="14" y="4" width="5" height="16" rx="1.5" /></svg>
);
const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" /></svg>
);

export default function HomePager({ per = 1 }) {
  const rootRef = useRef(null);
  const touchRef = useRef(null);
  const [start, setStart] = useState(0);
  const [dir, setDir] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const reduced = useReducedMotion();
  const hidden = useTabHidden();
  const inView = useInView(rootRef, 0.5);
  const { set, held } = useHold();
  const running = !reduced && !userPaused && !held && !hidden && inView;

  const visible = Array.from({ length: per }, (_, k) => wrapIndex(start + k, COUNT));
  const pageMs = longestLoop(visible.map((i) => CARDS[i]));

  const go = useCallback((by) => {
    setDir(by > 0 ? 1 : -1);
    setStart((s) => wrapIndex(s + by, COUNT));
  }, []);
  useDeadline(pageMs, running, () => go(per), start);

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (event.pointerType !== 'mouse') set('touch', true);
    touchRef.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event) => {
    set('touch', false);
    const from = touchRef.current;
    touchRef.current = null;
    if (!from) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };
  const onPointerCancel = () => { set('touch', false); touchRef.current = null; };
  const onKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    go(event.key === 'ArrowRight' ? 1 : -1);
  };

  return (
    <section
      ref={rootRef}
      className="home-rail"
      aria-roledescription="carousel"
      aria-label="Score Easy in action"
      data-testid="landing-example"
      data-start={start}
      data-playing={String(running)}
      onMouseEnter={() => set('hover', true)}
      onMouseLeave={() => set('hover', false)}
      onFocus={() => { if (usingKeyboard()) set('focus', true); }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) set('focus', false); }}
    >
      <div
        className="home-stage"
        data-per={per}
        role="group"
        aria-label="Animation cards, swipe sideways"
        aria-live={running ? 'off' : 'polite'}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {visible.map((i) => (
          <div key={`${start}-${i}`} className={`home-slot${dir ? ` is-from-${dir > 0 ? 'next' : 'prev'}` : ''}`}>
            <CardPlayer
              card={CARDS[i]}
              running={running}
              still={reduced}
              slideLabel={`${i + 1} of ${COUNT}: ${CARDS[i].title}`}
            />
          </div>
        ))}
      </div>

      <div className="home-controls">
        <div className="home-dots" role="group" aria-label="Choose a card">
          {CARDS.map((card, i) => {
            const on = visible.includes(i);
            return (
              <button
                key={card.id}
                type="button"
                className={`home-dot${on ? ' is-on' : ''}`}
                aria-label={`Show card ${i + 1} of ${COUNT}: ${card.title}`}
                aria-current={i === start ? 'true' : undefined}
                onClick={() => { setDir(i >= start ? 1 : -1); setStart(i); }}
              >
                <i>{on && !reduced && <b key={start} style={{ animationDuration: `${pageMs}ms` }} />}</i>
              </button>
            );
          })}
        </div>
        {!reduced && (
          <button
            type="button"
            className="home-pause"
            aria-pressed={userPaused}
            aria-label={userPaused ? 'Play animations' : 'Pause animations'}
            onClick={() => setUserPaused((p) => !p)}
          >
            {userPaused ? <PlayIcon /> : <PauseIcon />}
            <span>{userPaused ? 'Play' : 'Pause'}</span>
          </button>
        )}
      </div>
    </section>
  );
}
HomePager.propTypes = { per: PropTypes.number };

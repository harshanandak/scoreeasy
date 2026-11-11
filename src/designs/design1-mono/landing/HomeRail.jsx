import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CardFace, cardVars } from './HomeCards';
import { CARDS } from './cardTimelines';
import { RAIL_COPIES, homeCard, nearestCard, settleCard, wrapIndex } from './railLoop';

/* Home's rail: five animation cards (cardTimelines.js), each playing while it is the visible one and
   handing over to the next when its loop is done. The rail loops forever (railLoop.js). One clock
   (useTimeline) times the visible card; the card components only draw the state it picks. Under
   reduced motion there is no clock: every card shows its still frame and the rail stays swipeable. */

const COUNT = CARDS.length;
const SETTLE_MS = 140;

/* Width of one card plus its gap, from the layout; 0 before the rail has a layout. */
function cardPitch(rail) {
  const [first, second] = rail?.children ?? [];
  return first && second ? second.offsetLeft - first.offsetLeft : 0;
}

/* The frame of card `id`'s timeline: its index changes at each `times` entry while `running`, and
   `onEnd` fires once, when the loop is over. Pausing keeps the elapsed time, so play resumes where it
   stopped; a new `id` starts from the top. */
function useTimeline(id, running, onEnd) {
  const timeline = CARDS[id].timeline;
  const [at, setAt] = useState({ id, index: 0 });
  const elapsed = useRef(0);
  const fired = useRef(0);
  const endRef = useRef(onEnd);

  useEffect(() => { endRef.current = onEnd; });
  useEffect(() => { elapsed.current = 0; fired.current = 0; }, [id]);

  useEffect(() => {
    if (!running || elapsed.current >= timeline.loopMs) return undefined;
    const from = elapsed.current;
    const startedAt = Date.now() - from;
    const timers = [];
    timeline.times.forEach((time, index) => {
      if (index <= fired.current) return;
      timers.push(window.setTimeout(() => { fired.current = index; setAt({ id, index }); }, Math.max(0, time - from)));
    });
    timers.push(window.setTimeout(() => { elapsed.current = timeline.loopMs; endRef.current?.(); }, Math.max(0, timeline.loopMs - from)));
    return () => {
      elapsed.current = Math.max(elapsed.current, Date.now() - startedAt);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [id, running, timeline]);

  return at.id === id ? at.index : 0;
}

export default function HomeRail() {
  const railRef = useRef(null);
  const activeRef = useRef(0);
  const indexRef = useRef(0);
  const reducedRef = useRef(false);
  const settleTimer = useRef(0);
  const moveRef = useRef(() => {});
  const [active, setActive] = useState(0);
  const [parked, setParked] = useState(null);
  const [hold, setHold] = useState({ hover: false, focus: false, touch: false, hidden: false, moving: false });
  const [reduced, setReduced] = useState(false);
  const paused = Object.values(hold).some(Boolean);
  const index = useTimeline(active, !reduced && !paused, () => moveRef.current(1));
  useEffect(() => { indexRef.current = index; });

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

  /* The card that was playing keeps its last frame until the rail comes to rest, so it does not
     jump back to its start while it is still part way on screen. */
  const showCard = useCallback((card) => {
    if (card === activeRef.current) return;
    setParked({ id: activeRef.current, index: indexRef.current });
    activeRef.current = card;
    setActive(card);
  }, []);

  /* A swipe, a key or an auto-advance has come to rest: step out of the clone copies, unseen, and
     put every card that is not showing back to its opening frame. */
  const settle = useCallback(() => {
    window.clearTimeout(settleTimer.current);
    const rail = railRef.current;
    const pitch = cardPitch(rail);
    if (pitch > 0) {
      const card = nearestCard(rail.scrollLeft, pitch, COUNT);
      const home = settleCard(card, COUNT);
      if (home !== card) rail.scrollLeft = home * pitch;
      showCard(wrapIndex(home, COUNT));
    }
    setHold((h) => (h.moving ? { ...h, moving: false } : h));
    setParked(null);
  }, [showCard]);

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;
    const pitch = cardPitch(rail);
    if (pitch > 0) rail.scrollLeft = homeCard(0, COUNT) * pitch;

    const onScroll = () => {
      const width = cardPitch(rail);
      if (width > 0) showCard(wrapIndex(nearestCard(rail.scrollLeft, width, COUNT), COUNT));
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
  }, [settle, showCard]);

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
  useEffect(() => { moveRef.current = move; }, [move]);

  /* The state one card shows: the playing card follows the clock (all three copies of it, so the
     copy the eye is on is always the one moving), a card just left keeps its last frame until rest,
     the rest sit at their opening frame, and under reduced motion every card shows its still frame. */
  const frameOf = (card) => {
    const { states, still } = CARDS[card].timeline;
    if (reduced) return { state: still, idle: false };
    if (card === active) return { state: states[index], idle: false };
    if (parked?.id === card) return { state: states[parked.index], idle: false };
    return { state: states[0], idle: true };
  };

  const onKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    move(event.key === 'ArrowRight' ? 1 : -1);
  };

  return (
    <section
      className={`home-slides${paused ? ' is-paused' : ''}`}
      aria-roledescription="carousel"
      aria-label="Score Easy in action"
      data-testid="landing-example"
      data-active={active}
      data-playing={String(!reduced)}
      onMouseEnter={() => setHold((h) => ({ ...h, hover: true }))}
      onMouseLeave={() => setHold((h) => ({ ...h, hover: false }))}
      onFocus={() => setHold((h) => ({ ...h, focus: true }))}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHold((h) => ({ ...h, focus: false })); }}
    >
      <div
        ref={railRef}
        className="home-rail"
        role="group"
        aria-label="Cards, swipe sideways"
        aria-live={paused || reduced ? 'polite' : 'off'}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => { if (event.pointerType !== 'mouse') setHold((h) => ({ ...h, touch: true })); }}
        onPointerUp={() => setHold((h) => ({ ...h, touch: false }))}
        onPointerCancel={() => setHold((h) => ({ ...h, touch: false }))}
      >
        {Array.from({ length: RAIL_COPIES * COUNT }, (_, slot) => {
          const i = slot % COUNT;
          const card = CARDS[i];
          const real = Math.floor(slot / COUNT) === 1;
          const { state, idle } = frameOf(i);
          return (
            <div
              key={slot}
              className={`home-slide${real && i === active ? ' is-active' : ''}${idle ? ' is-idle' : ''}`}
              style={cardVars(card)}
              data-clone={real ? undefined : 'true'}
              role={real ? 'group' : undefined}
              aria-roledescription={real ? 'slide' : undefined}
              aria-label={real ? `${i + 1} of ${COUNT}: ${card.title}` : undefined}
              aria-hidden={real ? undefined : 'true'}
            >
              <CardFace card={card} state={state} />
            </div>
          );
        })}
      </div>
      {/* Arrow buttons are for a mouse on desktop; phones swipe, so CSS hides them there. */}
      <div className="home-rail-nav">
        <button type="button" className="se-ctl home-rail-btn" aria-label="Previous card" onClick={() => move(-1)}>&larr;</button>
        <button type="button" className="se-ctl home-rail-btn" aria-label="Next card" onClick={() => move(1)}>&rarr;</button>
      </div>
    </section>
  );
}

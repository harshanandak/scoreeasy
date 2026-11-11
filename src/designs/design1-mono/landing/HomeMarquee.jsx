import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import { CardPlayer } from './HomeCards';
import { CARDS } from './cardTimelines';
import { MARQUEE_FADE_END, marqueeCardOpacity } from './railLoop';
import { useHold, useInView, useReducedMotion, useTabHidden, usingKeyboard } from './railHooks';

/* Home's card rail on desktop: the five animation cards slide by themselves, right to left, in a band
   that runs from the right edge of the window toward the headline and fades to nothing before it
   reaches the headline's column (a mask in CSS), so a card has vanished before it could cross the
   text. The cards are decoration there: each one plays its own animation, over and over, while it
   is on screen and stands still while it is not (an IntersectionObserver per card). The track is two
   identical groups side by side that slide by exactly one group's width, so the loop has no seam;
   the second group is a copy (aria-hidden and inert, so it is not read and cannot take focus).
   Pause stops the track and every animation (WCAG 2.2.2); so do hover, keyboard focus, a hidden tab
   and the band leaving the screen. Under reduced motion there is no marquee: one static row of the
   five cards on their still frames, scrollable by hand. */

const COUNT = CARDS.length;

function MarqueeCard({ card, index, clone, running, still, bandRef }) {
  const ref = useRef(null);
  const onScreen = useInView(ref, 0);
  const [inBand, setInBand] = useState(false);
  useEffect(() => {
    const element = ref.current;
    const band = bandRef.current;
    if (!element || !band || still) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      element.style.setProperty('--card-opacity', '1');
      setInBand(true);
      return undefined;
    }
    // Fade the whole card before the mask can cut individual letters or controls into fragments.
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      const bandLeft = entry.rootBounds ? entry.rootBounds.left - MARQUEE_FADE_END : band.getBoundingClientRect().left;
      const opacity = marqueeCardOpacity(entry.boundingClientRect.left - bandLeft);
      element.style.setProperty('--card-opacity', String(opacity));
      setInBand(opacity > 0);
    }), {
      root: band,
      rootMargin: `0px 320px 0px -${MARQUEE_FADE_END}px`,
      threshold: Array.from({ length: 33 }, (_, i) => i / 32),
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [bandRef, still]);
  return (
    <CardPlayer
      cardRef={ref}
      card={card}
      running={running && onScreen && inBand}
      visualsRunning={running}
      still={still}
      loop
      hidden={clone}
      slideLabel={`${index + 1} of ${COUNT}: ${card.title}`}
    />
  );
}
MarqueeCard.propTypes = {
  card: CardPlayer.propTypes.card,
  index: PropTypes.number.isRequired,
  clone: PropTypes.bool.isRequired,
  running: PropTypes.bool.isRequired,
  still: PropTypes.bool.isRequired,
  bandRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
};

export default function HomeMarquee() {
  const rootRef = useRef(null);
  const bandRef = useRef(null);
  const [userPaused, setUserPaused] = useState(false);
  const reduced = useReducedMotion();
  const hidden = useTabHidden();
  const inView = useInView(rootRef, 0);
  const { set, held } = useHold();
  const running = !reduced && !userPaused && !held && !hidden && inView;

  return (
    <section
      ref={rootRef}
      className={`home-marquee${running ? '' : ' is-paused'}${reduced ? ' is-still' : ''}`}
      aria-roledescription="carousel"
      aria-label="Score Easy in action"
      data-testid="landing-example"
      data-playing={String(running)}
      onMouseEnter={() => set('hover', true)}
      onMouseLeave={() => set('hover', false)}
      onFocus={() => { if (usingKeyboard()) set('focus', true); }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) set('focus', false); }}
    >
      <div ref={bandRef} className="home-band">
        <div className="home-track">
          {[false, true].map((clone) => (
            (!clone || !reduced) && (
              <div
                key={clone ? 'clone' : 'cards'}
                className="home-group"
                aria-hidden={clone ? 'true' : undefined}
                inert={clone ? '' : undefined}
                data-clone={clone ? 'true' : undefined}
              >
                {CARDS.map((card, index) => (
                  <MarqueeCard key={card.id} card={card} index={index} clone={clone} running={running} still={reduced} bandRef={bandRef} />
                ))}
              </div>
            )
          ))}
        </div>
      </div>
      {!reduced && (
        <button
          type="button"
          className="home-pause"
          aria-pressed={userPaused}
          aria-label={userPaused ? 'Play animations' : 'Pause animations'}
          onClick={() => setUserPaused((p) => !p)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
            {userPaused
              ? <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" />
              : <><rect x="5" y="4" width="5" height="16" rx="1.5" /><rect x="14" y="4" width="5" height="16" rx="1.5" /></>}
          </svg>
          <span>{userPaused ? 'Play' : 'Pause'}</span>
        </button>
      )}
    </section>
  );
}

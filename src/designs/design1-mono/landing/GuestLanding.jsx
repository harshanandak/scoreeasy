import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { markAppEntered } from '../../../utils/appEntry';
import { GoArrow, HandUnderline, KitSection, KitTop, KitWash } from '../kit/KitParts';
import SportPicker from '../kit/SportPicker';
import '../kit/history.css';
import './landing.css';
import { LANDING_FAQ } from './landingFaq';
import HomeRail from './HomeRail';
import { useBreakpoint, useMediaQuery, useReducedMotion } from './railHooks';

/* Home (/). Phone first screen: the top bar (logo, Sign in), the headline, one line of reassurance
   and the animation rail, nothing else. Below it: Start a match, Play's own sport picker (Popular
   as full tiles, More sports as mini tiles), the FAQ, a closing Start and the footer.
   Start a match never leaves the page: it scrolls to the picker and moves focus to its heading, so
   starting is one tap on a sport. On a phone a slim bar with the same Start sticks to the bottom
   once the in-flow Start has scrolled off the top, and goes while the picker or the closing block is
   on screen (so it never covers or doubles a visible action). A tile starts that sport's quick
   match, as on the Play hub. From 900px the copy says "sideline" and "device", not "phone". */

const FOOTER_LINKS = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Contact', to: '/contact' },
];

const PICKER_HEADING_ID = 'home-pick';

export default function GuestLanding() {
  const { cloudAuthAvailable, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const size = useBreakpoint();
  const wide = useMediaQuery('(min-width: 900px)');
  const reduced = useReducedMotion();
  const startRef = useRef(null);
  const pickerRef = useRef(null);
  const endRef = useRef(null);
  const [showBar, setShowBar] = useState(false);
  const device = wide ? 'device' : 'phone';

  const startSport = (sport) => {
    markAppEntered();
    navigate(`/${sport.id}/quick`, { state: { newMatch: true } });
  };

  /* Start a match: bring the sport picker to the top and put focus on its heading. */
  const goToPicker = () => {
    pickerRef.current?.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    document.getElementById(PICKER_HEADING_ID)?.focus({ preventScroll: true });
  };

  /* The sticky bar (phone only): on once the in-flow Start is above the top of the screen, off while
     the picker or the closing block (closing Start + footer) is on screen. */
  useEffect(() => {
    if (size !== 'phone') {
      setShowBar(false);
      return undefined;
    }
    const update = () => {
      const start = startRef.current?.getBoundingClientRect();
      const visible = (ref) => {
        const rect = ref.current?.getBoundingClientRect();
        return rect?.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
      };
      setShowBar(Boolean(start?.height > 0 && start.bottom <= 0 && !visible(pickerRef) && !visible(endRef)));
    };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(update);
    [startRef, pickerRef, endRef].forEach((ref) => { if (ref.current) observer?.observe(ref.current); });
    // A fast jump can skip an observed element without changing its intersection state.
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [size]);

  const startButton = (
    <button type="button" className="se-go" onClick={goToPicker}>
      Start a match <GoArrow />
    </button>
  );

  const startBlock = (
    <div className="home-start" ref={startRef}>
      {startButton}
      <p className="home-saves">No account needed. Your score saves on this {device}, even offline.</p>
      {!isAuthenticated && (
        <p className="home-account">
          Save across {wide ? 'devices' : 'phones'}?{' '}
          <Link to={cloudAuthAvailable ? '/signup' : 'https://scoreeasy.app/signup'} onClick={markAppEntered}>Create a free account</Link>
        </p>
      )}
    </div>
  );

  return (
    <div className="kit-screen kit-landing" data-screen="guest-landing">
      <KitWash
        from="color-mix(in srgb, var(--se-color-ink) 8%, transparent)"
        to="color-mix(in srgb, var(--se-color-action) 10%, transparent)"
      />

      <div className="home-first">
        <div className="home-wrap">
          <KitTop title="Score Easy">
            {!isAuthenticated && <Link className="home-signin" to="/login">Sign in</Link>}
          </KitTop>
        </div>

        <div className="home-wrap home-hero">
          <header className="home-copy">
            <h1 className="kit-title">
              Score your next match <HandUnderline>{wide ? 'from the sideline' : 'on your phone'}</HandUnderline>.
            </h1>
            <p className="home-assure">Free · No account · Works offline</p>
            {size === 'desktop' && startBlock}
          </header>

          <section className="home-demo" aria-labelledby="landing-example-title">
            <h2 id="landing-example-title" className="home-sr">See Score Easy in action</h2>
            <HomeRail />
          </section>
        </div>
      </div>

      <div className="home-wrap">
        {size !== 'desktop' && startBlock}

        <section ref={pickerRef} className="home-picker" aria-labelledby={PICKER_HEADING_ID}>
          <KitSection id={PICKER_HEADING_ID} title="Pick your sport" focusable />
          <SportPicker onSelect={startSport} idPrefix="home" />
        </section>

        <section className="home-faq" aria-labelledby="landing-faq-title">
          <h2 id="landing-faq-title">Questions</h2>
          {LANDING_FAQ.map((item) => (
            <details key={item.question} name="home-faq">
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </section>

        <div ref={endRef}>
          <section className="home-close" aria-labelledby="home-close-title">
            <div>
              <h2 id="home-close-title">Ready to score your next match?</h2>
              <p>Pick a sport and start. Free, no account.</p>
            </div>
            {startButton}
          </section>

          <footer className="kit-landing-foot">
            <span className="kit-landing-foot-brand">Score Easy &copy; 2026</span>
            <nav aria-label="Legal">
              {FOOTER_LINKS.map(({ label, to }) => (
                <Link key={label} to={to}>{label}</Link>
              ))}
            </nav>
          </footer>
        </div>
      </div>

      {showBar && (
        <div className="home-sticky" data-testid="sticky-start">
          <button type="button" className="se-go" onClick={goToPicker}>
            Start a match <GoArrow />
          </button>
        </div>
      )}
    </div>
  );
}

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { getSportsByCategory } from '../../../models/sportRegistry';
import { markAppEntered } from '../../../utils/appEntry';
import { sportIdentity, sportIdentityVars } from '../../../lib/sportIdentity';
import { GoArrow, HandUnderline, KitSection, KitTop, KitWash, SportTile } from '../kit/KitParts';
import '../kit/history.css';
import './landing.css';
import { LANDING_FAQ } from './landingFaq';
import HomeRail from './HomeRail';

/* Home (/). A headline and one sentence, Start, a swipe rail of animation cards (tap and the rule
   answers, undo, a live link, the moments the app calls; it loops forever and moves on by itself),
   then the app's own sport tiles and the FAQ.
   Phone order: top bar (logo, Sign in), headline, Start, card rail, "Pick your sport" grid, FAQ.
   A tile starts that sport's quick match, as on the Play hub; Start has one fixed label and opens
   the full picker (/play); it never follows the card on show, which changes on its own. */

/* Home shows the first 8 sports of the registry order, not all 9: an even count fills the
   2-column phone grid and the 4-column desktop grid with no sport alone on the last row. The one
   left out (Hockey, the last in LATER_SPORT_IDS) runs on the same goals board as Football and is
   still one tap away under See all (/play). */
const HOME_SPORT_COUNT = 8;

const FOOTER_LINKS = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Contact', to: '/contact' },
];

export default function GuestLanding() {
  const { cloudAuthAvailable, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const groups = getSportsByCategory();
  const sports = Object.values(groups).flat().slice(0, HOME_SPORT_COUNT);
  const startSport = (sport) => {
    markAppEntered();
    navigate(`/${sport.id}/quick`, { state: { newMatch: true } });
  };

  return (
    <div className="kit-screen kit-landing" data-screen="guest-landing" style={sportIdentityVars('cricket')}>
      <KitWash from={sportIdentity('cricket')?.tint} to={sportIdentity('tennis')?.tint} />
      <KitTop title="Score Easy">
        {!isAuthenticated && <Link className="kit-top-signin" to="/login">Sign in</Link>}
      </KitTop>

      <div className="kit-landing-top">
        <header className="kit-landing-hero">
          <h1 className="kit-title">
            Score your next match <HandUnderline>on your phone</HandUnderline>.
          </h1>
          <p className="kit-sub">
            No account needed. Your score saves on this phone, even offline.
          </p>
        </header>

        <div className="kit-landing-start">
          <Link className="se-go" to="/play" onClick={markAppEntered}>
            Start a match <GoArrow />
          </Link>
        </div>

        <section className="kit-landing-example" aria-labelledby="landing-example-title">
          <KitSection id="landing-example-title" title="See Score Easy in action" />
          <HomeRail />
          <p className="kit-landing-signup">
            Save across phones?{' '}
            <Link to={cloudAuthAvailable ? '/signup' : 'https://scoreeasy.app/signup'} onClick={markAppEntered}>Create a free account</Link>
          </p>
        </section>

        <section className="kit-landing-picker" aria-labelledby="landing-pick-title">
          <KitSection
            id="landing-pick-title"
            title="Pick your sport"
            aside={<Link className="kit-link" to="/play" onClick={markAppEntered}>See all</Link>}
          />
          <div className="kit-grid2 kit-landing-grid">
            {sports.map((sport) => (
              <SportTile key={sport.id} sport={sport} onSelect={startSport} />
            ))}
          </div>
        </section>
      </div>

      <section className="home-faq" aria-labelledby="landing-faq-title">
        <h2 id="landing-faq-title">Questions</h2>
        {LANDING_FAQ.map((item) => (
          <details key={item.question} name="home-faq">
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
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
  );
}

import { Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { markAppEntered } from '../../../utils/appEntry';
import { sportIdentity, sportIdentityVars } from '../../../lib/sportIdentity';
import { GoArrow, HandUnderline, KitSection, KitTop, KitWash } from '../kit/KitParts';
import '../kit/history.css';
import './landing.css';
import { LANDING_FAQ } from './landingFaq';
import ScoreSlides from './ScoreSlides';

/* Home (/). One screen of pitch: a headline, one sentence, Start and Sign in, and a slideshow of
   real sport boards whose taglines carry the features. Start has one fixed label and opens the
   app's sport picker (/play); it never follows the slide, which changes on its own. */

const FOOTER_LINKS = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Contact', to: '/contact' },
];

export default function GuestLanding() {
  const { cloudAuthAvailable } = useAuth();

  return (
    <div className="kit-screen kit-landing" data-screen="guest-landing" style={sportIdentityVars('cricket')}>
      <KitWash from={sportIdentity('cricket')?.tint} to={sportIdentity('tennis')?.tint} />
      <KitTop title="Score Easy" />

      <div className="kit-landing-top">
        <header className="kit-landing-hero">
          <h1 className="kit-title">
            Score your next match <HandUnderline>on your phone</HandUnderline>.
          </h1>
          <p className="kit-sub">
            No account needed. Your score saves on this phone, even offline.
          </p>
          <div className="kit-landing-actions">
            <Link className="se-go" to="/play" onClick={markAppEntered}>
              Start a match <GoArrow />
            </Link>
            <Link className="se-ctl" to="/login">Sign in</Link>
          </div>
        </header>

        <section className="kit-landing-example" aria-labelledby="landing-example-title">
          <KitSection id="landing-example-title" title="See a match being scored" />
          <ScoreSlides />
          <p className="kit-landing-signup">
            Your matches on every phone?{' '}
            <Link to={cloudAuthAvailable ? '/signup' : 'https://scoreeasy.app/signup'} onClick={markAppEntered}>Create a free account</Link>
          </p>
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

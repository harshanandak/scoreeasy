import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { getSportById, getSportsList } from '../../../models/sportRegistry';
import { deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import { sportIdentity, sportIdentityVars } from '../../../lib/sportIdentity';
import { FilterChip, GoArrow, HandUnderline, KitSection, KitTop, KitWash, SportTile } from '../kit/KitParts';
import '../kit/history.css';
import './landing.css';
import { buildDemo } from './landingDemo';
import useIsMobile from './useIsMobile';

/* The guest landing (/marketing), in the Kit look of Home, Play and the boards. Above the fold it is
   an app: one primary action (start a match), sign in secondary, and a match scored by the real
   engines. Below it, it explains the product in the numbered, confident voice of the original
   marketing page (01 / APP EXPERIENCE ... 04 / HOW IT WORKS). The sport the scorer picks is held
   once, so the chip, the example card and the Start buttons always name the same game. Every claim
   below the fold is true of the shipped app: guest scoring and tournaments are open to guests,
   scoring is saved on the device first, sync and the live link need a sign in. */

const PRODUCTION_SIGNUP_URL = 'https://scoreeasy.app/signup';
const sports = getSportsList();

function sportPlayPath(sportId) {
  return sportId ? `/play?sport=${sportId}` : '/play';
}

const EXPERIENCE_STATS = [
  { value: String(sports.length), label: 'Sports ready', detail: `Cricket, kabaddi, volleyball and ${sports.length - 3} more, all picked from one list.` },
  { value: '0', label: 'Sign-ups needed', detail: 'Score your first point without an account.' },
  { value: 'OFFLINE', label: 'No signal needed', detail: 'Keep scoring with no signal. Your matches save on your phone.' },
];

const EXPERIENCE_NOTES = [
  'Pick a sport here and it is already chosen on the play screen.',
  'You never have to sign in to score.',
  'Use it in your browser, or on Android and iOS.',
];

const FEATURES = [
  { tag: 'Start', title: 'No sign-up to start', desc: 'Start a match from your browser or the app without an account. Every point is saved on your phone first, so a weak signal never costs one.' },
  { tag: 'Account', title: 'Your history, any phone', desc: 'Sign in when you want your matches on every phone. Until then, they stay on this one.' },
  { tag: 'Share', title: 'Live share link', desc: 'Signed in, you can go live and send a link so friends follow the score. A match stays private until you share it.' },
  { tag: 'Undo', title: 'Undo that follows', desc: 'Mis-tapped? Undo takes the point back, and the score, serve and set go back with it.' },
  { tag: 'Rules', title: 'Real rules, every sport', desc: 'Deuce, sets, overs and raids are scored by each sport’s own rules, so the board never disagrees with the game.' },
  { tag: 'Organize', title: 'Tournaments', desc: 'Round-robin and knockout brackets with standings, scored match by match.' },
];

const STEPS = [
  { num: '01', label: 'Pick sport', sub: `Choose from ${sports.length} sports, each with its own rules.` },
  { num: '02', label: 'Add teams', sub: 'Name your teams or players. Set match format.' },
  { num: '03', label: 'Score live', sub: 'Tap to score. Track sets, overs, or goals in real time.' },
];

const FOOTER_LINKS = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Contact', to: '/contact' },
];

/* The numbered mono eyebrow plus a heavy headline that opens each explaining section. */
function Head({ id, eyebrow, children }) {
  return (
    <div className="kit-landing-head">
      <p className="kit-landing-eyebrow">{eyebrow}</p>
      <h2 id={id}>{children}</h2>
    </div>
  );
}

Head.propTypes = { id: PropTypes.string.isRequired, eyebrow: PropTypes.string.isRequired, children: PropTypes.node.isRequired };

function ExampleCard({ demo }) {
  const sport = getSportById(demo.sportId);
  const colours = teamColourVars(deriveTeamColours(...demo.colours));
  const [teamA, teamB] = demo.teams;
  const label = `${teamA.name} ${teamA.score}, ${teamB.name} ${teamB.score}. ${demo.status}`;
  const team = (side, row) => (
    <div className="kit-last-team">
      <span className={`kit-last-bar kit-last-bar-${side}`} aria-hidden="true" />
      <span className="kit-last-name">
        {row.name}
        {row.meta && <small className="kit-landing-meta">{row.meta}</small>}
      </span>
      <span className="kit-last-score">{row.score}</span>
    </div>
  );

  return (
    <div className="kit-last kit-landing-card" style={colours} data-testid="landing-example">
      <div className="kit-last-meta">
        <span className="kit-sport-chip" style={sportIdentityVars(sport.id)}>
          <i aria-hidden="true" />{sport.name}
        </span>
        <span className="kit-chip">Example match</span>
      </div>
      <div className="kit-last-teams" role="group" aria-label={label}>
        {team('a', teamA)}
        {team('b', teamB)}
      </div>
      <p className="kit-last-detail">{demo.status}</p>
    </div>
  );
}

ExampleCard.propTypes = {
  demo: PropTypes.shape({
    sportId: PropTypes.string.isRequired,
    colours: PropTypes.arrayOf(PropTypes.string).isRequired,
    status: PropTypes.string.isRequired,
    teams: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string.isRequired,
      score: PropTypes.string.isRequired,
      meta: PropTypes.string,
    })).isRequired,
  }).isRequired,
};

export default function GuestLanding() {
  const { cloudAuthAvailable } = useAuth();
  const navigate = useNavigate();
  const mobile = useIsMobile();
  const [selectedId, setSelectedId] = useState(sports[0].id);
  const selected = getSportById(selectedId);
  const demo = useMemo(() => buildDemo(selectedId), [selectedId]);
  const nextSport = sports[(sports.findIndex((sport) => sport.id === selectedId) + 1) % sports.length];
  const startPath = sportPlayPath(selectedId);
  const signupPath = cloudAuthAvailable ? '/signup' : PRODUCTION_SIGNUP_URL;

  return (
    <div className="kit-screen kit-landing" data-screen="guest-landing">
      <KitWash from={sportIdentity(selectedId)?.tint} to={sportIdentity(nextSport.id)?.tint} />
      <KitTop title="Score Easy" />

      <div className="kit-landing-top">
        <header className="kit-landing-hero">
          <p className="kit-landing-eyebrow">Universal score tracker</p>
          <h1 className="kit-title">
            Score any game <HandUnderline>on your phone</HandUnderline>.
          </h1>
          <p className="kit-sub">
            Start in seconds with no account. It works offline, and your matches follow you when you sign in.
          </p>
          <div className="kit-landing-actions">
            <Link className="se-go" to={startPath}>
              {`Start ${selected.name}`} <GoArrow />
            </Link>
            <Link className="se-ctl" to="/login">Sign in</Link>
          </div>
        </header>

        <section className="kit-landing-example" aria-labelledby="landing-example-title">
          <KitSection id="landing-example-title" title="See a match being scored" />
          <div className="kit-landing-chips" role="group" aria-label="Pick a sport">
            {sports.map((sport) => (
              <FilterChip
                key={sport.id}
                label={sport.name}
                sportId={sport.id}
                pressed={sport.id === selectedId}
                onClick={() => setSelectedId(sport.id)}
              />
            ))}
          </div>
          <ExampleCard demo={demo} />
          <p className="kit-landing-note">
            Scored by the same rules the app uses for each sport. Tap Start to score your own.
          </p>
        </section>
      </div>

      <section aria-labelledby="landing-experience-title">
        <Head id="landing-experience-title" eyebrow="01 / App experience">Start first. Save later.</Head>
        <ul className="kit-landing-stats">
          {EXPERIENCE_STATS.map((stat) => (
            <li key={stat.label} className="kit-card">
              <b>{stat.value}</b>
              <span className="kit-landing-label">{stat.label}</span>
              <p>{stat.detail}</p>
            </li>
          ))}
        </ul>
        <ul className="kit-list kit-landing-notes">
          {EXPERIENCE_NOTES.map((note, i) => (
            <li key={note} className="kit-row">
              <span className="kit-row-text">
                <span className="kit-landing-label">{`App 0${i + 1}`}</span>
                <span className="kit-row-title">{note}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="landing-features-title">
        <Head id="landing-features-title" eyebrow="02 / Features">Everything you need.</Head>
        <ul className="kit-landing-features">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="kit-card">
              <span className="kit-chip">{feature.tag}</span>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="landing-sports-title">
        <Head id="landing-sports-title" eyebrow="03 / Sports">{`${sports.length} sports. Your rules.`}</Head>
        <div className="kit-grid3 kit-landing-tiles">
          {sports.map((sport) => (
            <SportTile
              key={sport.id}
              sport={sport}
              mini={mobile}
              selected={sport.id === selectedId}
              onSelect={(picked) => navigate(sportPlayPath(picked.id))}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="landing-how-title">
        <Head id="landing-how-title" eyebrow="04 / How it works">Three steps.</Head>
        <ol className="kit-list kit-steps kit-landing-steps">
          {STEPS.map((step) => (
            <li key={step.label} className="kit-row">
              <span className="kit-step-num" aria-hidden="true">{step.num}</span>
              <span className="kit-row-text">
                <span className="kit-row-title">{step.label}</span>
                <span className="kit-row-sub">{step.sub}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="kit-landing-ready" aria-labelledby="landing-ready-title">
        <div className="kit-hero">
          <div className="kit-hero-intro">
            <h2 id="landing-ready-title">Ready?</h2>
            <p>No account needed to score your first point.</p>
          </div>
          <div className="kit-hero-foot kit-landing-actions">
            <Link className="se-go" to={startPath}>
              {`Start ${selected.name}`} <GoArrow />
            </Link>
            <Link className="se-ctl" to={signupPath}>Create a free account</Link>
          </div>
        </div>
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

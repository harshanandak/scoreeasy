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

/* The guest landing (/marketing), in the Kit look of Home, Play and the boards. One job: say what
   Score Easy is, give one primary action (start a match), keep sign in secondary, show the nine
   sports, and show a match scored by the real engines. The sport the scorer picks is held once, so
   the chip, the example card and the Start button always name the same game. */

const PRODUCTION_SIGNUP_URL = 'https://scoreeasy.app/signup';
const sports = getSportsList();

function sportPlayPath(sportId) {
  return sportId ? `/play?sport=${sportId}` : '/play';
}

const STEPS = [
  { label: 'Pick a game', sub: 'Nine sports, each with its own rules' },
  { label: 'Tap to score', sub: 'Works offline, so a weak signal never costs a point' },
  { label: 'Sign in to sync', sub: 'Optional: your history follows you to any phone' },
];

const FOOTER_LINKS = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Contact', to: '/contact' },
];

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
          <h1 className="kit-title">
            Score any game <HandUnderline>on your phone</HandUnderline>.
          </h1>
          <p className="kit-sub">
            Start as a guest in seconds. It works offline, and your matches sync when you sign in.
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
            Scored by the same rules engine the app uses. Tap Start to score your own.
          </p>
        </section>
      </div>

      <section aria-labelledby="landing-sports-title">
        <KitSection id="landing-sports-title" title={`${sports.length} sports, one scorer`} />
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
        <KitSection id="landing-how-title" title="How it works" />
        <ol className="kit-list kit-steps kit-landing-steps">
          {STEPS.map((step, i) => (
            <li key={step.label} className="kit-row">
              <span className="kit-step-num" aria-hidden="true">{i + 1}</span>
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
            <h2 id="landing-ready-title">Ready when you are.</h2>
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

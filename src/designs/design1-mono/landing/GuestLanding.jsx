import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { markAppEntered } from '../../../utils/appEntry';
import { getSportById, getSportsList } from '../../../models/sportRegistry';
import { deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import { sportIdentity, sportIdentityVars } from '../../../lib/sportIdentity';
import { GoArrow, HandUnderline, KitSection, KitTop, KitWash, SportBadge } from '../kit/KitParts';
import '../kit/history.css';
import './landing.css';
import { buildDemo } from './landingDemo';
import { LANDING_FAQ } from './landingFaq';

const sports = getSportsList();

function sportPlayPath(sportId) {
  return sportId ? `/play?sport=${sportId}` : '/play';
}

const FOOTER_LINKS = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Contact', to: '/contact' },
];

/* The sport picker: a 3 x 3 grid of the real sport tiles (the row badge from the Kit and the
   sport's own doodle). Nothing scrolls and nothing is cut off; the chosen sport is an ink fill. */
function SportPicker({ selectedId, onSelect }) {
  return (
    <div className="kit-landing-picker" role="group" aria-label="Pick a sport">
      {sports.map((sport) => {
        const selected = sport.id === selectedId;
        return (
          <button
            key={sport.id}
            type="button"
            className={`kit-pick${selected ? ' is-selected' : ''}`}
            aria-pressed={selected ? 'true' : 'false'}
            onClick={() => onSelect(sport.id)}
          >
            <SportBadge sportId={sport.id} />
            <span className="kit-pick-name">{sport.name}</span>
          </button>
        );
      })}
    </div>
  );
}

SportPicker.propTypes = { selectedId: PropTypes.string.isRequired, onSelect: PropTypes.func.isRequired };

function ExampleCard({ demo, onPoint, onUndo, canUndo, touched, revision }) {
  const sport = getSportById(demo.sportId);
  const colours = teamColourVars(deriveTeamColours(...demo.colours));
  const [teamA, teamB] = demo.teams;
  const label = `${teamA.name} ${teamA.score}, ${teamB.name} ${teamB.score}. ${demo.context}`;
  const team = (side, row) => (
    <button type="button" className="kit-last-team" onClick={() => onPoint(side === 'a' ? 'A' : 'B')} disabled={demo.sportId === 'cricket' && side === 'a'} aria-label={`Score for ${row.name}`}>
      <span className={`kit-last-bar kit-last-bar-${side}`} aria-hidden="true" />
      <span className="kit-last-name">
        {row.name}
        {row.meta && <small className="kit-landing-meta">{row.meta}</small>}
      </span>
      <span key={revision} className={`kit-last-score${touched ? ' home-score-bump' : ''}`}>{row.score}{row.suffix && <small>{row.suffix}</small>}</span>
    </button>
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
      <p className="kit-last-detail" aria-live="polite">{demo.context}</p>
      <div className="home-demo-tools"><span className="home-demo-hint" hidden={touched}>{demo.sportId === 'cricket' ? 'Tap Australia for a single' : 'Tap a team to score'}</span><button type="button" className="se-ctl home-undo" onClick={onUndo} disabled={!canUndo}>Undo</button></div>
    </div>
  );
}

ExampleCard.propTypes = {
  touched: PropTypes.bool.isRequired, revision: PropTypes.number.isRequired,
  onPoint: PropTypes.func.isRequired, onUndo: PropTypes.func.isRequired, canUndo: PropTypes.bool.isRequired,
  demo: PropTypes.shape({
    sportId: PropTypes.string.isRequired,
    colours: PropTypes.arrayOf(PropTypes.string).isRequired,
    context: PropTypes.string.isRequired,
    teams: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string.isRequired,
      score: PropTypes.string.isRequired,
      meta: PropTypes.string,
    })).isRequired,
  }).isRequired,
};

export default function GuestLanding() {
  const { cloudAuthAvailable } = useAuth();
  const [selectedId, setSelectedId] = useState(sports[0].id);
  const selected = getSportById(selectedId);
  const [touched, setTouched] = useState(false);
  const [revision, setRevision] = useState(0);
  const [points, setPoints] = useState([]);
  const demo = useMemo(() => buildDemo(selectedId, points), [selectedId, points]);
  const nextSport = sports[(sports.findIndex((sport) => sport.id === selectedId) + 1) % sports.length];
  const startPath = sportPlayPath(selectedId);

  return (
    <div className="kit-screen kit-landing" data-screen="guest-landing" style={sportIdentityVars(selectedId)}>
      <KitWash from={sportIdentity(selectedId)?.tint} to={sportIdentity(nextSport.id)?.tint} />
      <KitTop title="Score Easy" />

      <div className="kit-landing-top">
        <header className="kit-landing-hero">
          <p className="kit-landing-eyebrow">Pick a sport. Start scoring.</p>
          <h1 className="kit-title">
            Score your next match <HandUnderline>on your phone</HandUnderline>.
          </h1>
          <p className="kit-sub">
            No account needed. Your score saves on this phone, even offline.
          </p>
          <div className="kit-landing-actions">
            <Link className="se-go" to={startPath} onClick={markAppEntered}>
              {`Start ${selected.name}`} <GoArrow />
            </Link>
            <Link className="se-ctl" to="/login" onClick={markAppEntered}>Sign in</Link>
          </div>
        </header>

        <section className="kit-landing-example" aria-labelledby="landing-example-title">
          <KitSection id="landing-example-title" title="See a match being scored" />
          <SportPicker selectedId={selectedId} onSelect={id => { setSelectedId(id); setPoints([]); setTouched(false); setRevision(0); }} />
          <ExampleCard demo={demo} onPoint={team => { setTouched(true); setRevision(value => value + 1); setPoints(previous => [...previous, team]); }} touched={touched} revision={revision} onUndo={() => setPoints(previous => previous.slice(0, -1))} canUndo={points.length > 0} />


          <Link className="se-ctl" to={cloudAuthAvailable ? '/signup' : 'https://scoreeasy.app/signup'} onClick={markAppEntered}>Create a free account</Link>
        </section>
      </div>



      <section className="home-faq" aria-labelledby="landing-faq-title">
        <h2 id="landing-faq-title">Questions</h2>
        {LANDING_FAQ.map(item => (
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

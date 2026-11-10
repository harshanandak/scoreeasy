import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { markAppEntered } from '../../../utils/appEntry';
import { getSportById, getSportsList } from '../../../models/sportRegistry';
import { deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import { sportIdentity, sportIdentityVars } from '../../../lib/sportIdentity';
import { FilterChip, GoArrow, HandUnderline, KitSection, KitTop, KitWash } from '../kit/KitParts';
import '../kit/history.css';
import './landing.css';
import { buildDemo } from './landingDemo';
import { LANDING_FAQ } from './landingFaq';

/* Home (/). One screen of pitch: a headline, one sentence, Start and Sign in, and a scoreboard you
   can tap. The sport tabs sit on the scoreboard and the Start button always names the chosen tab.
   Every number on the board comes from the sport's own engine (landingDemo.js). */

const sports = getSportsList();

/* Three things a scorer gets that the board above them shows or implies. Each is true of the app:
   points are tapped, every tap can be undone, and a signed-in scorer can share a live link. */
const BOARD_HINTS = ['Tap a team to score', 'Undo any tap', 'Share it live'];

function sportPlayPath(sportId) {
  return sportId ? `/play?sport=${sportId}` : '/play';
}

const FOOTER_LINKS = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Contact', to: '/contact' },
];

/* The example scoreboard, a TV score bug: sport tabs on top, the two sides split down the middle
   with big numbers and a vs on the seam, one status line, then the hints and Undo. Each side is a
   button that scores for that team; the board stops at the result. */
function ScoreBoard({ demo, selectedId, onSelect, onPoint, onUndo, canUndo, revision }) {
  const colours = teamColourVars(deriveTeamColours(...demo.colours));
  const [teamA, teamB] = demo.teams;
  const hasSuffix = demo.teams.some((row) => row.suffix);
  const label = `${teamA.name} ${teamA.score}${teamA.suffix ?? ''}, ${teamB.name} ${teamB.score}${teamB.suffix ?? ''}. ${demo.context}`;
  const side = (key, row) => (
    <button
      type="button"
      className={`home-bug-side home-bug-side-${key}`}
      onClick={() => onPoint(key === 'a' ? 'A' : 'B')}
      // Cricket: India's innings is over, so only Australia (batting) can score.
      disabled={demo.over || (demo.sportId === 'cricket' && key === 'a')}
      aria-label={`Score for ${row.name}`}
    >
      <span className="home-bug-name">{row.name}</span>
      <span key={revision} className={`home-bug-num${revision > 0 ? ' home-score-bump' : ''}`}>
        {row.score}
        {row.suffix && <small>{row.suffix}</small>}
      </span>
      {row.meta && <span className="home-bug-meta">{row.meta}</span>}
    </button>
  );

  return (
    <div className={`home-bug${hasSuffix ? ' has-suffix' : ''}`} style={colours} data-testid="landing-example">
      <div className="home-bug-tabs" role="group" aria-label="Pick a sport">
        {sports.map((sport) => (
          <FilterChip
            key={sport.id}
            label={sport.name}
            sportId={sport.id}
            pressed={sport.id === selectedId}
            onClick={() => onSelect(sport.id)}
          />
        ))}
      </div>
      <div className="home-bug-fields" role="group" aria-label={label}>
        {side('a', teamA)}
        {side('b', teamB)}
        <span className="home-bug-vs" aria-hidden="true">vs</span>
      </div>
      <p className="home-bug-status" aria-live="polite">{demo.context}</p>
      <div className="home-bug-foot">
        <ul className="home-bug-hints">
          {BOARD_HINTS.map((hint) => <li key={hint}>{hint}</li>)}
        </ul>
        <button type="button" className="se-ctl home-undo" onClick={onUndo} disabled={!canUndo}>Undo</button>
      </div>
    </div>
  );
}

ScoreBoard.propTypes = {
  selectedId: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
  onPoint: PropTypes.func.isRequired,
  onUndo: PropTypes.func.isRequired,
  canUndo: PropTypes.bool.isRequired,
  revision: PropTypes.number.isRequired,
  demo: PropTypes.shape({
    over: PropTypes.bool,
    sportId: PropTypes.string.isRequired,
    colours: PropTypes.arrayOf(PropTypes.string).isRequired,
    context: PropTypes.string.isRequired,
    teams: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string.isRequired,
      score: PropTypes.string.isRequired,
      suffix: PropTypes.string,
      meta: PropTypes.string,
    })).isRequired,
  }).isRequired,
};

export default function GuestLanding() {
  const { cloudAuthAvailable } = useAuth();
  const [selectedId, setSelectedId] = useState(sports[0].id);
  const selected = getSportById(selectedId);
  const [revision, setRevision] = useState(0);
  const [points, setPoints] = useState([]);
  const demo = useMemo(() => buildDemo(selectedId, points), [selectedId, points]);
  const nextSport = sports[(sports.findIndex((sport) => sport.id === selectedId) + 1) % sports.length];

  const pickSport = (id) => {
    setSelectedId(id);
    setPoints([]);
    setRevision(0);
  };
  const scorePoint = (team) => {
    if (demo.over) return;
    setRevision((value) => value + 1);
    setPoints((previous) => [...previous, team]);
  };

  return (
    <div className="kit-screen kit-landing" data-screen="guest-landing" style={sportIdentityVars(selectedId)}>
      <KitWash from={sportIdentity(selectedId)?.tint} to={sportIdentity(nextSport.id)?.tint} />
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
            <Link className="se-go" to={sportPlayPath(selectedId)} onClick={markAppEntered}>
              {`Start ${selected.name}`} <GoArrow />
            </Link>
            <Link className="se-ctl" to="/login">Sign in</Link>
          </div>
        </header>

        <section className="kit-landing-example" aria-labelledby="landing-example-title">
          <KitSection id="landing-example-title" title="See a match being scored" />
          <ScoreBoard
            demo={demo}
            selectedId={selectedId}
            onSelect={pickSport}
            onPoint={scorePoint}
            onUndo={() => setPoints((previous) => previous.slice(0, -1))}
            canUndo={points.length > 0}
            revision={revision}
          />
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

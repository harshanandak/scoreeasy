import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { getSportById, getSportsList } from '../../../models/sportRegistry';
import { deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import { sportIdentity, sportIdentityVars } from '../../../lib/sportIdentity';
import { GoArrow, HandUnderline, KitSection, KitTop, KitWash, SportBadge } from '../kit/KitParts';
import '../kit/history.css';
import './landing.css';
import { buildDemo } from './landingDemo';
import { LANDING_FAQ } from './landingFaq';
import { ICON_BY_SPORT_ID } from './sportIcons';

/* The guest landing (/marketing), in the Kit look of Home, Play and the boards. Above the fold it is
   an app: one primary action (start a match), sign in secondary, and a match scored by the real
   engines. Below it, it explains the product in the numbered voice of the original marketing page
   (01 / FEATURES ... 03 / FAQ). The sport the scorer picks is held once, so the picker, the example
   card and the Start buttons always name the same game. Every claim here is true of the shipped app:
   guest scoring and tournaments are open to guests, scoring is saved on the device first; saving to
   an account and the live link need a sign in. The hero sub-line carries the no-account, offline and
   sport-list facts once; the FAQ answers (landingFaq.js) are also in index.html as JSON-LD. */

const PRODUCTION_SIGNUP_URL = 'https://scoreeasy.app/signup';
const sports = getSportsList();

function sportPlayPath(sportId) {
  return sportId ? `/play?sport=${sportId}` : '/play';
}

/* Hand-drawn 24px glyphs, one per feature. `sportId` only tints the badge with that sport's engine-gated
   identity, so the five rows are not one flat grey. */
const GLYPHS = {
  rules: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></>,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.7l6.8-4.4M8.6 13.3l6.8 4.4" /></>,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 010 12h-3" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 01-8 0V4z" /><path d="M8 6H4v1a4 4 0 004 4M16 6h4v1a4 4 0 01-4 4M12 13v4M8 20h8" /></>,
};

const FEATURES = [
  { glyph: 'rules', sportId: 'cricket', title: 'Each sport’s own rules', desc: 'Deuce, sets, overs and raids follow the real game.' },
  { glyph: 'undo', sportId: 'badminton', title: 'Undo that follows', desc: 'Undo takes a point back, with the score, serve and set.' },
  { glyph: 'trophy', sportId: 'hockey', title: 'Tournaments', desc: 'Round-robin and knockout brackets with standings.' },
  { glyph: 'share', sportId: 'football', title: 'Live share link', desc: 'Signed in, send a link so friends follow the score.' },
  { glyph: 'account', sportId: 'tennis', title: 'Saved to your account', desc: 'Sign in to keep every finished match.' },
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

function Glyph({ name }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {GLYPHS[name]}
    </svg>
  );
}

Glyph.propTypes = { name: PropTypes.string.isRequired };

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

/* One half of the board: the team's name over its one big number, on the team's own colour. A sport
   with a suffix (cricket wickets, "/5") sets it small beside the number. */
function ScoreField({ team, side }) {
  return (
    <div className={`kit-score-field kit-score-field-${side}`}>
      <span className="kit-score-name">{team.name}</span>
      <span className="kit-score-num">
        {team.score}
        {team.suffix && <small>{team.suffix}</small>}
      </span>
    </div>
  );
}

ScoreField.propTypes = {
  team: PropTypes.shape({
    name: PropTypes.string.isRequired,
    score: PropTypes.string.isRequired,
    suffix: PropTypes.string,
  }).isRequired,
  side: PropTypes.oneOf(['a', 'b']).isRequired,
};

/* The example scorecard, a split board: a LIVE dot, the sport's icon and name, the two teams on their
   own colour halves with a VS badge on the seam, and one line of context (the chase, the set count,
   the half-time score). Every number and the context line come from the sport's engine
   (landingDemo.js); this only lays them out. */
function ScoreCard({ demo }) {
  const sport = getSportById(demo.sportId);
  const Icon = ICON_BY_SPORT_ID[sport.id];
  const vars = { ...sportIdentityVars(sport.id), ...teamColourVars(deriveTeamColours(...demo.colours)) };
  const [teamA, teamB] = demo.teams;
  const hasSuffix = demo.teams.some((team) => team.suffix);
  const label = `${teamA.name} ${teamA.score}${teamA.suffix ?? ''}, ${teamB.name} ${teamB.score}${teamB.suffix ?? ''}. ${demo.context}`;

  return (
    <article className={`kit-score${hasSuffix ? ' has-suffix' : ''}`} style={vars} data-testid="landing-example" aria-label={label}>
      <header className="kit-score-top">
        <span className="kit-score-live"><i className="kit-score-dot" aria-hidden="true" />LIVE</span>
        <span className="kit-score-sport">
          <span className="kit-score-glyph" aria-hidden="true">
            {Icon && <Icon size={20} color="currentColor" strokeWidth={2} />}
          </span>
          {sport.name}
        </span>
      </header>
      <div className="kit-score-fields">
        <ScoreField team={teamA} side="a" />
        <ScoreField team={teamB} side="b" />
        <span className="kit-score-vs" aria-hidden="true">VS</span>
      </div>
      <p className="kit-score-context">{demo.context}</p>
    </article>
  );
}

ScoreCard.propTypes = {
  demo: PropTypes.shape({
    sportId: PropTypes.string.isRequired,
    colours: PropTypes.arrayOf(PropTypes.string).isRequired,
    context: PropTypes.string.isRequired,
    teams: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string.isRequired,
      score: PropTypes.string.isRequired,
      suffix: PropTypes.string,
    })).isRequired,
  }).isRequired,
};

export default function GuestLanding() {
  const { cloudAuthAvailable } = useAuth();
  const [selectedId, setSelectedId] = useState(sports[0].id);
  const selected = getSportById(selectedId);
  const demo = useMemo(() => buildDemo(selectedId), [selectedId]);
  const nextSport = sports[(sports.findIndex((sport) => sport.id === selectedId) + 1) % sports.length];
  const startPath = sportPlayPath(selectedId);
  const signupPath = cloudAuthAvailable ? '/signup' : PRODUCTION_SIGNUP_URL;

  return (
    <div className="kit-screen kit-landing" data-screen="guest-landing" style={sportIdentityVars(selectedId)}>
      <KitWash from={sportIdentity(selectedId)?.tint} to={sportIdentity(nextSport.id)?.tint} />
      <KitTop title="Score Easy" />

      <div className="kit-landing-top">
        <header className="kit-landing-hero">
          <p className="kit-landing-eyebrow">Scoreboard app for local matches</p>
          <h1 className="kit-title">
            Free live scoreboard app, <HandUnderline>on your phone</HandUnderline>.
          </h1>
          <p className="kit-sub">
            Score cricket, kabaddi, volleyball, badminton, football, basketball, tennis, table tennis and hockey. No account needed, and it keeps working offline.
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
          <SportPicker selectedId={selectedId} onSelect={setSelectedId} />
          <ScoreCard demo={demo} />
          <p className="kit-landing-note">
            An example match, scored by the same rules the app uses for each sport. Tap Start to score your own.
          </p>
        </section>
      </div>

      <section aria-labelledby="landing-features-title">
        <Head id="landing-features-title" eyebrow="01 / Features">What it does.</Head>
        <ul className="kit-list kit-landing-featlist">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="kit-row">
              <span className="kit-badge" style={sportIdentityVars(feature.sportId)} aria-hidden="true">
                <Glyph name={feature.glyph} />
              </span>
              <div className="kit-row-text">
                <h3 className="kit-row-title">{feature.title}</h3>
                <p className="kit-row-sub">{feature.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="landing-how-title">
        <Head id="landing-how-title" eyebrow="02 / How it works">Score a match in three steps.</Head>
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

      <section aria-labelledby="landing-faq-title">
        <Head id="landing-faq-title" eyebrow="03 / FAQ">Questions people ask.</Head>
        <ul className="kit-list kit-landing-faq">
          {LANDING_FAQ.map((item) => (
            <li key={item.question} className="kit-row">
              <div className="kit-row-text">
                <h3 className="kit-row-title">{item.question}</h3>
                <p className="kit-row-sub">{item.answer}</p>
              </div>
            </li>
          ))}
        </ul>
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

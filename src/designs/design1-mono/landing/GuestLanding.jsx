import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { getSportById, getSportsList } from '../../../models/sportRegistry';
import { deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import { sportIdentity, sportIdentityVars } from '../../../lib/sportIdentity';
import { GoArrow, HandUnderline, KitSection, KitTop, KitWash, SportBadge, SportTile } from '../kit/KitParts';
import '../kit/history.css';
import './landing.css';
import { buildDemo } from './landingDemo';
import { ICON_BY_SPORT_ID } from './sportIcons';
import useIsMobile from './useIsMobile';

/* The guest landing (/marketing), in the Kit look of Home, Play and the boards. Above the fold it is
   an app: one primary action (start a match), sign in secondary, and a match scored by the real
   engines. Below it, it explains the product in the numbered, confident voice of the original
   marketing page (01 / APP EXPERIENCE ... 04 / HOW IT WORKS). The sport the scorer picks is held
   once, so the picker, the example card, the lead feature and the Start buttons always name the same
   game. Every claim below the fold is true of the shipped app: guest scoring and tournaments are open
   to guests, scoring is saved on the device first; saving to an account and the live link need a
   sign in. Each section has one lead: the example scorecard, the stat band, the sport-coloured
   feature card, the numbered steps. */

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

/* Hand-drawn 24px glyphs, one per feature. `sportId` only tints the tile with that sport's engine-gated
   identity, so the six rows are not one flat grey. */
const GLYPHS = {
  rules: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></>,
  start: <path d="M8 5v14l11-7z" />,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.7l6.8-4.4M8.6 13.3l6.8 4.4" /></>,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 010 12h-3" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 01-8 0V4z" /><path d="M8 6H4v1a4 4 0 004 4M16 6h4v1a4 4 0 01-4 4M12 13v4M8 20h8" /></>,
};

const LEAD_FEATURE = {
  glyph: 'rules',
  tag: 'Rules',
  title: 'Real rules, every sport',
  desc: 'Deuce, sets, overs and raids are scored by each sport’s own rules, so the board never disagrees with the game.',
};

const FEATURES = [
  { glyph: 'start', sportId: 'volleyball', tag: 'Start', title: 'No sign-up to start', desc: 'Start a match from your browser or the app without an account. Every point is saved on your phone first, so a weak signal never costs one.' },
  { glyph: 'account', sportId: 'tennis', tag: 'Account', title: 'Save to your account', desc: 'Sign in and every match you finish is saved to your account. Without one, matches stay on this phone.' },
  { glyph: 'share', sportId: 'football', tag: 'Share', title: 'Live share link', desc: 'Signed in, you can go live and send a link so friends follow the score. A match stays private until you share it.' },
  { glyph: 'undo', sportId: 'badminton', tag: 'Undo', title: 'Undo that follows', desc: 'Mis-tapped? Undo takes the point back, and the score, serve and set go back with it.' },
  { glyph: 'trophy', sportId: 'hockey', tag: 'Organize', title: 'Tournaments', desc: 'Round-robin and knockout brackets with standings, scored match by match.' },
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

/* One side of the scorecard: team colour bar, name, who is serving / batting / raiding, the sets,
   periods or point categories the sport keeps, and the number that matters in the team's colour. */
function ScoreRow({ team, side, demo, index, stacked }) {
  const live = demo.live === index;
  const cells = team.cells ?? [];
  return (
    <div className={`kit-score-row kit-score-row-${side}${stacked ? ' is-stacked' : ''}${cells.length === 0 ? ' is-flat' : ''}${live ? ' is-live' : ''}`}>
      <span className="kit-score-bar" aria-hidden="true" />
      <span className="kit-score-id">
        <b className="kit-score-name">{team.name}</b>
        {live && <span className="kit-score-live">{demo.liveLabel}</span>}
        {team.meta && <small className="kit-score-meta">{team.meta}</small>}
        {team.pips && (
          <span className="kit-score-pips" aria-hidden="true">
            {Array.from({ length: team.pips.total }, (_, i) => <i key={i} className={i < team.pips.on ? 'is-on' : undefined} />)}
          </span>
        )}
      </span>
      {cells.length > 0 && (
        <span className="kit-score-cells">
          {cells.map((cell, i) => (
            <span key={demo.columns[i]} className={`kit-score-cell${cell.won ? ' is-won' : ''}${cell.current ? ' is-current' : ''}`}>
              {stacked && <small>{demo.columns[i]}</small>}
              {cell.value}
            </span>
          ))}
        </span>
      )}
      <span className="kit-score-num">{team.score}</span>
    </div>
  );
}

ScoreRow.propTypes = {
  team: PropTypes.shape({
    name: PropTypes.string.isRequired,
    score: PropTypes.string.isRequired,
    meta: PropTypes.string,
    cells: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string.isRequired, won: PropTypes.bool, current: PropTypes.bool })),
    pips: PropTypes.shape({ on: PropTypes.number.isRequired, total: PropTypes.number.isRequired }),
  }).isRequired,
  side: PropTypes.oneOf(['a', 'b']).isRequired,
  demo: PropTypes.shape({ live: PropTypes.number, liveLabel: PropTypes.string, columns: PropTypes.arrayOf(PropTypes.string) }).isRequired,
  index: PropTypes.number.isRequired,
  stacked: PropTypes.bool.isRequired,
};

/* The example scorecard. Every number on it comes from the sport's engine (landingDemo.js); this
   only lays it out: a header in the sport's identity colour, a row per side in the team's colour,
   and a foot line for the situation (chase, set point, break point). Sports with four or more
   columns (hockey periods, kabaddi points) label each cell and put it under the name. */
function ScoreCard({ demo }) {
  const sport = getSportById(demo.sportId);
  const Doodle = ICON_BY_SPORT_ID[sport.id];
  const vars = { ...sportIdentityVars(sport.id), ...teamColourVars(deriveTeamColours(...demo.colours)) };
  const [teamA, teamB] = demo.teams;
  const columns = demo.columns ?? [];
  const stacked = columns.length > 3 || demo.kind === 'kabaddi';
  const label = `${teamA.name} ${teamA.score}, ${teamB.name} ${teamB.score}. ${demo.status}`;

  return (
    <article className="kit-score" style={vars} data-testid="landing-example" data-kind={demo.kind}>
      <header className="kit-score-head">
        <span className="kit-tile-mark" aria-hidden="true" />
        <span className="kit-score-sport">
          {Doodle && <Doodle size={26} color="currentColor" strokeWidth={2} />}
          <b>{sport.name}</b>
        </span>
        <span className="kit-score-status">{demo.status}</span>
      </header>
      <div className="kit-score-body" role="group" aria-label={label}>
        {columns.length > 0 && !stacked && (
          <div className="kit-score-cols" aria-hidden="true">
            <span className="kit-score-cells">
              {columns.map((column) => <span key={column} className="kit-score-cell">{column}</span>)}
            </span>
          </div>
        )}
        <ScoreRow team={teamA} side="a" demo={demo} index={0} stacked={stacked} />
        <ScoreRow team={teamB} side="b" demo={demo} index={1} stacked={stacked} />
      </div>
      <footer className="kit-score-foot">
        {(demo.callout || demo.foot) && (
          <p className="kit-score-line">
            {demo.callout && <b className="kit-score-callout">{demo.callout}</b>}
            {demo.foot}
          </p>
        )}
        <span className="kit-chip">Example match</span>
      </footer>
    </article>
  );
}

ScoreCard.propTypes = {
  demo: PropTypes.shape({
    sportId: PropTypes.string.isRequired,
    kind: PropTypes.string.isRequired,
    colours: PropTypes.arrayOf(PropTypes.string).isRequired,
    status: PropTypes.string.isRequired,
    columns: PropTypes.arrayOf(PropTypes.string),
    callout: PropTypes.string,
    foot: PropTypes.string,
    teams: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string.isRequired,
      score: PropTypes.string.isRequired,
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
    <div className="kit-screen kit-landing" data-screen="guest-landing" style={sportIdentityVars(selectedId)}>
      <KitWash from={sportIdentity(selectedId)?.tint} to={sportIdentity(nextSport.id)?.tint} />
      <KitTop title="Score Easy" />

      <div className="kit-landing-top">
        <header className="kit-landing-hero">
          <p className="kit-landing-eyebrow">Universal score tracker</p>
          <h1 className="kit-title">
            Score any game <HandUnderline>on your phone</HandUnderline>.
          </h1>
          <p className="kit-sub">
            Start in seconds with no account. It works offline, and once you sign in, the matches you score are saved to your account.
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
            Scored by the same rules the app uses for each sport. Tap Start to score your own.
          </p>
        </section>
      </div>

      <section aria-labelledby="landing-experience-title">
        <Head id="landing-experience-title" eyebrow="01 / App experience">Start first. Save later.</Head>
        <ul className="kit-landing-band">
          {EXPERIENCE_STATS.map((stat) => (
            <li key={stat.label}>
              <b>{stat.value}</b>
              <span className="kit-landing-label">{stat.label}</span>
              <p>{stat.detail}</p>
            </li>
          ))}
        </ul>
        <ul className="kit-list kit-landing-notes">
          {EXPERIENCE_NOTES.map((note) => (
            <li key={note} className="kit-row">
              <span className="kit-landing-check" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </span>
              <span className="kit-row-text">
                <span className="kit-row-title">{note}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="landing-features-title">
        <Head id="landing-features-title" eyebrow="02 / Features">Everything you need.</Head>
        <div className="kit-landing-features">
          <article className="kit-landing-lead">
            <span className="kit-tile-mark" aria-hidden="true" />
            <span className="kit-landing-lead-glyph"><Glyph name={LEAD_FEATURE.glyph} /></span>
            <span className="kit-chip">{LEAD_FEATURE.tag}</span>
            <h3>{LEAD_FEATURE.title}</h3>
            <p>{LEAD_FEATURE.desc}</p>
          </article>
          <ul className="kit-list kit-landing-featlist">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="kit-row">
                <span className="kit-badge" style={sportIdentityVars(feature.sportId)} aria-hidden="true">
                  <Glyph name={feature.glyph} />
                </span>
                <div className="kit-row-text">
                  <span className="kit-landing-label">{feature.tag}</span>
                  <h3 className="kit-row-title">{feature.title}</h3>
                  <p className="kit-row-sub">{feature.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
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

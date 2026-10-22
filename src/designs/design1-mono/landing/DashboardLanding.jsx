import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSportTournaments, loadData } from '../../../utils/storage';
import { getActiveSessions } from '../../../utils/universalStorage';
import { getSportsList, getSportById } from '../../../models/sportRegistry';
import { useAuth } from '../../../hooks/useAuth';
import { isTournamentMatchCompleted } from '../../../utils/tournamentSync';
import { deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import { sportIdentity, sportIdentityVars } from '../../../lib/sportIdentity';
import LiveNowStrip from '../live/LiveNowStrip';
import { relativeDay } from '../kit/dates';
import ErrorBoundary from '../../../components/ErrorBoundary';
import { loadInProgressMatches } from '../../../utils/appEntry';
import {
  Chevron, CoachArrow, GoArrow, HandUnderline, KitSection, KitTop, KitWash, SportBadge, SportTile,
} from '../kit/KitParts';

/* Home (Kit, plan 2026-10-22 §9 S1). One hero per screen and one Go: for a returning scorer the
   hero is the last match in its team colours with Rematch as the Go; on first run it is the
   "play your first match" prompt, with a hand-drawn arrow at its Go. Nothing here truncates:
   long names wrap. */

const QM_KEY = 'se_quickmatches';
const DAY_MS = 864e5;
const WEEK_MS = 7 * DAY_MS;
const RECENT_LIMIT = 4;
// Empty-state featured tier: the first few sports in focus order (src/models/sportFocus.js).
const DEFAULT_FEATURED_SPORT_COUNT = 3;

const allSportsList = getSportsList();

function collectTournamentsBySport(sports) {
  const tournaments = [];
  for (const sport of sports) {
    const sportTournaments = loadSportTournaments(sport.storageKey);
    for (const tr of sportTournaments) {
      const allMatches = [...(tr.matches || []), ...(tr.knockoutMatches || [])];
      const completed = allMatches.filter((m) => isTournamentMatchCompleted(m, sport.engine, m.format || tr.format)).length;
      const total = allMatches.length;
      tournaments.push({
        ...tr,
        sportName: sport.name,
        sportId: sport.id,
        completed,
        total,
        isActive: total > 0 && completed < total,
      });
    }
  }
  tournaments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return tournaments;
}

function getSportFromName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  return allSportsList.find((sp) => lower.includes(sp.name.toLowerCase())) || null;
}

const isDrawToken = (winner) => typeof winner === 'string' && ['draw', 'tie'].includes(winner.toLowerCase());

function getWinnerLabel(winner) {
  if (typeof winner === 'string' && winner.toLowerCase() === 'draw') return 'Draw';
  if (typeof winner === 'string' && winner.toLowerCase() === 'tie') return 'Tied';
  return `${winner} won`;
}

/** The two sides' scores as display strings. */
export function scorePair(qm) {
  if (typeof qm.score1 === 'number' && typeof qm.score2 === 'number') return [String(qm.score1), String(qm.score2)];
  if (Array.isArray(qm.innings) && qm.innings.length > 0) {
    const team1Id = qm.team1Id || 'team1';
    const team2Id = qm.team2Id || 'team2';
    const runs = (id) => qm.innings.filter((inn) => inn.teamId === id).reduce((sum, inn) => sum + (inn.runs || 0), 0);
    return [String(runs(team1Id)), String(runs(team2Id))];
  }
  if (qm.team1Score) {
    return [`${qm.team1Score.runs}/${qm.team1Score.wickets}`, `${qm.team2Score?.runs ?? 0}/${qm.team2Score?.wickets ?? 0}`];
  }
  return ['0', '0'];
}

function matchTime(qm) {
  const time = new Date(qm.completedAt || qm.date || qm.createdAt).getTime();
  return Number.isFinite(time) ? time : null;
}

export { relativeDay };

function getDisplayName(user) {
  return user?.username || user?.name || user?.displayName || null;
}

/* Header right: the account avatar when signed in, a Sign in control for a cloud guest. */
function AccountControl({ cloudAuthAvailable, isAuthenticated, user, navigate }) {
  if (!cloudAuthAvailable) return null;
  if (isAuthenticated) {
    const initial = (getDisplayName(user) || '?').trim().charAt(0).toUpperCase();
    return (
      <button type="button" className="kit-avatar" aria-label="Account" onClick={() => navigate('/profile')}>
        <span aria-hidden="true">{initial}</span>
      </button>
    );
  }
  return (
    <button type="button" className="se-ctl" onClick={() => navigate('/login?returnTo=%2Fapp')}>
      Sign in
    </button>
  );
}
AccountControl.propTypes = {
  cloudAuthAvailable: PropTypes.bool.isRequired,
  isAuthenticated: PropTypes.bool.isRequired,
  user: PropTypes.object,
  navigate: PropTypes.func.isRequired,
};

function Greeting({ name, fallback }) {
  return (
    <h1 id="dashboard-welcome-title" className="kit-title">
      {name ? <>Hi <HandUnderline>{name}</HandUnderline>.</> : <HandUnderline>{fallback}</HandUnderline>}
    </h1>
  );
}
Greeting.propTypes = { name: PropTypes.string, fallback: PropTypes.string.isRequired };

/* The last match as one compact card on the normal surface (Harsha 2026-10-22: the full-bleed
   two-gradient hero was too big and heavy). Team identity is a slim bar in each team's engine line
   colour (>= 3:1 on the card) beside its name; the names and scores are ink on the surface. The
   winner is bold. Rematch is the screen's one Go at control size; Details is a control. */
function LastMatchHero({ match, navigate }) {
  const sport = getSportById(match.sport);
  const colours = teamColourVars(deriveTeamColours(match.team1Color, match.team2Color));
  const [score1, score2] = scorePair(match);
  const winnerSide = isDrawToken(match.winner) ? null : match.winner === match.team1 ? 'a' : match.winner === match.team2 ? 'b' : null;
  const completedSets = Array.isArray(match.sets) ? match.sets.filter((set) => set?.completed) : [];
  const when = relativeDay(matchTime(match));
  const result = match.winner ? getWinnerLabel(match.winner) : 'Completed';
  const team = (side, name, score) => (
    <div className={`kit-last-team${winnerSide === side ? ' is-winner' : ''}`}>
      <span className={`kit-last-bar kit-last-bar-${side}`} aria-hidden="true" />
      <span className="kit-last-name">{name}</span>
      <span className="kit-last-score">{score}</span>
    </div>
  );

  return (
    <div className="kit-last" style={colours}>
      <div className="kit-last-meta">
        {sport && (
          <span className="kit-sport-chip" style={sportIdentityVars(sport.id)}>
            <i aria-hidden="true" />{sport.name}
          </span>
        )}
        {when && <span>{when}</span>}
      </div>
      <div className="kit-last-teams" role="group" aria-label={`${match.team1} ${score1}, ${match.team2} ${score2}. ${result}`}>
        {team('a', match.team1, score1)}
        {team('b', match.team2, score2)}
      </div>
      <p className="kit-last-detail">
        {completedSets.length > 0
          ? <>Sets {completedSets.map((set) => `${set.score1}–${set.score2}`).join(' · ')}</>
          : result}
      </p>
      <div className="kit-btnrow">
        {sport && (
          <button
            type="button"
            className="se-go kit-go-compact"
            aria-label={`Rematch: ${match.team1} vs ${match.team2}`}
            onClick={() => navigate(`/${match.sport}/quick`, {
              // The pair the card shows goes with the rematch; quick setup validates it.
              state: { teams: [match.team1, match.team2], colours: [match.team1Color, match.team2Color] },
            })}
          >
            Rematch <GoArrow />
          </button>
        )}
        <button type="button" className="se-ctl" aria-label="Last match details" onClick={() => navigate('/history')}>
          Details
        </button>
      </div>
    </div>
  );
}
LastMatchHero.propTypes = {
  match: PropTypes.shape({
    sport: PropTypes.string,
    team1: PropTypes.string,
    team2: PropTypes.string,
    team1Color: PropTypes.string,
    team2Color: PropTypes.string,
    winner: PropTypes.string,
    sets: PropTypes.array,
  }).isRequired,
  navigate: PropTypes.func.isRequired,
};

function MatchRow({ qm, onOpen }) {
  const sportName = getSportById(qm.sport)?.name || 'Custom';
  const [score1, score2] = scorePair(qm);
  const team1Won = !isDrawToken(qm.winner) && qm.winner === qm.team1;
  const team2Won = !isDrawToken(qm.winner) && qm.winner === qm.team2;
  const when = relativeDay(matchTime(qm));
  return (
    <button type="button" className="kit-row" onClick={onOpen}>
      <SportBadge sportId={qm.sport} />
      <span className="kit-row-text">
        <span className="kit-row-title">
          {team1Won ? <strong>{qm.team1}</strong> : qm.team1} v {team2Won ? <strong>{qm.team2}</strong> : qm.team2}
        </span>
        <span className="kit-row-sub">{[sportName, when].filter(Boolean).join(' · ')}</span>
      </span>
      <span className="kit-row-score">{`${score1}–${score2}`}</span>
      <Chevron />
    </button>
  );
}
MatchRow.propTypes = {
  qm: PropTypes.shape({
    sport: PropTypes.string,
    team1: PropTypes.string,
    team2: PropTypes.string,
    winner: PropTypes.string,
  }).isRequired,
  onOpen: PropTypes.func.isRequired,
};

function QuickStart({ sports, label, navigate }) {
  if (sports.length === 0) return null;
  return (
    <section aria-labelledby="home-quick-start">
      <KitSection id="home-quick-start" title="Quick start" aside={<span>{label}</span>} />
      <div className="kit-grid3">
        {sports.map((sport) => (
          <SportTile key={sport.id} sport={sport} mini onSelect={(sp) => navigate(`/${sp.id}/quick`)} />
        ))}
      </div>
    </section>
  );
}
QuickStart.propTypes = {
  sports: PropTypes.arrayOf(PropTypes.object).isRequired,
  label: PropTypes.string.isRequired,
  navigate: PropTypes.func.isRequired,
};

/* ─── Returning scorer ─── */
function ExistingUserDashboard({
  cloudAuthAvailable,
  isAuthenticated,
  navigate,
  user,
  sessions,
  inProgressMatches,
  allTournaments,
  recentMatches,
  weekCount,
  playedCount,
}) {
  const hasActive = sessions.length > 0;
  const displayName = getDisplayName(user);
  const hero = !hasActive ? recentMatches[0] : null;
  const listed = hero ? recentMatches.slice(1) : recentMatches;
  const heroSport = hero ? getSportById(hero.sport) : null;
  const heroColours = hero ? deriveTeamColours(hero.team1Color, hero.team2Color) : null;

  /* Featured tier: real favourites first; else sports they recently played; else no tier at all. */
  const favoriteIds = user?.favoriteGames || [];
  const favoriteSports = allSportsList.filter((sp) => favoriteIds.includes(sp.id));
  const recentSports = [...new Set(recentMatches.map((qm) => qm.sport).filter(Boolean))]
    .map((id) => getSportById(id))
    .filter(Boolean);
  const featuredSports = (favoriteSports.length > 0 ? favoriteSports : recentSports).slice(0, 6);
  const featuredLabel = favoriteSports.length > 0 ? 'Your favourites' : 'Recently played';

  const scored = weekCount > 0
    ? `${weekCount} ${weekCount === 1 ? 'match' : 'matches'} scored this week`
    : `${playedCount} ${playedCount === 1 ? 'match' : 'matches'} scored so far`;

  return (
    <div className="kit-screen" data-screen="home" style={heroSport ? { '--kit-underline': sportIdentity(heroSport.id)?.line } : undefined}>
      <KitWash from={heroColours?.A.tint ?? sportIdentity('cricket')?.tint} to={heroColours?.B.tint ?? sportIdentity('hockey')?.tint} />
      <KitTop title="Score Easy">
        <AccountControl cloudAuthAvailable={cloudAuthAvailable} isAuthenticated={isAuthenticated} user={user} navigate={navigate} />
      </KitTop>
      <Greeting name={displayName} fallback="Welcome back." />
      <p className="kit-sub">{scored}</p>

      {inProgressMatches.length > 0 && (
        <section aria-labelledby="resume-matches-title">
          <KitSection id="resume-matches-title" title="In progress" />
          <div className="kit-list">
            {inProgressMatches.map((match) => {
              const sportName = getSportById(match.sport)?.name || match.sport;
              const title = match.kind === 'tournament'
                ? match.name || `${sportName} tournament`
                : `${match.team1Name || match.team1 || 'Team A'} v ${match.team2Name || match.team2 || 'Team B'}`;
              return (
                <div key={match.entryPath} className="kit-row">
                  <SportBadge sportId={match.sport} />
                  <span className="kit-row-text">
                    <span className="kit-row-title">{title}</span>
                    <span className="kit-row-sub">{sportName} · {match.kind === 'tournament' ? 'Tournament' : 'Quick match'}</span>
                  </span>
                  <button type="button" className="se-ctl" aria-label={`Resume ${sportName}: ${title}`} onClick={() => navigate(match.entryPath)}>
                    Resume
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {hasActive && (
        <section aria-labelledby="active-sessions-title">
          <KitSection id="active-sessions-title" title="Active" />
          <div className="kit-list">
            {sessions.map((session) => {
              const sport = getSportFromName(session.name);
              const scores = session.participants.map((p) => session.scores?.[p.id]?.total ?? 0);
              const paused = session.status === 'paused';
              return (
                <button key={session.id} type="button" className="kit-row" onClick={() => navigate(`/game/${session.id}`)}>
                  <SportBadge sportId={sport?.id} />
                  <span className="kit-row-text">
                    <span className="kit-row-title">{session.name}</span>
                    <span className="kit-row-sub">{session.participants.map((p) => p.name).join(' v ')}</span>
                  </span>
                  <span className={`kit-chip${paused ? '' : ' is-live'}`}>{paused ? 'Paused' : 'Live'}</span>
                  <span className="kit-row-score">{scores.join('–')}</span>
                  <Chevron />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {hero && (
        <section aria-labelledby="last-match-title">
          <KitSection id="last-match-title" title="Last match" />
          <LastMatchHero match={hero} navigate={navigate} />
        </section>
      )}

      <QuickStart sports={featuredSports} label={featuredLabel} navigate={navigate} />

      {listed.length > 0 && (
        <section aria-labelledby="recent-title">
          <KitSection
            id="recent-title"
            title="Recent"
            aside={<button type="button" className="kit-link" onClick={() => navigate('/history')}>See all</button>}
          />
          <div className="kit-list">
            {listed.map((qm) => <MatchRow key={qm.id} qm={qm} onOpen={() => navigate('/history')} />)}
          </div>
        </section>
      )}

      {allTournaments.length > 0 && (
        <section aria-labelledby="tournaments-title">
          <KitSection id="tournaments-title" title="Tournaments" />
          <div className="kit-list">
            {allTournaments.slice(0, 4).map((tr) => (
              <button key={tr.id} type="button" className="kit-row" onClick={() => navigate(`/${tr.sportId}/tournament/${tr.id}`)}>
                <SportBadge sportId={tr.sportId} />
                <span className="kit-row-text">
                  <span className="kit-row-title">{tr.name}</span>
                  <span className="kit-row-sub">{tr.teams?.length || 0} teams · {tr.sportName}</span>
                </span>
                <span className="kit-chip">{tr.isActive ? `${tr.completed}/${tr.total}` : 'Done'}</span>
                <Chevron />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

ExistingUserDashboard.propTypes = {
  inProgressMatches: PropTypes.arrayOf(PropTypes.object).isRequired,
  cloudAuthAvailable: PropTypes.bool.isRequired,
  isAuthenticated: PropTypes.bool.isRequired,
  navigate: PropTypes.func.isRequired,
  user: PropTypes.shape({
    favoriteGames: PropTypes.arrayOf(PropTypes.string),
    username: PropTypes.string,
    name: PropTypes.string,
    displayName: PropTypes.string,
  }),
  sessions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    name: PropTypes.string.isRequired,
    status: PropTypes.string,
    participants: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      name: PropTypes.string,
    })),
    scores: PropTypes.object,
  })).isRequired,
  allTournaments: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    name: PropTypes.string,
    sportId: PropTypes.string,
    sportName: PropTypes.string,
    teams: PropTypes.array,
    completed: PropTypes.number,
    total: PropTypes.number,
    isActive: PropTypes.bool,
  })).isRequired,
  recentMatches: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    sport: PropTypes.string,
    team1: PropTypes.string,
    team2: PropTypes.string,
    winner: PropTypes.string,
  })).isRequired,
  weekCount: PropTypes.number.isRequired,
  playedCount: PropTypes.number.isRequired,
};

/* ─── First run (zero saved data) ───
   The hero is the prompt to play; its Go is the screen's only Go, and a hand-drawn arrow points
   at it. The arrow exists only here, so it is gone once anything has been scored. */
const GET_STARTED_STEPS = [
  { label: 'Play a match', sub: 'Pick a sport and start scoring' },
  { label: 'Save the result', sub: 'Finish to log it automatically' },
  { label: 'See your stats', sub: 'Track wins, streaks, and history' },
];

function EmptyDashboard({ navigate, cloudAuthAvailable, isAuthenticated, user }) {
  const displayName = getDisplayName(user);

  /* Featured tier: real favourites first; else the first sports in focus order. */
  const favoriteIds = user?.favoriteGames || [];
  const favoriteSports = allSportsList.filter((sp) => favoriteIds.includes(sp.id));
  const featuredSports = (favoriteSports.length > 0 ? favoriteSports : allSportsList.slice(0, DEFAULT_FEATURED_SPORT_COUNT)).slice(0, 6);
  const featuredLabel = favoriteSports.length > 0 ? 'Your favourites' : 'Popular';

  return (
    <div className="kit-screen" data-screen="home-first-run">
      <KitWash from={sportIdentity('cricket')?.tint} to={sportIdentity('hockey')?.tint} />
      <KitTop title="Score Easy">
        <AccountControl cloudAuthAvailable={cloudAuthAvailable} isAuthenticated={isAuthenticated} user={user} navigate={navigate} />
      </KitTop>
      <Greeting name={displayName} fallback="Welcome." />
      <p className="kit-sub">Your scoreboard for any game</p>

      <section aria-labelledby="first-match-title" style={{ marginTop: 26 }}>
        <div className="kit-hero">
          <div className="kit-hero-intro">
            <h2 id="first-match-title">Play your first match.</h2>
            <p>Pick a sport and you are scoring in seconds.</p>
          </div>
          <div className="kit-hero-foot">
            <CoachArrow />
            <button type="button" className="se-go" aria-label="Play your first match" onClick={() => navigate('/play')}>
              Start playing <GoArrow />
            </button>
          </div>
        </div>
      </section>

      <QuickStart sports={featuredSports} label={featuredLabel} navigate={navigate} />

      <section aria-labelledby="get-started-title">
        <KitSection id="get-started-title" title="Get started" />
        <ol className="kit-list kit-steps">
          {GET_STARTED_STEPS.map((step, i) => (
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

      <section aria-labelledby="recent-empty-title">
        <KitSection id="recent-empty-title" title="Recent" />
        <div className="kit-list">
          <p className="kit-empty-note">Your matches will appear here</p>
        </div>
      </section>
    </div>
  );
}

EmptyDashboard.propTypes = {
  navigate: PropTypes.func.isRequired,
  cloudAuthAvailable: PropTypes.bool.isRequired,
  isAuthenticated: PropTypes.bool.isRequired,
  user: PropTypes.shape({
    favoriteGames: PropTypes.arrayOf(PropTypes.string),
    username: PropTypes.string,
    name: PropTypes.string,
    displayName: PropTypes.string,
  }),
};

/* Read every persisted slice the dashboard needs in one synchronous pass.
   Called from lazy useState initializers so the first paint already has real
   data — no empty→populated flash from a post-mount effect. The underlying
   storage helpers swallow corrupt JSON and return their defaults, so this stays
   safe to run during render. */
function readDashboardState() {
  const sessions = getActiveSessions();
  const allTournaments = collectTournamentsBySport(getSportsList());

  const savedMatches = loadData(QM_KEY, []);
  const qm = Array.isArray(savedMatches) ? savedMatches.filter((match) => match?.status !== 'in-progress') : [];
  qm.sort((a, b) => (matchTime(b) ?? 0) - (matchTime(a) ?? 0));
  const now = Date.now();

  return {
    sessions,
    inProgressMatches: loadInProgressMatches(),
    allTournaments,
    playedCount: qm.length,
    weekCount: qm.filter((match) => { const t = matchTime(match); return t !== null && now - t < WEEK_MS; }).length,
    recentMatches: qm.slice(0, RECENT_LIMIT),
  };
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */
export default function DashboardLanding() {
  const navigate = useNavigate();
  const { cloudAuthAvailable, isAuthenticated, user } = useAuth();
  const [visible, setVisible] = useState(false);
  /* Lazy initializer: read every localStorage slice once, synchronously, before
     first paint — so the dashboard never flashes empty then re-renders populated. */
  const [{ sessions, inProgressMatches, allTournaments, recentMatches, playedCount, weekCount }] = useState(readDashboardState);

  useEffect(() => {
    /* Mount-only fade-in trigger; data is already loaded via lazy init above. */
    requestAnimationFrame(() => setVisible(true));
  }, []);

  /* Zero data = no tournaments AND no quick matches AND no active sessions. */
  const hasNoData = inProgressMatches.length === 0 && allTournaments.length === 0 && recentMatches.length === 0 && sessions.length === 0;
  return (
    <div
      style={{ background: 'var(--se-color-canvas)', color: 'var(--se-color-ink)', minHeight: '100vh' }}
      className={`mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}
    >
      {/* Public "live now" discovery rail (scoreeasy-3ws) — renders nothing when
          nothing is live. Isolated in an ErrorBoundary with a SILENT fallback so a
          backend hiccup (e.g. listLiveFeed not yet deployed during a rollout)
          degrades to "no strip" instead of crashing the whole home. */}
      <ErrorBoundary fallback={null} captureToSentry={false}>
        <LiveNowStrip />
      </ErrorBoundary>

      {hasNoData ? (
        <EmptyDashboard
          navigate={navigate}
          cloudAuthAvailable={Boolean(cloudAuthAvailable)}
          isAuthenticated={Boolean(isAuthenticated)}
          user={user}
        />
      ) : (
        <ExistingUserDashboard
          cloudAuthAvailable={Boolean(cloudAuthAvailable)}
          isAuthenticated={Boolean(isAuthenticated)}
          navigate={navigate}
          user={user}
          sessions={sessions}
          inProgressMatches={inProgressMatches}
          allTournaments={allTournaments}
          recentMatches={recentMatches}
          weekCount={weekCount}
          playedCount={playedCount}
        />
      )}
    </div>
  );
}

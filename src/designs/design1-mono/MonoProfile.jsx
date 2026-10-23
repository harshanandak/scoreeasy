import PropTypes from "prop-types";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DEFAULT_GUEST_SCORING_PATH } from "../../utils/authRedirect";
import { useAuth } from "../../hooks/useAuth";
import { getSportById } from "../../models/sportRegistry";
import { sportIdentity, sportIdentityVars } from "../../lib/sportIdentity";
import { GoArrow, KitSection, KitTop, KitWash, SportBadge } from "./kit/KitParts";
import { winnerSide } from "./kit/historyModel";
import "./kit/history.css";

/* Profile (Kit, plan 2026-10-22 §9 S4, prototype `profile`): the avatar in a ring split by the
   sports played (engine identity colours), the name, a pure-type stat line, the per-sport list
   with bars, and recent matches as Kit rows. Every number comes straight from the Convex stats. */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function roleLabel(stats) {
  const played = stats?.totalMatches > 0;
  const scored = stats?.gamesOperated > 0;
  if (played && scored) return "Player and scorer";
  if (scored) return "Scorer";
  if (played) return "Player";
  return null;
}

function joinedLabel(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return `Joined ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDate(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function sportName(id) {
  return getSportById(id)?.name || (id ? id.charAt(0).toUpperCase() + id.slice(1) : "Custom");
}

/** The ring: one arc per sport, sized by matches played, in each sport's engine core colour. */
function ringBackground(rows) {
  const total = rows.reduce((sum, row) => sum + row.played, 0);
  if (total === 0) return undefined;
  let acc = 0;
  const stops = rows.map((row) => {
    const from = (acc / total) * 360;
    acc += row.played;
    const colour = sportIdentity(row.id)?.core ?? "var(--se-color-ink-soft)";
    return `${colour} ${from.toFixed(1)}deg ${((acc / total) * 360).toFixed(1)}deg`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function KitPage({ title, children, action }) {
  return (
    <div className="kit-screen" data-screen="profile">
      <KitWash from={sportIdentity("cricket")?.tint} to={sportIdentity("kabaddi")?.tint} />
      <KitTop title={title}>{action}</KitTop>
      {children}
    </div>
  );
}
KitPage.propTypes = { title: PropTypes.string.isRequired, children: PropTypes.node, action: PropTypes.node };

function BackControl({ onBack }) {
  return (
    <button type="button" className="se-ctl" onClick={onBack}>
      Back
    </button>
  );
}
BackControl.propTypes = { onBack: PropTypes.func.isRequired };

function LoadingState({ onBack }) {
  return (
    <KitPage title="Profile" action={onBack ? <BackControl onBack={onBack} /> : null}>
      <p className="kit-note" role="status">Loading profile...</p>
    </KitPage>
  );
}
LoadingState.propTypes = { onBack: PropTypes.func };

function RecoveryActions({ cloudAuthAvailable, message, onBack, onNavigate, title }) {
  return (
    <KitPage title="Profile" action={onBack ? <BackControl onBack={onBack} /> : null}>
      <section className="kit-card kit-recovery" aria-labelledby="profile-recovery-title" style={{ marginTop: 6 }}>
        <h1 id="profile-recovery-title">{title}</h1>
        <p>{message}</p>
        <div className="kit-btnstack">
          {cloudAuthAvailable && (
            <button type="button" className="se-go" onClick={() => onNavigate("/login?returnTo=%2Fprofile")}>
              Sign in to sync profile <GoArrow />
            </button>
          )}
          <button
            type="button"
            className={cloudAuthAvailable ? "se-ctl" : "se-go"}
            onClick={() => onNavigate(DEFAULT_GUEST_SCORING_PATH)}
          >
            Start guest match
          </button>
          <button type="button" className="se-ctl" onClick={() => onNavigate("/users/search")}>
            Find players
          </button>
        </div>
      </section>
    </KitPage>
  );
}

RecoveryActions.propTypes = {
  cloudAuthAvailable: PropTypes.bool.isRequired,
  message: PropTypes.string.isRequired,
  onBack: PropTypes.func,
  onNavigate: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
};

function RecentRow({ match }) {
  const side = winnerSide(match);
  const sub = [sportName(match.sport), formatDate(match.date), match.matchRole === "refereeing" ? "scored" : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="kit-row">
      <SportBadge sportId={match.sport} />
      <span className="kit-row-text">
        <span className="kit-row-title">
          {side === "a" ? <strong>{match.team1}</strong> : match.team1} v {side === "b" ? <strong>{match.team2}</strong> : match.team2}
        </span>
        <span className="kit-row-sub">{sub}</span>
      </span>
      <span className="kit-row-score">{`${match.score1}–${match.score2}`}</span>
    </div>
  );
}
RecentRow.propTypes = {
  match: PropTypes.shape({
    sport: PropTypes.string,
    team1: PropTypes.string,
    team2: PropTypes.string,
    winner: PropTypes.string,
    score1: PropTypes.number,
    score2: PropTypes.number,
    date: PropTypes.number,
    matchRole: PropTypes.string,
  }).isRequired,
};

export default function MonoProfile() {
  const navigate = useNavigate();
  const { username: paramUsername } = useParams();
  const {
    user: currentUser,
    isAuthenticated,
    isLoading: authLoading,
    isUserReady,
    cloudAuthAvailable,
  } = useAuth();

  const isOwnProfile = !paramUsername || paramUsername === currentUser?.username;
  const profileUsername = paramUsername || currentUser?.username || null;
  const profileUser = useQuery(
    api.users.getByUsername,
    paramUsername ? { username: paramUsername } : "skip"
  );
  const stats = useQuery(
    api.matches.getPublicUserStatsByUsername,
    profileUsername ? { username: profileUsername } : "skip"
  );
  const recentMatches = useQuery(
    api.matches.getPublicRecentByUsername,
    profileUsername ? { username: profileUsername } : "skip"
  );

  const displayUser = isOwnProfile ? currentUser : profileUser;
  const goBack = paramUsername ? () => navigate(-1) : null;

  if (!paramUsername && (authLoading || (isAuthenticated && !isUserReady))) {
    return <LoadingState />;
  }

  if (!paramUsername && !displayUser && !isAuthenticated) {
    return (
      <KitPage title="Profile">
        <section className="kit-card kit-recovery" aria-labelledby="guest-profile-title" style={{ marginTop: 6 }}>
          <h1 id="guest-profile-title">Your profile, when you’re ready</h1>
          <p>Sign in to sync your profile and find other players. You can keep scoring on this device without an account.</p>
          <div className="kit-btnstack">
            {cloudAuthAvailable && (
              <button type="button" className="se-go" onClick={() => navigate("/login?returnTo=%2Fprofile")}>
                Sign in <GoArrow />
              </button>
            )}
            <button type="button" className="se-ctl" onClick={() => navigate(DEFAULT_GUEST_SCORING_PATH)}>
              Keep scoring as a guest
            </button>
          </div>
        </section>
      </KitPage>
    );
  }

  if (paramUsername && profileUser === undefined) {
    return <LoadingState onBack={goBack} />;
  }

  if (paramUsername && profileUser === null) {
    return (
      <RecoveryActions
        cloudAuthAvailable={cloudAuthAvailable}
        message={`User @${paramUsername} not found.`}
        onBack={goBack}
        onNavigate={navigate}
        title="Profile not found"
      />
    );
  }

  const username = displayUser?.username || null;
  const name = displayUser?.displayName || (username ? `@${username}` : "...");
  const initial = (displayUser?.displayName || username || "?").trim().charAt(0).toUpperCase();
  const sub = [
    displayUser?.displayName && username ? `@${username}` : null,
    roleLabel(stats),
    displayUser?.createdAt ? joinedLabel(displayUser.createdAt) : null,
  ].filter(Boolean).join(" · ");

  const sportRows = Object.entries(stats?.sportBreakdown || {})
    .map(([id, s]) => ({ id, played: s.played, wins: s.wins }))
    .sort((a, b) => b.played - a.played);
  const maxPlayed = sportRows[0]?.played || 0;

  const statItems = [
    ["matches", stats?.totalMatches ?? "-"],
    ["wins", stats?.wins ?? "-"],
    ["win rate", stats?.winRate == null ? "-" : `${stats.winRate}%`],
    ...(stats?.gamesOperated > 0 ? [["scored", stats.gamesOperated]] : []),
  ];

  return (
    <KitPage title="Profile" action={goBack ? <BackControl onBack={goBack} /> : null}>
      <section className="kit-prof" aria-labelledby="profile-name">
        <div className="kit-ring" style={{ "--kit-ring": ringBackground(sportRows) }}>
          {displayUser?.avatarUrl ? <img src={displayUser.avatarUrl} alt="" /> : <span aria-hidden="true">{initial}</span>}
        </div>
        <h1 id="profile-name">{name}</h1>
        {sub && <p className="kit-sub">{sub}</p>}
      </section>

      <ul className="kit-statline" aria-label="Stats" style={{ "--kit-stat-cols": statItems.length }}>
        {statItems.map(([label, value]) => (
          <li key={label}>
            <b>{value}</b>
            <span>{label}</span>
          </li>
        ))}
      </ul>

      {sportRows.length > 0 && (
        <section aria-labelledby="profile-sports">
          <KitSection id="profile-sports" title="Sports" aside={<span>by matches</span>} />
          <div className="kit-list">
            {sportRows.map((row) => {
              const pct = row.played > 0 ? Math.round((row.wins / row.played) * 100) : 0;
              return (
                <div
                  key={row.id}
                  className="kit-brow"
                  style={{ ...sportIdentityVars(row.id), "--kit-p": `${maxPlayed ? Math.round((row.played / maxPlayed) * 100) : 0}%` }}
                >
                  <SportBadge sportId={row.id} />
                  <div style={{ minWidth: 0 }}>
                    <div className="kit-brow-name">{sportName(row.id)}</div>
                    <div className="kit-brow-track" aria-hidden="true"><i /></div>
                    <div className="kit-brow-sub">{`${row.wins} W · ${row.played - row.wins} L · ${pct}%`}</div>
                  </div>
                  <span className="kit-brow-count" aria-label={`${row.played} played`}>{row.played}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {recentMatches && recentMatches.length > 0 && (
        <section aria-labelledby="profile-recent">
          <KitSection id="profile-recent" title="Recent matches" />
          <div className="kit-list">
            {recentMatches.map((m) => <RecentRow key={m._id} match={m} />)}
          </div>
        </section>
      )}

      <div className="kit-btnstack" style={{ marginTop: 20 }}>
        <Link to="/users/search" className="se-ctl">
          Find players
        </Link>
      </div>
    </KitPage>
  );
}

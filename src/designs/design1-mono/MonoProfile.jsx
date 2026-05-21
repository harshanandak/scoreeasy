import PropTypes from "prop-types";
import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DEFAULT_GUEST_SCORING_PATH } from "../../utils/authRedirect";
import { useAuth } from "../../hooks/useAuth";
import BackArrow from "./components/BackArrow";
import SportIcon from "./SportIcon";

function getRoleLabel(stats) {
  const played = stats?.totalMatches > 0;
  const scored = stats?.gamesOperated > 0;
  if (played && scored) return "Player & Scorer - ";
  if (scored) return "Scorer - ";
  if (played) return "Player - ";
  return "";
}

function getStatsGridClass(stats) {
  if (stats?.gamesOperated > 0) return "grid gap-3 grid-cols-2 sm:grid-cols-4";
  return "grid gap-3 grid-cols-2 sm:grid-cols-3";
}

function LoadingState({ onBack }) {
  return (
    <div className="min-h-screen px-6 py-10 mono-transition mono-visible">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onBack}
          className="text-xs bg-transparent border-none cursor-pointer font-swiss mb-10 flex items-center gap-1"
          style={{ color: "#888" }}
        >
          <BackArrow /> Back
        </button>
        <p style={{ color: "#888" }}>Loading profile...</p>
      </div>
    </div>
  );
}

function RecoveryActions({ cloudAuthAvailable, message, onBack, onNavigate, title }) {
  return (
    <div className="min-h-screen px-6 py-10 mono-transition mono-visible">
      <div className="max-w-2xl mx-auto">
        <button
          type="button"
          onClick={onBack}
          className="text-xs bg-transparent border-none cursor-pointer font-swiss mb-10 flex items-center gap-1"
          style={{ color: "#888" }}
        >
          <BackArrow /> Back
        </button>

        <section className="mono-card" style={{ padding: "20px", borderColor: "#111" }}>
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#888" }}>
            Profile
          </p>
          <h1 className="text-xl font-bold mb-3" style={{ color: "#111" }}>
            {title}
          </h1>
          <p className="text-sm mb-5" style={{ color: "#666" }}>
            {message}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {cloudAuthAvailable && (
              <button
                type="button"
                className="mono-btn-primary"
                style={{ minHeight: 44, padding: "10px 14px" }}
                onClick={() => onNavigate("/login?returnTo=%2Fprofile")}
              >
                Sign in to sync profile
              </button>
            )}
            <button
              type="button"
              className={cloudAuthAvailable ? "mono-btn" : "mono-btn-primary"}
              style={{ minHeight: 44, padding: "10px 14px" }}
              onClick={() => onNavigate(DEFAULT_GUEST_SCORING_PATH)}
            >
              Start guest match
            </button>
            <button
              type="button"
              className="mono-btn"
              style={{ minHeight: 44, padding: "10px 14px" }}
              onClick={() => onNavigate("/users/search")}
            >
              Find players
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

RecoveryActions.propTypes = {
  cloudAuthAvailable: PropTypes.bool.isRequired,
  message: PropTypes.string.isRequired,
  onBack: PropTypes.func.isRequired,
  onNavigate: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

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

  if (!paramUsername && (authLoading || (isAuthenticated && !isUserReady))) {
    return <LoadingState onBack={() => navigate("/")} />;
  }

  if (!paramUsername && !displayUser && !isAuthenticated) {
    return (
      <RecoveryActions
        cloudAuthAvailable={cloudAuthAvailable}
        message="You can sign in to sync your profile, or keep scoring locally as a guest."
        onBack={() => navigate("/")}
        onNavigate={navigate}
        title="Save your profile when you're ready"
      />
    );
  }

  if (paramUsername && profileUser === undefined) {
    return <LoadingState onBack={() => navigate(-1)} />;
  }

  if (paramUsername && profileUser === null) {
    return (
      <RecoveryActions
        cloudAuthAvailable={cloudAuthAvailable}
        message={`User @${paramUsername} not found.`}
        onBack={() => navigate(-1)}
        onNavigate={navigate}
        title="Profile not found"
      />
    );
  }

  const formatDate = (ts) => {
    const d = new Date(ts);
    return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear().toString().slice(-2)}`;
  };

  return (
    <div className={`min-h-screen px-6 py-10 mono-transition ${visible ? "mono-visible" : "mono-hidden"}`}>
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate("/")}
          className="text-xs bg-transparent border-none cursor-pointer font-swiss mb-10 flex items-center gap-1"
          style={{ color: "#888" }}
        >
          <BackArrow /> Back
        </button>

        <section className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            {displayUser?.avatarUrl ? (
              <img
                src={displayUser.avatarUrl}
                alt=""
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  border: "1px solid #eee",
                }}
              />
            ) : (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "#f0f0f0",
                  border: "1px solid #eee",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: "#888",
                }}
              >
                {(displayUser?.username || "?")[0].toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold font-mono" style={{ color: "#111" }}>
                @{displayUser?.username || "..."}
              </h1>
              {displayUser?.displayName && (
                <p className="text-sm" style={{ color: "#888" }}>
                  {displayUser.displayName}
                </p>
              )}
            </div>
          </div>
          {displayUser?.createdAt && (
            <p className="text-xs" style={{ color: "#bbb" }}>
              {getRoleLabel(stats)}Joined {formatDate(displayUser.createdAt)}
            </p>
          )}
        </section>

        <hr className="mono-divider mb-8" />

        <section className="mb-8">
          <h2
            className="text-xs uppercase tracking-widest font-normal mb-4"
            style={{ color: "#888" }}
          >
            Stats
          </h2>
          <div className={getStatsGridClass(stats)}>
            <div className="mono-card" style={{ padding: "16px", textAlign: "center" }}>
              <p className="text-2xl font-bold font-mono" style={{ color: "#111" }}>
                {stats?.totalMatches ?? "-"}
              </p>
              <p className="text-xs" style={{ color: "#888" }}>Matches</p>
            </div>
            <div className="mono-card" style={{ padding: "16px", textAlign: "center" }}>
              <p className="text-2xl font-bold font-mono" style={{ color: "#111" }}>
                {stats?.wins ?? "-"}
              </p>
              <p className="text-xs" style={{ color: "#888" }}>Wins</p>
            </div>
            <div className="mono-card" style={{ padding: "16px", textAlign: "center" }}>
              <p className="text-2xl font-bold font-mono" style={{ color: "#111" }}>
                {stats?.winRate == null ? "-" : `${stats.winRate}%`}
              </p>
              <p className="text-xs" style={{ color: "#888" }}>Win Rate</p>
            </div>
            {stats?.gamesOperated > 0 && (
              <div className="mono-card" style={{ padding: "16px", textAlign: "center" }}>
                <p className="text-2xl font-bold font-mono" style={{ color: "#111" }}>
                  {stats.gamesOperated}
                </p>
                <p className="text-xs" style={{ color: "#888" }}>Scored</p>
              </div>
            )}
          </div>
        </section>

        {stats?.sportBreakdown && Object.keys(stats.sportBreakdown).length > 0 && (
          <>
            <hr className="mono-divider mb-8" />
            <section className="mb-8">
              <h2
                className="text-xs uppercase tracking-widest font-normal mb-4"
                style={{ color: "#888" }}
              >
                Sports
              </h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Sport", "P", "W", "L", "Win%"].map((h) => (
                        <th
                          key={h}
                          className="text-xs uppercase tracking-widest font-normal"
                          style={{
                            color: "#888",
                            textAlign: h === "Sport" ? "left" : "right",
                            padding: "8px 12px",
                            borderBottom: "1px solid #eee",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.sportBreakdown).map(([sport, s]) => (
                      <tr key={sport}>
                        <td className="text-sm" style={{ padding: "8px 12px", textTransform: "capitalize" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <SportIcon name={sport.charAt(0).toUpperCase() + sport.slice(1)} size={16} color="#888" />
                            {sport}
                          </span>
                        </td>
                        <td className="text-sm font-mono" style={{ padding: "8px 12px", textAlign: "right" }}>
                          {s.played}
                        </td>
                        <td className="text-sm font-mono" style={{ padding: "8px 12px", textAlign: "right" }}>
                          {s.wins}
                        </td>
                        <td className="text-sm font-mono" style={{ padding: "8px 12px", textAlign: "right" }}>
                          {s.played - s.wins}
                        </td>
                        <td className="text-sm font-mono" style={{ padding: "8px 12px", textAlign: "right" }}>
                          {s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {recentMatches && recentMatches.length > 0 && (
          <>
            <hr className="mono-divider mb-8" />
            <section className="mb-8">
              <h2
                className="text-xs uppercase tracking-widest font-normal mb-4"
                style={{ color: "#888" }}
              >
                Recent Matches
              </h2>
              <div className="space-y-3">
                {recentMatches.map((m) => (
                  <div key={m._id} className="mono-card" style={{ padding: "12px 16px" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs uppercase" style={{ color: "#888" }}>
                        {m.sport}
                      </span>
                      <span className="text-xs font-mono" style={{ color: "#bbb" }}>
                        {formatDate(m.date)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: "#111" }}>
                        {m.team1} vs {m.team2}
                      </span>
                      <span
                        className="text-sm font-mono font-bold"
                        style={{ color: "#111", fontVariantNumeric: "tabular-nums" }}
                      >
                        {m.score1} - {m.score2}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {m.winner && (
                        <p className="text-xs" style={{ color: "#888" }}>
                          Winner: {m.winner}
                        </p>
                      )}
                      {m.matchRole === "refereeing" && (
                        <span className="text-xs" style={{ color: "#bbb" }}>(scored)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <hr className="mono-divider mb-8" />
        <Link
          to="/users/search"
          className="text-sm"
          style={{ color: "#0066ff" }}
        >
          Find players ?
        </Link>
      </div>
    </div>
  );
}

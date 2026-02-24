import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "../../hooks/useAuth";

export default function MonoProfile() {
  const navigate = useNavigate();
  const { username: paramUsername } = useParams();
  const { user: currentUser, isAuthenticated } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Determine which profile to show: own or someone else's
  const isOwnProfile = !paramUsername || paramUsername === currentUser?.username;

  const profileUser = useQuery(
    api.users.getByUsername,
    paramUsername ? { username: paramUsername } : isAuthenticated && currentUser?.username ? { username: currentUser.username } : "skip"
  );

  const userId = isOwnProfile ? currentUser?._id : profileUser?._id;

  const stats = useQuery(
    api.matches.getUserStats,
    userId ? { userId } : "skip"
  );

  const recentMatches = useQuery(
    api.matches.getRecent,
    userId ? { userId } : "skip"
  );

  const displayUser = isOwnProfile ? currentUser : profileUser;

  if (!displayUser && !paramUsername) {
    return (
      <div className={`min-h-screen px-6 py-10 mono-transition ${visible ? "mono-visible" : "mono-hidden"}`}>
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate("/")}
            className="text-xs bg-transparent border-none cursor-pointer font-swiss mb-10 block"
            style={{ color: "#888" }}
          >
            &larr; Back
          </button>
          <p style={{ color: "#888" }}>Sign in to view your profile.</p>
        </div>
      </div>
    );
  }

  if (paramUsername && profileUser === null) {
    return (
      <div className={`min-h-screen px-6 py-10 mono-transition ${visible ? "mono-visible" : "mono-hidden"}`}>
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="text-xs bg-transparent border-none cursor-pointer font-swiss mb-10 block"
            style={{ color: "#888" }}
          >
            &larr; Back
          </button>
          <p style={{ color: "#888" }}>User @{paramUsername} not found.</p>
        </div>
      </div>
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
          className="text-xs bg-transparent border-none cursor-pointer font-swiss mb-10 block"
          style={{ color: "#888" }}
        >
          &larr; Back
        </button>

        {/* Identity */}
        <section className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            {displayUser?.avatarUrl && (
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
              {(() => {
                const played = stats?.totalMatches > 0;
                const scored = stats?.gamesOperated > 0;
                if (played && scored) return 'Player & Scorer \u00b7 ';
                if (scored) return 'Scorer \u00b7 ';
                if (played) return 'Player \u00b7 ';
                return '';
              })()}Joined {formatDate(displayUser.createdAt)}
            </p>
          )}
        </section>

        <hr className="mono-divider mb-8" />

        {/* Stats */}
        <section className="mb-8">
          <h2
            className="text-xs uppercase tracking-widest font-normal mb-4"
            style={{ color: "#888" }}
          >
            Stats
          </h2>
          <div className={`grid gap-3 ${stats?.gamesOperated > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
            <div className="mono-card" style={{ padding: "16px", textAlign: "center" }}>
              <p className="text-2xl font-bold font-mono" style={{ color: "#111" }}>
                {stats?.totalMatches ?? "—"}
              </p>
              <p className="text-xs" style={{ color: "#888" }}>Matches</p>
            </div>
            <div className="mono-card" style={{ padding: "16px", textAlign: "center" }}>
              <p className="text-2xl font-bold font-mono" style={{ color: "#111" }}>
                {stats?.wins ?? "—"}
              </p>
              <p className="text-xs" style={{ color: "#888" }}>Wins</p>
            </div>
            <div className="mono-card" style={{ padding: "16px", textAlign: "center" }}>
              <p className="text-2xl font-bold font-mono" style={{ color: "#111" }}>
                {stats?.winRate != null ? `${stats.winRate}%` : "—"}
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

        {/* Sport Breakdown */}
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
                          {sport}
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

        {/* Recent Matches */}
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

        {/* Find Players Link */}
        <hr className="mono-divider mb-8" />
        <Link
          to="/users/search"
          className="text-sm"
          style={{ color: "#0066ff" }}
        >
          Find players &rarr;
        </Link>
      </div>
    </div>
  );
}

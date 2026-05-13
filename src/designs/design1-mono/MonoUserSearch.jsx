import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useDebounce } from "../../hooks/useDebounce";
import { useAuth } from "../../hooks/useAuth";
import BackArrow from "./components/BackArrow";

export default function MonoUserSearch() {
  const navigate = useNavigate();
  const { cloudAuthAvailable } = useAuth();
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const debouncedQuery = useDebounce(query, 300);
  const canSearchCloud = cloudAuthAvailable && debouncedQuery.length >= 2;

  const results = useQuery(
    api.users.search,
    canSearchCloud ? { prefix: debouncedQuery } : "skip"
  );

  return (
    <div
      className={`min-h-screen px-6 py-10 mono-transition ${visible ? "mono-visible" : "mono-hidden"}`}
    >
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="text-xs bg-transparent border-none cursor-pointer font-swiss mb-10 flex items-center gap-1"
          style={{ color: "#888" }}
        >
          <BackArrow /> Back
        </button>

        <h1
          className="text-xs uppercase tracking-widest font-normal mb-6"
          style={{ color: "#888" }}
        >
          Find Players
        </h1>

        <hr className="mono-divider mb-6" />

        <div style={{ position: 'relative', marginBottom: 24 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#bbb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            type="text"
            className="mono-input w-full"
            placeholder="Search by @username..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            autoComplete="off"
            style={{ paddingLeft: 24 }}
          />
        </div>

        {query.length >= 2 && debouncedQuery !== query && (
          <p className="text-xs mb-4" style={{ color: '#bbb' }}>Searching...</p>
        )}

        {debouncedQuery.length >= 2 && !canSearchCloud && (
          <p className="text-xs mb-4" style={{ color: "#888" }}>
            Cloud search unavailable offline
          </p>
        )}

        {results && results.length > 0 && (
          <div className="space-y-2">
            {results.map((user) => (
              <Link
                key={user._id}
                to={`/profile/${user.username}`}
                className="mono-card flex items-center gap-3"
                style={{
                  padding: "12px 16px",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: "1px solid #eee",
                    }}
                  />
                ) : (
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: '#f0f0f0', border: '1px solid #eee',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 700, color: '#888',
                    flexShrink: 0,
                  }}>
                    {(user.username || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-mono font-bold" style={{ color: "#111" }}>
                    @{user.username}
                  </p>
                  {user.displayName && (
                    <p className="text-xs" style={{ color: "#888" }}>
                      {user.displayName}
                    </p>
                  )}
                </div>
                {user.role && (
                  <span className="text-xs" style={{ color: "#bbb", textTransform: "capitalize" }}>
                    {user.role === 'both' ? 'Player & Referee' : user.role}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}

        {debouncedQuery.length >= 2 && results && results.length === 0 && (
          <p className="text-sm" style={{ color: "#888" }}>
            No users found for "{debouncedQuery}"
          </p>
        )}

        {debouncedQuery.length < 2 && query.length > 0 && (
          <p className="text-xs" style={{ color: "#bbb" }}>
            Type at least 2 characters to search
          </p>
        )}
      </div>
    </div>
  );
}

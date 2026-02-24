import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useDebounce } from "../../hooks/useDebounce";

export default function MonoUserSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const debouncedQuery = useDebounce(query, 300);

  const results = useQuery(
    api.users.search,
    debouncedQuery.length >= 2 ? { prefix: debouncedQuery } : "skip"
  );

  return (
    <div
      className={`min-h-screen px-6 py-10 mono-transition ${visible ? "mono-visible" : "mono-hidden"}`}
    >
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="text-xs bg-transparent border-none cursor-pointer font-swiss mb-10 block"
          style={{ color: "#888" }}
        >
          &larr; Back
        </button>

        <h1
          className="text-xs uppercase tracking-widest font-normal mb-6"
          style={{ color: "#888" }}
        >
          Find Players
        </h1>

        <hr className="mono-divider mb-6" />

        <input
          type="text"
          className="mono-input w-full mb-6"
          placeholder="Search by @username..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          autoComplete="off"
        />

        {results && results.length > 0 && (
          <div className="space-y-2">
            {results.map((user) => (
              <Link
                key={user._id}
                to={`/profile/${user.username}`}
                className="mono-card flex items-center gap-3 block"
                style={{
                  padding: "12px 16px",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                {user.avatarUrl && (
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

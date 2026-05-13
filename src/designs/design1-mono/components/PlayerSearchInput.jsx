import PropTypes from "prop-types";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useDebounce } from "../../../hooks/useDebounce";
import { useAuth } from "../../../hooks/useAuth";
import PlayerChip from "./PlayerChip";

export default function PlayerSearchInput({
  players,
  onAdd,
  onRemove,
  placeholder = "Search @username or type name",
}) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const { cloudAuthAvailable } = useAuth();

  const debouncedQuery = useDebounce(query, 300);
  const canSearchCloud =
    cloudAuthAvailable && debouncedQuery.length >= 2;

  const searchResults = useQuery(
    api.users.search,
    canSearchCloud ? { prefix: debouncedQuery } : "skip"
  );

  // Filter out already-tagged users
  const taggedIds = new Set(
    players.filter((p) => p.type === "user").map((p) => p.userId)
  );
  const filteredResults = (searchResults || []).filter(
    (u) => !taggedIds.has(u._id)
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelectUser(user) {
    onAdd({
      type: "user",
      userId: user._id,
      username: user.username,
      name: user.displayName || user.username,
    });
    setQuery("");
    setShowDropdown(false);
    inputRef.current?.focus();
  }

  function handleAddGuest() {
    const name = query.trim();
    if (!name) return;
    onAdd({ type: "guest", name });
    setQuery("");
    setShowDropdown(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      // If there are search results, select the first one
      if (filteredResults.length > 0) {
        handleSelectUser(filteredResults[0]);
      } else if (query.trim()) {
        handleAddGuest();
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Tagged Players */}
      {players.length > 0 && (
        <div className="flex flex-wrap mb-2">
          {players.map((p, i) => (
            <PlayerChip
              key={p.type === "user" ? p.userId : `guest-${i}`}
              player={p}
              onRemove={() => onRemove(i)}
            />
          ))}
        </div>
      )}

      {/* Search Input */}
      <input
        ref={inputRef}
        type="text"
        className="mono-input w-full"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />

      {/* Dropdown */}
      {showDropdown && query.length >= 2 && (
        <div
          className="absolute left-0 right-0 mt-1"
          style={{
            background: "#fff",
            border: "1px solid #eee",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            zIndex: 10,
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          {filteredResults.map((user) => (
            <button
              key={user._id}
              onClick={() => handleSelectUser(user)}
              className="w-full text-left bg-transparent border-none cursor-pointer flex items-center gap-2"
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid #f5f5f5",
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {user.avatarUrl && (
                <img
                  src={user.avatarUrl}
                  alt=""
                  style={{ width: 20, height: 20, borderRadius: "50%" }}
                />
              )}
              <span className="font-mono text-sm" style={{ color: "#111" }}>
                @{user.username}
              </span>
              {user.displayName && (
                <span className="text-xs" style={{ color: "#888" }}>
                  {user.displayName}
                </span>
              )}
            </button>
          ))}

          {/* Add as guest option */}
          {query.trim() && (
            <button
              onClick={handleAddGuest}
              className="w-full text-left bg-transparent border-none cursor-pointer"
              style={{ padding: "8px 12px", color: "#0066ff" }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <span className="text-sm">+ Add "{query.trim()}" as guest</span>
            </button>
          )}

          {canSearchCloud &&
            filteredResults.length === 0 &&
            query.trim() && (
              <div style={{ padding: "8px 12px", color: "#888" }} className="text-xs">
                No users found
              </div>
            )}
        </div>
      )}
    </div>
  );
}

PlayerSearchInput.propTypes = {
  players: PropTypes.array,
  onAdd: PropTypes.func,
  onRemove: PropTypes.func,
  placeholder: PropTypes.string,
};

import React from "react";

export default function PlayerChip({ player, onRemove }) {
  const isUser = player.type === "user";
  return (
    <span
      className="inline-flex items-center gap-1 text-xs"
      style={{
        background: "#f5f5f5",
        border: "1px solid #eee",
        padding: "3px 8px",
        marginRight: 4,
        marginBottom: 4,
      }}
    >
      {isUser ? (
        <span className="font-mono" style={{ color: "#111" }}>
          @{player.username}
        </span>
      ) : (
        <span style={{ color: "#888" }}>
          {player.name} <span style={{ color: "#bbb" }}>(guest)</span>
        </span>
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          className="bg-transparent border-none cursor-pointer"
          style={{ color: "#888", padding: 0, fontSize: "0.75rem", lineHeight: 1 }}
          aria-label={`Remove ${isUser ? player.username : player.name}`}
        >
          &times;
        </button>
      )}
    </span>
  );
}

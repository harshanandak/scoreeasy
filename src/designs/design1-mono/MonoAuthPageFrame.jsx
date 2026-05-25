import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DEFAULT_GUEST_SCORING_PATH, getAuthReturnToFromSearch } from "../../utils/authRedirect";
import BackArrow from "./components/BackArrow";
import SportIcon from "./SportIcon";
import { sportsTokens } from "./theme/sportsTokens";

export default function MonoAuthPageFrame({ children, helperText, subtitle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const guestTarget = getAuthReturnToFromSearch(location.search, DEFAULT_GUEST_SCORING_PATH);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center px-6 mono-transition ${visible ? "mono-visible" : "mono-hidden"}`}
      style={{ background: sportsTokens.color.canvas }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <SportIcon name="Volleyball" size={24} color={sportsTokens.color.action} />
            <h1
              className="font-mono"
              style={{ fontSize: "0.875rem", fontWeight: 800, letterSpacing: "0", color: sportsTokens.color.inkStrong, lineHeight: 1.1 }}
            >
              SCORE<br />EASY
            </h1>
          </div>
          <p className="text-sm font-swiss" style={{ color: sportsTokens.color.inkMuted }}>
            {subtitle}
          </p>
        </div>

        <div style={{ border: sportsTokens.component.card.border, borderRadius: sportsTokens.component.card.radius, boxShadow: sportsTokens.shadow.card, background: sportsTokens.color.surface, overflow: "hidden" }}>
          {children}
        </div>

        {helperText && (
          <p className="text-xs font-swiss text-center mt-4" style={{ color: sportsTokens.color.inkSoft, lineHeight: 1.5 }}>
            {helperText}
          </p>
        )}

        <div className="text-center mt-8 flex flex-col items-center gap-3">
          <button
            onClick={() => navigate(guestTarget)}
            className="mono-btn"
            style={{ padding: "10px 18px", fontSize: "0.8125rem", borderColor: sportsTokens.color.action, color: sportsTokens.color.action, borderRadius: sportsTokens.component.button.radius }}
          >
            Continue as guest
          </button>
          <button
            onClick={() => navigate("/")}
            className="text-xs bg-transparent border-none cursor-pointer font-swiss flex items-center gap-1 mx-auto"
            style={{ color: sportsTokens.color.inkMuted }}
          >
            <BackArrow /> Back to home
          </button>
        </div>
      </div>
    </div>
  );
}

MonoAuthPageFrame.propTypes = {
  children: PropTypes.node,
  helperText: PropTypes.string,
  subtitle: PropTypes.string.isRequired,
};

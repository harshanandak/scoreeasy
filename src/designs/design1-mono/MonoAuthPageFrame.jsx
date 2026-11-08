import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { sportIdentity } from "../../lib/sportIdentity";
import { DEFAULT_GUEST_SCORING_PATH, getAuthReturnToFromSearch } from "../../utils/authRedirect";
import BackArrow from "./components/BackArrow";
import { KitTop, KitWash } from "./kit/KitParts";
import "./kit/auth.css";

/* The Kit frame around Clerk's sign-in and sign-up (same wash, brand header, title and surface as
   Home and setup). The auth widget itself is themed in clerkTheme.js; auth logic, providers and
   routes are untouched. "Continue as guest" is a full-width control right under the card, so a
   scorer who just wants to score is never pushed to sign in first. */
export default function MonoAuthPageFrame({ children, helperText, subtitle, title }) {
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
      className={`kit-screen kit-auth mono-transition ${visible ? "mono-visible" : "mono-hidden"}`}
      data-screen="auth"
    >
      <KitWash from={sportIdentity("cricket")?.tint} to={sportIdentity("hockey")?.tint} />
      <KitTop title="Score Easy" />

      {title ? (
        <>
          <h1 className="kit-title">{title}</h1>
          <p className="kit-sub">{subtitle}</p>
        </>
      ) : (
        <h1 className="kit-title">{subtitle}</h1>
      )}

      <div className="kit-auth-panel">
        {children}
      </div>

      {helperText && <p className="kit-auth-help">{helperText}</p>}

      <div className="kit-auth-guest">
        <button type="button" onClick={() => navigate(guestTarget)} className="se-ctl">
          Continue as guest
        </button>
        <button type="button" onClick={() => navigate("/app")} className="kit-auth-back">
          <BackArrow /> Back to home
        </button>
      </div>
    </div>
  );
}

MonoAuthPageFrame.propTypes = {
  children: PropTypes.node,
  helperText: PropTypes.string,
  subtitle: PropTypes.string.isRequired,
  title: PropTypes.string,
};

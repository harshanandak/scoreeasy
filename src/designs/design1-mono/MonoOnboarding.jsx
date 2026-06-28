import { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useDebounce } from "../../hooks/useDebounce";
import { useAuth } from "../../hooks/useAuth";
import { getSportsByCategory } from "../../models/sportRegistry";
import { getAuthReturnToFromSearch } from "../../utils/authRedirect";
import { setConsent } from "../../lib/live/liveSession";
import BackArrow from "./components/BackArrow";
import SportIcon from "./SportIcon";

// ---------------------------------------------------------------------------
// Profanity filter — regex-based with leetspeak & separator detection
// ---------------------------------------------------------------------------

// Leetspeak substitution map: each letter maps to a character class
const LEET_MAP = {
  a: "[a@4]", b: "[b8]", c: "[ck]", d: "[d]", e: "[e3]",
  f: "[f]", g: "[g9]", h: "[h]", i: "[i1!l]", j: "[j]",
  k: "[k]", l: "[l1!i]", m: "[m]", n: "[n]", o: "[o0]",
  p: "[p]", q: "[q]", r: "[r]", s: "[s$5z]", t: "[t7]",
  u: "[uv]", v: "[vu]", w: "[w]", x: "[x]", y: "[y]", z: "[zs]",
};

// Optional separator between characters: allows _ . 0 or nothing
const SEP = "[_.0-9]?";

/**
 * Converts a blocked word into a regex that catches:
 *  - Leetspeak: sh1t, fvck, @ss, b1tch
 *  - Repeated chars: fuuuck, shiiiit
 *  - Separators: f.u.c.k, s_h_i_t
 */
function wordToPattern(word) {
  return word
    .split("")
    .map((ch) => {
      const cls = LEET_MAP[ch] || ch;
      // Allow the character (or its leet variant) repeated 1+ times
      return `${cls}+`;
    })
    .join(SEP);
}

// Base blocked words (lowercase)
const BLOCKED_WORDS = [
  // English
  "fuck", "shit", "cunt", "bitch", "dick", "cock", "pussy", "asshole",
  "bastard", "slut", "whore", "nigger", "nigga", "faggot", "retard",
  "wank", "twat", "bollocks", "prick", "arse",
  // Hindi / Urdu — core (romanized, most common across north India)
  "chutiya", "chutia", "chutiye", "madarchod", "bhenchod", "bhosdike",
  "bsdk", "gandu", "randi", "haramkhor", "harami", "lodu", "lavde",
  "jhatu", "choot", "gaand", "tatti", "kutte", "kuttiya", "saala",
  "hramzada", "bhosdi", "lund", "chinal", "raand", "dalla",
  "kamina", "kamine", "kaminey", "hijra", "chakka", "laudu",
  "bhadwa", "bhadwe", "chodu", "chodna", "behenchod",
  // Hindi / Urdu — extended variations
  "machar", "maderchod", "bhenkelode", "chodu", "chodoo",
  "gandmara", "gandphadu", "jhaant", "jhaantu", "bhosad",
  "tharki", "lauda", "laude", "lundure", "gaandmara",
  // Punjabi (romanized)
  "penchod", "bhenchodd", "kutti", "khotey", "khotay",
  "chootad", "teri_maa", "panchod", "gashti", "kanjar",
  "tattay", "phuddi", "phuddu", "ghasti",
  // Bhojpuri / UP-Bihar (romanized)
  "maichod", "bhokal", "bhokaal", "chootmarani", "gandwa",
  "raandwa", "bhadwi", "khanki", "suar", "suwar",
  // Haryanvi / Rajasthani (romanized)
  "bhadvo", "randvo", "kutto", "gandiya", "chootad",
  // Marathi (romanized)
  "zhavnya", "raand", "chhinaal", "aaizhavadya", "bhikarchot",
  "maadarchod", "gaandit", "zavnya",
  // Tamil (romanized)
  "thevidiya", "thevdiya", "oombu", "sunni", "punda", "pundai",
  "myiru", "baadu", "vesai", "vesi", "thayoli", "okka",
  "otha", "koothi", "naayee",
  // Telugu (romanized)
  "lanja", "lanjakodaka", "pooka", "modda", "dengey", "gudda",
  "sulli", "erripuka", "donga", "denga", "lanjodaka",
  // Kannada (romanized)
  "sule", "sulemaga", "bolimaga", "tunne", "munde", "hendti",
  "soolemaga",
  // Bengali (romanized)
  "banchod", "magi", "chodu", "bokachoda", "shala", "haramjada",
  "baal", "nangta", "khanki", "fatichod",
  // Malayalam (romanized)
  "myiru", "thayoli", "kunna", "pooru", "thendi", "mandan",
  // Gujarati (romanized)
  "gando", "gandi", "bhosdo", "chootiya", "lodo",
];

// Pre-compile all patterns into a single regex for performance
const PROFANITY_REGEX = new RegExp(
  BLOCKED_WORDS.map((w) => `(?:${wordToPattern(w)})`).join("|")
);

/**
 * Checks if a username contains profanity (with fuzzy matching).
 * @param {string} value - Lowercase username
 * @returns {boolean}
 */
function containsProfanity(value) {
  return PROFANITY_REGEX.test(value);
}

/**
 * Validates a username string against the gamertag rules.
 * Instagram-style: lowercase letters, numbers, underscore, period.
 * @param {string} value - The username to validate.
 * @returns {string|null} An error message, or null if valid.
 */
function validateUsername(value) {
  if (value.length < 4) return "At least 4 characters";
  if (value.length > 20) return "Maximum 20 characters";
  if (!/^[a-z0-9_.]+$/.test(value))
    return "Only letters, numbers, underscore, and period";
  if (/(?:^[_.])|(?:[_.]$)/.test(value))
    return "Cannot start or end with underscore or period";
  if (/(?:\.\.)|(?:__)|(?:\._)|(?:_\.)/.test(value))
    return "No consecutive special characters";
  if (containsProfanity(value))
    return "Username contains inappropriate language";
  return null;
}

// ---------------------------------------------------------------------------
// Step Indicator — progress bar
// ---------------------------------------------------------------------------

const STEP_LABELS = ["Name", "Gamertag", "Preferences", "Sports"];

function StepIndicator({ current, total }) {
  const progress = ((current + 1) / total) * 100;

  return (
    <div className="mb-10">
      {/* Progress bar */}
      <div
        style={{
          width: "100%",
          height: 2,
          background: "#eee",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: "#0066ff",
            transition: "width 300ms ease",
          }}
        />
      </div>

      {/* Step labels */}
      <div className="flex items-center justify-between">
        {STEP_LABELS.map((label, i) => (
          <span
            key={label}
            className="text-xs font-swiss"
            style={{
              color: i <= current ? "#0066ff" : "#ccc",
              fontWeight: i === current ? 500 : 400,
              transition: "color 200ms ease",
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

StepIndicator.propTypes = {
  current: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
};

// ---------------------------------------------------------------------------
// Step 1 — Name
// ---------------------------------------------------------------------------

function StepName({ firstName, lastName, onChange, onNext, clerkUser }) {
  const headingRef = useRef(null);

  // Move focus to the step heading on entry (a11y: announces the new step and
  // gives keyboard users a predictable landing point). The heading is
  // programmatically focusable via tabIndex={-1}.
  useEffect(() => {
    if (headingRef.current) headingRef.current.focus();
  }, []);

  // Pre-fill from Clerk (e.g. Google OAuth) if fields are empty. Depends on
  // clerkUser because it loads asynchronously (null on first render, then
  // populated) — without these deps the Google name is missed. The empty-guard
  // (!firstName / !lastName) prevents clobbering anything the user has typed.
  useEffect(() => {
    if (!clerkUser) return;
    if (!firstName && clerkUser.firstName) {
      onChange("firstName", clerkUser.firstName);
    }
    if (!lastName && clerkUser.lastName) {
      onChange("lastName", clerkUser.lastName);
    }
  }, [clerkUser, firstName, lastName, onChange]);

  const canContinue = true;

  function handleSubmit(e) {
    e.preventDefault();
    if (canContinue) onNext();
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-swiss font-bold mb-2"
        style={{ color: "#111", outline: "none" }}
      >
        What's your name?
      </h1>
      <p className="text-sm mb-8" style={{ color: "#888" }}>
        So your teammates know who you are.
      </p>

      <hr className="mono-divider mb-8" />

      <label
        className="text-xs uppercase tracking-widest font-normal block mb-2"
        style={{ color: "#888" }}
        htmlFor="onboard-first"
      >
        First name <span style={{ color: "#888", fontWeight: 400 }}>(optional)</span>
      </label>
      <input
        id="onboard-first"
        type="text"
        className="mono-input w-full mb-6"
        placeholder="First name"
        value={firstName}
        onChange={(e) => onChange("firstName", e.target.value)}
        autoComplete="given-name"
      />

      <label
        className="text-xs uppercase tracking-widest font-normal block mb-2"
        style={{ color: "#888" }}
        htmlFor="onboard-last"
      >
        Last name <span style={{ color: "#888", fontWeight: 400 }}>(optional)</span>
      </label>
      <input
        id="onboard-last"
        type="text"
        className="mono-input w-full mb-8"
        placeholder="Last name"
        value={lastName}
        onChange={(e) => onChange("lastName", e.target.value)}
        autoComplete="family-name"
      />

      <button
        type="submit"
        className="mono-btn-primary w-full"
        style={{ padding: "12px" }}
        disabled={!canContinue}
      >
        Continue
      </button>
    </form>
  );
}

StepName.propTypes = {
  firstName: PropTypes.string.isRequired,
  lastName: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  clerkUser: PropTypes.shape({
    firstName: PropTypes.string,
    lastName: PropTypes.string,
  }),
};

// ---------------------------------------------------------------------------
// Step 2 — Username
// ---------------------------------------------------------------------------

// How long to wait for the availability check before treating it as a timeout.
// Convex useQuery returns `undefined` while pending (it throws to an error
// boundary on hard failure rather than returning an error), so a stuck
// `undefined` is our only signal of a slow/lost connection — surface it.
const USERNAME_CHECK_TIMEOUT_MS = 8000;

function StepUsername({ username, onChange, onNext, onBack }) {
  const headingRef = useRef(null);

  // Focus the step heading on entry (a11y) rather than the input, so the new
  // step is announced. The input is the next Tab stop.
  useEffect(() => {
    if (headingRef.current) headingRef.current.focus();
  }, []);

  const normalized = username.toLowerCase().replaceAll(/[^a-z0-9_.]/g, "");
  const validationError = normalized.length > 0 ? validateUsername(normalized) : null;
  const debouncedUsername = useDebounce(normalized, 300);

  const shouldCheck = !validationError && debouncedUsername.length >= 4;
  const isAvailable = useQuery(
    api.users.checkUsername,
    shouldCheck ? { username: debouncedUsername } : "skip"
  );

  // Watchdog: if the check stays pending past the timeout, flag it so the user
  // gets an actionable message instead of an indefinite "Checking...".
  const isPending = shouldCheck && debouncedUsername === normalized && isAvailable === undefined;
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!isPending) {
      setTimedOut(false);
      return undefined;
    }
    const timer = setTimeout(() => setTimedOut(true), USERNAME_CHECK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isPending, debouncedUsername]);

  function getIndicator() {
    if (normalized.length === 0) return null;
    if (validationError) return { text: validationError, color: "#dc2626", icon: "✕" };
    if (timedOut)
      return {
        text: "Couldn't check availability — check your connection and try again.",
        color: "#dc2626",
        icon: "⚠",
      };
    if (debouncedUsername !== normalized || isAvailable === undefined)
      return { text: "Checking availability...", color: "#888", icon: "" };
    if (isAvailable) return { text: "Available", color: "#16a34a", icon: "✓" };
    return { text: "Already taken", color: "#dc2626", icon: "✕" };
  }

  const indicator = getIndicator();
  const canContinue = !validationError && !timedOut && isAvailable === true;

  function handleSubmit(e) {
    e.preventDefault();
    if (canContinue) onNext();
  }

  return (
    <form onSubmit={handleSubmit}>
      <button
        type="button"
        onClick={onBack}
        className="text-sm bg-transparent border-none cursor-pointer font-swiss mb-6 flex items-center gap-1"
        style={{ color: "#888", padding: "10px 8px 10px 0", minHeight: 44, marginLeft: -8, paddingLeft: 8 }}
      >
        <BackArrow /> Back
      </button>

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-swiss font-bold mb-2"
        style={{ color: "#111", outline: "none" }}
      >
        Choose your gamertag
      </h1>
      <p className="text-sm mb-8" style={{ color: "#888" }}>
        This is how other players will find you.
      </p>

      <hr className="mono-divider mb-8" />

      <div className="relative mb-2">
        <span
          className="absolute font-mono"
          style={{
            left: 0,
            bottom: "8px",
            color: "#888",
            fontSize: "1.125rem",
          }}
        >
          @
        </span>
        <input
          type="text"
          className="mono-input w-full font-mono"
          style={{ paddingLeft: "1.5rem", fontSize: "1.125rem" }}
          placeholder="username"
          value={username}
          onChange={(e) =>
            onChange("username", e.target.value.toLowerCase().replaceAll(/\s/g, ""))
          }
          autoComplete="off"
          maxLength={20}
          aria-describedby="onboard-username-status"
          aria-invalid={Boolean(indicator && indicator.color === "#dc2626")}
        />
      </div>

      {/* Persistent live region: kept mounted so screen readers reliably
          announce status changes (availability, errors, timeout). Valence is
          conveyed via a leading glyph + text, not color alone. */}
      <p
        id="onboard-username-status"
        role="status"
        aria-live="polite"
        className="text-xs mb-4"
        style={{ color: indicator ? indicator.color : "transparent", minHeight: "1rem" }}
      >
        {indicator ? `${indicator.icon ? `${indicator.icon} ` : ""}${indicator.text}` : ""}
      </p>

      <p className="text-xs mb-6" style={{ color: "#bbb" }}>
        4-20 characters. Letters, numbers, underscore, and period.
      </p>

      <button
        type="submit"
        className="mono-btn-primary w-full"
        style={{ padding: "12px" }}
        disabled={!canContinue}
      >
        Continue
      </button>
    </form>
  );
}

StepUsername.propTypes = {
  username: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
};

// ---------------------------------------------------------------------------
// Step 3 — Role and Play Style
// ---------------------------------------------------------------------------

const ROLES = [
  { id: "player", label: "Player", desc: "I play in matches" },
  { id: "referee", label: "Referee", desc: "I score for others" },
  { id: "both", label: "Both", desc: "I play and score" },
];

const PLAY_STYLES = [
  { id: "quick", label: "Quick Matches" },
  { id: "series", label: "Series" },
  { id: "tournaments", label: "Tournaments" },
];

function StepPreferences({ role, playStyles, onChange, onNext, onBack }) {
  const headingRef = useRef(null);

  useEffect(() => {
    if (headingRef.current) headingRef.current.focus();
  }, []);

  function togglePlayStyle(id) {
    const next = playStyles.includes(id)
      ? playStyles.filter((s) => s !== id)
      : [...playStyles, id];
    onChange("playStyles", next);
  }

  function handleSubmit(e) {
    e.preventDefault();
    onNext();
  }

  return (
    <form onSubmit={handleSubmit}>
      <button
        type="button"
        onClick={onBack}
        className="text-sm bg-transparent border-none cursor-pointer font-swiss mb-6 flex items-center gap-1"
        style={{ color: "#888", padding: "10px 8px 10px 0", minHeight: 44, marginLeft: -8, paddingLeft: 8 }}
      >
        <BackArrow /> Back
      </button>

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-swiss font-bold mb-2"
        style={{ color: "#111", outline: "none" }}
      >
        How do you play?
      </h1>
      <p className="text-sm mb-8" style={{ color: "#888" }}>
        Helps us tailor the experience for you.
      </p>

      <hr className="mono-divider mb-8" />

      {/* Role Selection */}
      <p
        className="text-xs uppercase tracking-widest font-normal mb-4"
        style={{ color: "#888" }}
      >
        Your role
      </p>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {ROLES.map((r) => {
          const selected = role === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onChange("role", r.id)}
              style={{
                background: selected ? "#f0f6ff" : "#ffffff",
                border: selected ? "2px solid #0066ff" : "1px solid #eee",
                padding: selected ? "15px 11px" : "16px 12px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                transition: "border-color 200ms ease, background 200ms ease",
              }}
            >
              <span
                className="text-sm font-swiss font-medium"
                style={{ color: selected ? "#0066ff" : "#111" }}
              >
                {r.label}
              </span>
              <span
                className="text-xs font-swiss"
                style={{ color: selected ? "#0066ff" : "#888" }}
              >
                {r.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Play Style Chips */}
      <p
        className="text-xs uppercase tracking-widest font-normal mb-4"
        style={{ color: "#888", marginTop: 32 }}
      >
        Play style
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        {PLAY_STYLES.map((ps) => {
          const selected = playStyles.includes(ps.id);
          return (
            <button
              key={ps.id}
              type="button"
              onClick={() => togglePlayStyle(ps.id)}
              className="text-sm font-swiss"
              style={{
                display: "inline-block",
                padding: "8px 16px",
                background: selected ? "#0066ff" : "transparent",
                color: selected ? "#ffffff" : "#111",
                border: selected ? "1px solid #0066ff" : "1px solid #ddd",
                cursor: "pointer",
                transition:
                  "background 200ms ease, color 200ms ease, border-color 200ms ease",
              }}
            >
              {ps.label}
            </button>
          );
        })}
      </div>

      <button
        type="submit"
        className="mono-btn-primary w-full"
        style={{ padding: "12px" }}
      >
        Continue
      </button>
    </form>
  );
}

StepPreferences.propTypes = {
  role: PropTypes.string.isRequired,
  playStyles: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
};

// ---------------------------------------------------------------------------
// Step 4 — Favorite Games
// ---------------------------------------------------------------------------

function StepGames({ selectedGames, onChange, onSubmit, onBack, isSubmitting, error, liveConsent, onLiveConsentChange }) {
  const categories = getSportsByCategory();
  const headingRef = useRef(null);

  useEffect(() => {
    if (headingRef.current) headingRef.current.focus();
  }, []);

  function toggleGame(id) {
    const next = selectedGames.includes(id)
      ? selectedGames.filter((g) => g !== id)
      : [...selectedGames, id];
    onChange("selectedGames", next);
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit}>
      <button
        type="button"
        onClick={onBack}
        className="text-sm bg-transparent border-none cursor-pointer font-swiss mb-6 flex items-center gap-1"
        style={{ color: "#888", padding: "10px 8px 10px 0", minHeight: 44, marginLeft: -8, paddingLeft: 8 }}
      >
        <BackArrow /> Back
      </button>

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-swiss font-bold mb-2"
        style={{ color: "#111", outline: "none" }}
      >
        What do you play?
      </h1>
      <p className="text-sm mb-8" style={{ color: "#888" }}>
        Pick the sports you are into. You can always change this later.
      </p>

      <hr className="mono-divider mb-6" />

      {Object.entries(categories).map(([category, sports]) => (
        <div key={category}>
          <p
            className="text-xs uppercase tracking-widest font-normal mb-2"
            style={{ color: "#888", marginTop: 24 }}
          >
            {category}
          </p>

          <div className="flex flex-wrap gap-2">
            {sports.map((sport) => {
              const selected = selectedGames.includes(sport.id);
              return (
                <button
                  key={sport.id}
                  type="button"
                  onClick={() => toggleGame(sport.id)}
                  style={{
                    width: 80,
                    background: selected ? "#f0f6ff" : "#ffffff",
                    border: selected ? "2px solid #0066ff" : "1px solid #eee",
                    padding: selected ? "11px 3px" : "12px 4px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    transition: "border-color 200ms ease, background 200ms ease",
                  }}
                >
                  <SportIcon name={sport.name} size={24} color={selected ? "#0066ff" : "#888"} />
                  <span
                    className="text-xs font-swiss"
                    style={{
                      color: selected ? "#0066ff" : "#888",
                      textAlign: "center",
                      lineHeight: 1.2,
                    }}
                  >
                    {sport.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {error && (
        <p className="text-sm mt-6" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}

      {/* Live-sharing consent — captured here so the scorer never interrupts a
          match to ask. Opt-IN (unchecked by default): a user must actively choose
          to make matches public. If they never touch this control, we record no
          choice at all (the share flow can ask later). You can stop any match
          live-share at any time. */}
      <hr className="mono-divider mt-8 mb-5" />
      <label
        htmlFor="onboarding-live-consent"
        style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", minHeight: 44, padding: "4px 0" }}
      >
        <input
          id="onboarding-live-consent"
          type="checkbox"
          checked={liveConsent}
          onChange={(e) => onLiveConsentChange(e.target.checked)}
          style={{ marginTop: 3, width: 20, height: 20, flexShrink: 0 }}
        />
        <span className="text-sm font-swiss" style={{ color: "#444", lineHeight: 1.45 }}>
          <strong style={{ color: "#111" }}>Share my matches live.</strong> When you score, anyone with the link can watch the live scoreboard (team names + score). You can stop sharing any match at any time.
        </span>
      </label>

      <div className="flex items-center justify-between mt-8 gap-4">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="text-sm font-swiss bg-transparent border-none cursor-pointer"
          style={{ color: "#888", padding: "10px 8px", minHeight: 44, marginLeft: -8 }}
        >
          Skip &amp; finish
        </button>
        <button
          type="submit"
          className="mono-btn-primary flex-1"
          style={{ padding: "12px" }}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Setting up..." : "Let's go"}
        </button>
      </div>
      <p className="text-xs mt-3" style={{ color: "#bbb", textAlign: "center" }}>
        Sports are optional — you can add them later from your profile.
      </p>
    </form>
  );
}

StepGames.propTypes = {
  selectedGames: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  liveConsent: PropTypes.bool.isRequired,
  onLiveConsentChange: PropTypes.func.isRequired,
};

// ---------------------------------------------------------------------------
// Main Onboarding Component
// ---------------------------------------------------------------------------

export default function MonoOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, clerkUser } = useAuth();
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const returnTo = getAuthReturnToFromSearch(location.search, "/");

  // --- Form state ---
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("both");
  const [playStyles, setPlayStyles] = useState([]);
  const [selectedGames, setSelectedGames] = useState([]);

  // --- Wizard state ---
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState("forward");
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  // Live-sharing consent, optionally captured here at sign-in (opt-IN: unchecked
  // by default, so a user must actively choose to make matches public) so the
  // scorer never has to interrupt a match to ask. We ONLY persist a decision if
  // the user actually interacts with the checkbox — if they never touch it we
  // record nothing, leaving the choice to the share flow later. `consentTouched`
  // tracks that interaction.
  const [liveConsent, setLiveConsent] = useState(false);
  const [consentTouched, setConsentTouched] = useState(false);

  const handleLiveConsentChange = useCallback((next) => {
    setConsentTouched(true);
    setLiveConsent(next);
  }, []);

  const TOTAL_STEPS = 4;

  // Page fade-in on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Auth guard
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate, returnTo]);

  // Skip step 1 (Name) once when Clerk already has a name (e.g. Google OAuth).
  // clerkUser loads asynchronously (null first render, then populated), so this
  // runs in an effect rather than initial state. `didInitStep` guards it to fire
  // at most once and only while the user is still on step 0 untouched — we never
  // yank the step out from under someone who has already started navigating.
  const didInitStep = useRef(false);
  useEffect(() => {
    if (didInitStep.current) return;
    if (isLoading) return;
    if (!clerkUser) return;
    didInitStep.current = true;
    const hasName = Boolean(clerkUser.firstName || clerkUser.lastName);
    if (hasName && step === 0) {
      // Prefill so the resolved name carries through, then jump straight to the
      // gamertag step without the slide animation.
      if (clerkUser.firstName) setFirstName((prev) => prev || clerkUser.firstName);
      if (clerkUser.lastName) setLastName((prev) => prev || clerkUser.lastName);
      setStep(1);
    }
  }, [clerkUser, isLoading, step]);

  // --- Field change handler ---
  const handleChange = useCallback((field, value) => {
    switch (field) {
      case "firstName":
        setFirstName(value);
        break;
      case "lastName":
        setLastName(value);
        break;
      case "username":
        setUsername(value);
        break;
      case "role":
        setRole(value);
        break;
      case "playStyles":
        setPlayStyles(value);
        break;
      case "selectedGames":
        setSelectedGames(value);
        break;
      default:
        break;
    }
  }, []);

  // --- Step navigation with animation ---
  const goForward = useCallback(() => {
    if (isAnimating) return;
    setDirection("forward");
    setIsAnimating(true);
  }, [isAnimating]);

  const goBack = useCallback(() => {
    if (isAnimating) return;
    setDirection("back");
    setIsAnimating(true);
  }, [isAnimating]);

  // When animation state triggers, schedule the actual step change
  useEffect(() => {
    if (!isAnimating) return;

    const timer = setTimeout(() => {
      setStep((prev) =>
        direction === "forward"
          ? Math.min(prev + 1, TOTAL_STEPS - 1)
          : Math.max(prev - 1, 0)
      );
      setIsAnimating(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [isAnimating, direction]);

  // --- Submit ---
  async function handleSubmit() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    const normalizedUsername = username.toLowerCase().replaceAll(/[^a-z0-9_.]/g, "");
    const resolvedFirstName = firstName.trim() || clerkUser?.firstName || normalizedUsername || "Player";
    const resolvedLastName = lastName.trim() || clerkUser?.lastName || "";

    try {
      await completeOnboarding({
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        username: normalizedUsername,
        role,
        favoriteGames: selectedGames,
        playStyle: playStyles,
      });
      // Record the live-sharing choice ONLY if the user actually interacted with
      // the checkbox. If untouched, leave consent unset so the share flow can ask
      // later — never pre-write "declined" for a choice the user never made.
      if (consentTouched) {
        setConsent(liveConsent ? "accepted" : "declined");
      }
      navigate(returnTo);
    } catch (err) {
      const msg = err?.message || "";
      if (msg.includes("already taken")) {
        setError("Username was just taken. Go back and pick another one.");
      } else if (
        msg.includes("Not authenticated") ||
        msg.includes("User not found")
      ) {
        setError("Session expired. Redirecting to sign in...");
        setTimeout(() => navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`), 1500);
      } else {
        setError(msg || "Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- Loading / auth guard ---
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#fafafa" }}
      >
        <p className="text-sm font-swiss" style={{ color: "#888" }}>
          Loading...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // --- Compute animation styles ---
  const getStepStyle = () => {
    if (isAnimating) {
      return {
        opacity: 0,
        transform:
          direction === "forward" ? "translateX(-40px)" : "translateX(40px)",
        transition: "opacity 250ms ease, transform 250ms ease",
      };
    }
    return {
      opacity: 1,
      transform: "translateX(0)",
      transition: "opacity 250ms ease, transform 250ms ease",
    };
  };

  // --- Render current step ---
  function renderStep() {
    switch (step) {
      case 0:
        return (
          <StepName
            firstName={firstName}
            lastName={lastName}
            onChange={handleChange}
            onNext={goForward}
            clerkUser={clerkUser}
          />
        );
      case 1:
        return (
          <StepUsername
            username={username}
            onChange={handleChange}
            onNext={goForward}
            onBack={goBack}
          />
        );
      case 2:
        return (
          <StepPreferences
            role={role}
            playStyles={playStyles}
            onChange={handleChange}
            onNext={goForward}
            onBack={goBack}
          />
        );
      case 3:
        return (
          <StepGames
            selectedGames={selectedGames}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onBack={goBack}
            isSubmitting={isSubmitting}
            error={error}
            liveConsent={liveConsent}
            onLiveConsentChange={handleLiveConsentChange}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div
      className={`min-h-screen px-6 mono-transition ${visible ? "mono-visible" : "mono-hidden"}`}
      style={{ background: "#fafafa" }}
    >
      <div className="max-w-sm mx-auto" style={{ paddingTop: "8vh" }}>
        {/* Branding */}
        <div className="mb-8" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SportIcon name="Volleyball" size={20} color="#111" />
          <span
            className="font-mono"
            style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#111', lineHeight: 1.1 }}
          >
            SCORE<br />EASY
          </span>
        </div>

        <StepIndicator current={step} total={TOTAL_STEPS} />

        <div style={getStepStyle()}>
          {renderStep()}
        </div>
      </div>
    </div>
  );
}


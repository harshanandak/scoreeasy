import { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useDebounce } from "../../hooks/useDebounce";
import { useAuth } from "../../hooks/useAuth";
import { getSportsByCategory } from "../../models/sportRegistry";
import { getAuthReturnToFromSearch } from "../../utils/authRedirect";
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
  const firstRef = useRef(null);

  useEffect(() => {
    if (firstRef.current) firstRef.current.focus();
  }, []);

  // Pre-fill from Clerk (Google OAuth) if fields are empty on mount
  useEffect(() => {
    if (clerkUser) {
      if (!firstName && clerkUser.firstName) {
        onChange("firstName", clerkUser.firstName);
      }
      if (!lastName && clerkUser.lastName) {
        onChange("lastName", clerkUser.lastName);
      }
    }
  }, []);

  const canContinue = true;

  function handleSubmit(e) {
    e.preventDefault();
    if (canContinue) onNext();
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1
        className="text-2xl font-swiss font-bold mb-2"
        style={{ color: "#111" }}
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
        ref={firstRef}
        id="onboard-first"
        type="text"
        className="mono-input w-full mb-6"
        placeholder="First name"
        value={firstName}
        onChange={(e) => onChange("firstName", e.target.value)}
        autoComplete="given-name"
        required
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
        required
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

function StepUsername({ username, onChange, onNext, onBack }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const normalized = username.toLowerCase().replaceAll(/[^a-z0-9_.]/g, "");
  const validationError = normalized.length > 0 ? validateUsername(normalized) : null;
  const debouncedUsername = useDebounce(normalized, 300);

  const isAvailable = useQuery(
    api.users.checkUsername,
    !validationError && debouncedUsername.length >= 4
      ? { username: debouncedUsername }
      : "skip"
  );

  function getIndicator() {
    if (normalized.length === 0) return null;
    if (validationError) return { text: validationError, color: "#dc2626" };
    if (debouncedUsername !== normalized || isAvailable === undefined)
      return { text: "Checking...", color: "#888" };
    if (isAvailable) return { text: "Available", color: "#16a34a" };
    return { text: "Already taken", color: "#dc2626" };
  }

  const indicator = getIndicator();
  const canContinue = !validationError && isAvailable === true;

  function handleSubmit(e) {
    e.preventDefault();
    if (canContinue) onNext();
  }

  return (
    <form onSubmit={handleSubmit}>
      <button
        type="button"
        onClick={onBack}
        className="text-xs bg-transparent border-none cursor-pointer font-swiss mb-8 flex items-center gap-1"
        style={{ color: "#888", padding: 0 }}
      >
        <BackArrow /> Back
      </button>

      <h1
        className="text-2xl font-swiss font-bold mb-2"
        style={{ color: "#111" }}
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
          ref={inputRef}
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
        />
      </div>

      {indicator && (
        <p className="text-xs mb-4" style={{ color: indicator.color }}>
          {indicator.text === "Available" ? "\u2713 " : ""}
          {indicator.text}
        </p>
      )}

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
        className="text-xs bg-transparent border-none cursor-pointer font-swiss mb-8 flex items-center gap-1"
        style={{ color: "#888", padding: 0 }}
      >
        <BackArrow /> Back
      </button>

      <h1
        className="text-2xl font-swiss font-bold mb-2"
        style={{ color: "#111" }}
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

function StepGames({ selectedGames, onChange, onSubmit, onBack, isSubmitting, error }) {
  const categories = getSportsByCategory();

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
        className="text-xs bg-transparent border-none cursor-pointer font-swiss mb-8 flex items-center gap-1"
        style={{ color: "#888", padding: 0 }}
      >
        <BackArrow /> Back
      </button>

      <h1
        className="text-2xl font-swiss font-bold mb-2"
        style={{ color: "#111" }}
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

      <div className="flex items-center justify-between mt-10 gap-4">
        <button
          type="button"
          onClick={onSubmit}
          className="text-sm font-swiss bg-transparent border-none cursor-pointer"
          style={{ color: "#888", padding: 0 }}
        >
          Skip for now
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


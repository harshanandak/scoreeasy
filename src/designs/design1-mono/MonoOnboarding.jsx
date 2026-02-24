import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useDebounce } from "../../hooks/useDebounce";
import { useAuth } from "../../hooks/useAuth";
import { getSportsByCategory } from "../../models/sportRegistry";

/**
 * Validates a username string against the gamertag rules.
 * @param {string} value - The username to validate.
 * @returns {string|null} An error message, or null if valid.
 */
function validateUsername(value) {
  if (value.length < 3) return "At least 3 characters";
  if (value.length > 20) return "Maximum 20 characters";
  if (!/^[a-z0-9_]+$/.test(value))
    return "Only lowercase letters, numbers, and underscore";
  if (/^_|_$/.test(value)) return "Cannot start or end with underscore";
  return null;
}

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------

/**
 * Renders progress dots for the onboarding wizard.
 * @param {{ current: number, total: number }} props
 */
function StepIndicator({ current, total }) {
  return (
    <div
      className="flex items-center gap-2 mb-10"
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Step ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: i <= current ? "#0066ff" : "transparent",
            border: i <= current ? "1px solid #0066ff" : "1px solid #ddd",
            transition: "background 200ms ease, border-color 200ms ease",
          }}
        />
      ))}
      <span
        className="text-xs font-swiss ml-1"
        style={{ color: "#888" }}
      >
        Step {current + 1} of {total}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Name
// ---------------------------------------------------------------------------

/**
 * @param {{ firstName: string, lastName: string, onChange: Function, onNext: Function, clerkUser: object|null }} props
 */
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
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canContinue = firstName.trim().length > 0 && lastName.trim().length > 0;

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
        First name
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
        Last name
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

// ---------------------------------------------------------------------------
// Step 2 — Username
// ---------------------------------------------------------------------------

/**
 * @param {{ username: string, onChange: Function, onNext: Function, onBack: Function }} props
 */
function StepUsername({ username, onChange, onNext, onBack }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const normalized = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
  const validationError = normalized.length > 0 ? validateUsername(normalized) : null;
  const debouncedUsername = useDebounce(normalized, 300);

  const isAvailable = useQuery(
    api.users.checkUsername,
    !validationError && debouncedUsername.length >= 3
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
        className="text-xs bg-transparent border-none cursor-pointer font-swiss mb-8 block"
        style={{ color: "#888", padding: 0 }}
      >
        &larr; Back
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
            onChange("username", e.target.value.toLowerCase().replace(/\s/g, ""))
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
        3-20 characters. Letters, numbers, underscore only.
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

/**
 * @param {{ role: string, playStyles: string[], onChange: Function, onNext: Function, onBack: Function }} props
 */
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
        className="text-xs bg-transparent border-none cursor-pointer font-swiss mb-8 block"
        style={{ color: "#888", padding: 0 }}
      >
        &larr; Back
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

// ---------------------------------------------------------------------------
// Step 4 — Favorite Games
// ---------------------------------------------------------------------------

/**
 * @param {{ selectedGames: string[], onChange: Function, onSubmit: Function, onBack: Function, isSubmitting: boolean, error: string }} props
 */
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
        className="text-xs bg-transparent border-none cursor-pointer font-swiss mb-8 block"
        style={{ color: "#888", padding: 0 }}
      >
        &larr; Back
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
                  <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>
                    {sport.icon}
                  </span>
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
          Skip
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

// ---------------------------------------------------------------------------
// Main Onboarding Component
// ---------------------------------------------------------------------------

/**
 * 4-step onboarding wizard for GameScore.
 * Collects name, gamertag, role/play-style, and favorite sports,
 * then calls `completeOnboarding` to persist everything atomically.
 *
 * @returns {JSX.Element}
 */
export default function MonoOnboarding() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, clerkUser } = useAuth();
  const completeOnboarding = useMutation(api.users.completeOnboarding);

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
      navigate("/login");
    }
  }, [isLoading, isAuthenticated, navigate]);

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

    const normalizedUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, "");

    try {
      await completeOnboarding({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: normalizedUsername,
        role,
        favoriteGames: selectedGames,
        playStyle: playStyles,
      });
      navigate("/");
    } catch (err) {
      const msg = err?.message || "";
      if (msg.includes("already taken")) {
        setError("Username was just taken. Go back and pick another one.");
      } else if (
        msg.includes("Not authenticated") ||
        msg.includes("User not found")
      ) {
        setError("Session expired. Redirecting to sign in...");
        setTimeout(() => navigate("/login"), 1500);
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
  // Exiting: current step slides out in the opposite direction of travel
  // Entering: new step slides in from the direction of travel
  const getStepStyle = () => {
    if (isAnimating) {
      // Slide out
      return {
        opacity: 0,
        transform:
          direction === "forward" ? "translateX(-40px)" : "translateX(40px)",
        transition: "opacity 250ms ease, transform 250ms ease",
      };
    }
    // Normal visible state (just arrived or idle)
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
      className={`min-h-screen px-6 py-10 mono-transition ${visible ? "mono-visible" : "mono-hidden"}`}
      style={{ background: "#fafafa" }}
    >
      <div className="max-w-sm mx-auto" style={{ paddingTop: "4vh" }}>
        <StepIndicator current={step} total={TOTAL_STEPS} />

        <div style={getStepStyle()}>
          {renderStep()}
        </div>
      </div>
    </div>
  );
}

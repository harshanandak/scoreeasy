import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { getSportById } from '../../../models/sportRegistry';
import { loadSportTournaments, saveSportTournament } from '../../../utils/storage';
import { updateMatchInTournament } from '../../../utils/knockoutManager';
import { useAuth } from '../../../hooks/useAuth';
import { buildTournamentConvexPayload } from '../../../utils/tournamentSync';
import { useAppScoringPrompt } from '../components/AppScoringPrompt';
import { triggerConfetti } from '../utils/confetti';

const isTouchDevice = 'ontouchstart' in globalThis || navigator.maxTouchPoints > 0;

// Haptic feedback helper
const triggerHaptic = (pattern) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

export default function MonoSetsLiveScore() {
  const navigate = useNavigate();
  const { sport, id, matchId } = useParams();
  const { isAuthenticated } = useAuth();
  const saveMatchMutation = useMutation(api.matches.save);
  const navigateToTournament = () => navigate(`/${sport}/tournament/${id}`);

  // Core state
  const [sportConfig, setSportConfig] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [match, setMatch] = useState(null);

  // Scoring state
  const [currentSet, setCurrentSet] = useState(0);
  const [sets, setSets] = useState([{ score1: 0, score2: 0, completed: false }]);
  const [history, setHistory] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [sidesSwapped, setSidesSwapped] = useState(false);
  const [saveWarning, setSaveWarning] = useState('');
  const scoringPrompt = useAppScoringPrompt();
  const isInteractionLocked = scoringPrompt.isInteractionLocked;
  const [servingTeam, setServingTeam] = useState(1);
  const [scoringMode, setScoringMode] = useState('rally');

  // Animation state
  const [showSetWon, setShowSetWon] = useState(false);
  const [setWonTeam, setSetWonTeam] = useState('');
  const [scoreAnimKey, setScoreAnimKey] = useState({ left: 0, right: 0 });

  // Debounce ref for rapid clicks
  const lastClickRef = useRef(0);
  const isKnockoutRef = useRef(false);

  const saveTournamentToConvex = (updatedTournament) => {
    if (!isAuthenticated || !updatedTournament) return;
    const savedMatch = [...(updatedTournament.matches || []), ...(updatedTournament.knockoutMatches || [])]
      .find((m) => m.id === matchId || m.id === Number(matchId));
    if (!savedMatch) return;
    try {
      const payload = buildTournamentConvexPayload({
        sportId: sport,
        tournament: updatedTournament,
        match: savedMatch,
      });
      saveMatchMutation(payload).catch(() => {});
    } catch {
      // Local save is primary; sync failures are non-blocking.
    }
  };

  // Load tournament and match
  useEffect(() => {
    const config = getSportById(sport);
    if (!config) return;

    const tournaments = loadSportTournaments(config.storageKey);
    const found = tournaments.find(t => t.id === Number(id));
    if (!found) return;

    let foundMatch = found.matches.find(m => m.id === matchId);
    if (!foundMatch) {
      foundMatch = (found.knockoutMatches || []).find(m => m.id === matchId);
      if (foundMatch) isKnockoutRef.current = true;
    }
    if (!foundMatch) return;

    setSportConfig(config);
    setTournament(found);
    setMatch(foundMatch);
    const supportedModes = config?.config?.scoringModes;
    const defaultScoringMode = (Array.isArray(supportedModes) && supportedModes.includes(config?.config?.defaultScoringMode))
      ? config.config.defaultScoringMode
      : (config?.config?.scoringType === 'side-out' ? 'side-out' : 'rally');
    const loadedMode = foundMatch.scoringMode
      || foundMatch.draftState?.scoringMode
      || foundMatch.format?.scoringMode
      || defaultScoringMode;
    const validMode = Array.isArray(supportedModes) && supportedModes.length > 0
      ? (supportedModes.includes(loadedMode) ? loadedMode : defaultScoringMode)
      : loadedMode;
    setScoringMode(validMode);
    setServingTeam(foundMatch.draftState?.servingTeam || 1);

    // Initialize from existing score if editing
    if (foundMatch.sets?.length > 0 && !foundMatch.draftState) {
      setSets(foundMatch.sets.map(s => ({ ...s, completed: s.completed || false })));
      const lastSetIndex = foundMatch.sets.length - 1;
      setCurrentSet(lastSetIndex);
    }

    // Restore from draft if exists
    if (foundMatch.draftState) {
      setSets(foundMatch.draftState.sets);
      setCurrentSet(foundMatch.draftState.currentSet);
      setHistory(foundMatch.draftState.history || []);
      if (foundMatch.draftState.servingTeam) setServingTeam(foundMatch.draftState.servingTeam);
      if (foundMatch.draftState.scoringMode) setScoringMode(foundMatch.draftState.scoringMode);
    }
  }, [sport, id, matchId]);

  // Effective format: use knockout format for knockout matches
  const effectiveFormat = isKnockoutRef.current && tournament?.knockoutConfig?.format
    ? tournament.knockoutConfig.format
    : tournament?.format;

  // Check if current set is complete
  const checkSetComplete = (set) => {
    if (!sportConfig) return false;

    const { winBy, maxPoints } = sportConfig.config;
    const max = Math.max(set.score1, set.score2);
    const min = Math.min(set.score1, set.score2);

    // Default to best-of if type not specified (backwards compatibility)
    const formatType = effectiveFormat.type || 'best-of';

    // Single-set format
    if (formatType === 'single') {
      const target = effectiveFormat.points;
      if (max < target) return false;
      if (max - min < winBy) return false;
      if (maxPoints && max >= maxPoints && max > min) return true;
      return true;
    }

    // Best-of format
    const { pointsPerSet, deciderPoints } = sportConfig.config;
    const isDecider = effectiveFormat.sets > 1 && currentSet === (effectiveFormat.sets - 1);
    const target = isDecider && deciderPoints ? deciderPoints : (effectiveFormat.points || pointsPerSet);

    // Must reach target
    if (max < target) return false;

    // Must win by N
    if (max - min < winBy) return false;

    // Badminton cap at 30
    if (maxPoints && max >= maxPoints && max > min) return true;

    return true;
  };

  const getCurrentSetTarget = (setIndex, format) => {
    if (!sportConfig) return 0;
    const formatType = format.type || 'best-of';
    if (formatType === 'single') return format.points;
    const { pointsPerSet, deciderPoints } = sportConfig.config;
    const isDecider = format.sets > 1 && setIndex === (format.sets - 1);
    return isDecider && deciderPoints ? deciderPoints : (format.points || pointsPerSet);
  };

  const rotateServeAfterPoint = (setScore) => {
    const rotation = sportConfig?.config?.serviceRotation;
    if (!rotation) return;
    if (rotation === 1) {
      setServingTeam((prev) => (prev === 1 ? 2 : 1));
      return;
    }
    const target = getCurrentSetTarget(currentSet, effectiveFormat);
    const totalPoints = (setScore?.score1 || 0) + (setScore?.score2 || 0);
    const atDeuce = (setScore?.score1 || 0) >= target - 1 && (setScore?.score2 || 0) >= target - 1;
    if (atDeuce) {
      setServingTeam((prev) => (prev === 1 ? 2 : 1));
      return;
    }
    if (totalPoints % rotation === 0) {
      setServingTeam((prev) => (prev === 1 ? 2 : 1));
    }
  };

  // Add point
  const addPoint = (team) => {
    if (!sportConfig || !tournament || isInteractionLocked) return;

    // Debounce rapid clicks
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;

    // Don't allow scoring on completed sets
    if (sets[currentSet]?.completed) return;

    // Haptic feedback: short pulse on point scored
    triggerHaptic(50);

    // Save to history BEFORE modifying
    setHistory(prev => [...prev, {
      timestamp: Date.now(),
      sets: structuredClone(sets),
      currentSet,
      servingTeam,
      scoringMode,
    }].slice(-100)); // Keep last 100

    setHasChanges(true);
    setScoreAnimKey(prev => ({ ...prev, [team === 1 ? 'left' : 'right']: (prev[team === 1 ? 'left' : 'right'] || 0) + 1 }));

    // Side-out scoring: non-serving team tap switches serve without adding a point.
    if (scoringMode === 'side-out' && team !== servingTeam) {
      setServingTeam(team);
      return;
    }

    setSets(prevSets => {
      const newSets = prevSets.map(s => ({ ...s }));
      const scoreKey = team === 1 ? 'score1' : 'score2';
      newSets[currentSet][scoreKey]++;
      if (scoringMode !== 'side-out') {
        rotateServeAfterPoint(newSets[currentSet]);
      }

      // Check if set complete
      const isComplete = checkSetComplete(newSets[currentSet]);
      if (isComplete) {
        newSets[currentSet].completed = true;

        // Haptic feedback: double pulse for set won
        triggerHaptic([50, 100, 50]);

        // Show set won notification
        const winnerId = newSets[currentSet].score1 > newSets[currentSet].score2 ? match.team1Id : match.team2Id;
        const winningTeam = tournament.teams.find(t => t.id === winnerId)?.name;

        setSetWonTeam(winningTeam || `Team ${team}`);
        setShowSetWon(true);
        setTimeout(() => setShowSetWon(false), 1500);

        const formatType = effectiveFormat.type || 'best-of';

        // Single-set format: match ends after first set
        if (formatType === 'single') {
          triggerConfetti();
          triggerHaptic([100, 100, 100, 100, 100]); // Victory pattern
          return newSets;
        }

        // Best-of format: check if match complete
        const t1SetsWon = newSets.filter(s => s.completed && s.score1 > s.score2).length;
        const t2SetsWon = newSets.filter(s => s.completed && s.score2 > s.score1).length;
        const setsToWin = Math.ceil(effectiveFormat.sets / 2);

        if (t1SetsWon >= setsToWin || t2SetsWon >= setsToWin) {
          // Match complete - trigger confetti
          triggerConfetti();
          triggerHaptic([100, 100, 100, 100, 100]); // Victory pattern
          return newSets;
        }

        // Start next set
        if (currentSet < effectiveFormat.sets - 1) {
          newSets.push({ score1: 0, score2: 0, completed: false });
          setCurrentSet(prev => prev + 1);
        }
      }

      return newSets;
    });
  };

  // Undo last action
  const undo = () => {
    if (history.length === 0 || isInteractionLocked) return;

    const last = history[history.length - 1];
    setSets(last.sets);
    setCurrentSet(last.currentSet);
    if (last.servingTeam) setServingTeam(last.servingTeam);
    if (last.scoringMode) setScoringMode(last.scoringMode);
    setHistory(prev => prev.slice(0, -1));
  };

  // Save draft (in-progress match)
  const saveDraft = () => {
    if (isInteractionLocked) return;

    const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
      ...m,
      status: 'in-progress',
      format: { ...(m.format || effectiveFormat || {}), scoringMode },
      draftState: {
        currentSet,
        sets: structuredClone(sets),
        history: structuredClone(history.slice(-50)),
        servingTeam,
        scoringMode,
        savedAt: new Date().toISOString(),
      },
    }));

    const ok = saveSportTournament(sportConfig.storageKey, updatedTournament);
    if (!ok) {
      setSaveWarning('Save failed - storage may be full. Export your data.');
      return;
    }
    setSaveWarning('');

    setHasChanges(false);
    scoringPrompt.scheduleDraftRedirect(navigateToTournament);
  };

  // Save match and return
  const saveMatch = () => {
    if (isInteractionLocked) return;

    // Save all sets that have any score (including in-progress)
    const setsToSave = sets
      .filter(s => s.score1 > 0 || s.score2 > 0)
      .map(s => ({ score1: s.score1, score2: s.score2, completed: s.completed || false }));

    // Count completed sets to determine match status
    const completedSets = sets.filter(s => s.completed);
    const t1SetsWon = completedSets.filter(s => s.score1 > s.score2).length;
    const t2SetsWon = completedSets.filter(s => s.score2 > s.score1).length;

    const formatType = effectiveFormat.type || 'best-of';
    let isMatchComplete;
    if (formatType === 'single') {
      // Single-set format: match is complete when the one set is done
      isMatchComplete = completedSets.length > 0;
    } else {
      const setsToWin = Math.ceil(effectiveFormat.sets / 2);
      isMatchComplete = t1SetsWon >= setsToWin || t2SetsWon >= setsToWin;
    }

    const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
      ...m,
      sets: setsToSave,
      status: isMatchComplete ? 'completed' : 'in-progress',
      winner: isMatchComplete ? (t1SetsWon > t2SetsWon ? m.team1Id : m.team2Id) : null,
      format: { ...(m.format || effectiveFormat || {}), scoringMode },
      setsWon1: t1SetsWon,
      setsWon2: t2SetsWon,
      scoringMode,
      completedAt: isMatchComplete ? new Date().toISOString() : m.completedAt,
      draftState: isMatchComplete ? undefined : {
        currentSet,
        sets: structuredClone(sets),
        history: structuredClone(history.slice(-50)),
        servingTeam,
        scoringMode,
        savedAt: new Date().toISOString(),
      },
    }));

    const ok = saveSportTournament(sportConfig.storageKey, updatedTournament);
    if (!ok) {
      setSaveWarning('Save failed - storage may be full. Export your data.');
      return;
    }
    setSaveWarning('');
    if (isMatchComplete) {
      saveTournamentToConvex(updatedTournament);
    }

    navigate(`/${sport}/tournament/${id}`);
  };

  // Keyboard shortcuts (skip on touch-only devices)
  useEffect(() => {
    if (isTouchDevice) return;

    const handleKeyPress = (e) => {
      if (isInteractionLocked) return;
      // Ignore if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'q':
          addPoint(leftTeam);
          break;
        case 'p':
          addPoint(rightTeam);
          break;
        case 'u':
          undo();
          break;
        default:
          break;
      }
    };

    globalThis.addEventListener('keydown', handleKeyPress);
    return () => globalThis.removeEventListener('keydown', handleKeyPress);
  }, [currentSet, sets, history, sportConfig, tournament, sidesSwapped, servingTeam, scoringMode, effectiveFormat, isInteractionLocked]); // Dependencies for addPoint/undo

  // Cancel and return
  const handleCancel = () => scoringPrompt.cancelOrNavigate(hasChanges, navigateToTournament);
  const confirmPendingPrompt = () => scoringPrompt.confirmDiscard(navigateToTournament);

  if (!sportConfig || !tournament || !match) {
    return <div className="min-h-screen px-6 py-10 flex items-center justify-center">
      <p style={{ color: 'var(--se-color-ink-muted)' }}>Loading...</p>
    </div>;
  }

  const getTeamName = (teamId) => {
    return tournament.teams.find(t => t.id === teamId)?.name || 'Unknown';
  };

  const team1Name = getTeamName(match.team1Id);
  const team2Name = getTeamName(match.team2Id);

  // Side swap helpers
  const leftTeam = sidesSwapped ? 2 : 1;
  const rightTeam = sidesSwapped ? 1 : 2;
  const leftName = sidesSwapped ? team2Name : team1Name;
  const rightName = sidesSwapped ? team1Name : team2Name;
  const leftScore = sidesSwapped ? (sets[currentSet]?.score2 || 0) : (sets[currentSet]?.score1 || 0);
  const rightScore = sidesSwapped ? (sets[currentSet]?.score1 || 0) : (sets[currentSet]?.score2 || 0);
  // Score colour follows the lead: ahead = green, tied = brown (both), trailing = ink.
  const teamAccent = (mine, other) =>
    mine > other ? 'var(--primary)' : mine === other ? 'var(--se-color-warning)' : 'var(--se-color-ink)';
  const availableScoringModes = effectiveFormat?.scoringModes || sportConfig?.config?.scoringModes || ['rally'];
  const showServeIndicator = scoringMode === 'side-out' || Boolean(sportConfig?.config?.serviceRotation);
  const leftServing = sidesSwapped ? servingTeam === 2 : servingTeam === 1;
  const rightServing = sidesSwapped ? servingTeam === 1 : servingTeam === 2;
  const canToggleScoringMode = availableScoringModes.includes('side-out') && availableScoringModes.includes('rally');

  const { pointsPerSet, deciderPoints, winBy } = sportConfig.config;
  const formatType = effectiveFormat.type || 'best-of';
  const isDeciderSet = effectiveFormat.sets > 1 && currentSet === (effectiveFormat.sets - 1);
  let targetPoints;
  if (formatType === 'single') {
    targetPoints = effectiveFormat.points;
  } else if (isDeciderSet && deciderPoints) {
    targetPoints = deciderPoints;
  } else {
    targetPoints = effectiveFormat.points || pointsPerSet;
  }
  const isCurrentSetComplete = sets[currentSet]?.completed || false;
  const canScoreCurrentSet = !isCurrentSetComplete && !isInteractionLocked;
  const scoreCardAssistiveHint = isInteractionLocked
    ? 'Scoring is temporarily locked'
    : (isCurrentSetComplete ? 'Set complete' : 'Press Enter or click to add point');
  const scoreCardVisualHint = isInteractionLocked
    ? 'Scoring locked'
    : (isCurrentSetComplete ? 'Set complete' : 'Tap to score');
  const handleSwapSides = () => {
    if (isInteractionLocked) return;
    setSidesSwapped(prev => !prev);
  };
  const handleToggleScoringMode = () => {
    if (isInteractionLocked) return;
    const next = scoringMode === 'side-out' ? 'rally' : 'side-out';
    if (!availableScoringModes.includes(next)) return;
    setScoringMode(next);
    setServingTeam(1);
  };

  return (
    <div className="mono-scorer-screen mono-arena-screen">
      <div className="mono-scorer-shell">
        <h1 className="sr-only">{sportConfig?.name || 'Sport'} match scorer</h1>
        {saveWarning && (
          <div className="mono-alert mono-alert-danger mb-4">
            {saveWarning}
          </div>
        )}
        {scoringPrompt.renderPrompt(confirmPendingPrompt)}
        {/* Top bar */}
        <div className="mono-scorer-topbar">
          <span className="text-sm font-swiss" style={{ color: 'var(--se-color-ink-muted)' }}>
            {sportConfig?.name || 'Match'}
          </span>
          <div className="mono-scorer-topbar-actions">
            <button
              type="button"
              onClick={handleSwapSides}
              disabled={isInteractionLocked}
              className="mono-btn"
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                minWidth: 0,
                touchAction: 'manipulation',
                borderColor: sidesSwapped ? 'var(--primary)' : 'var(--se-color-line)',
                color: sidesSwapped ? 'var(--primary)' : 'var(--se-color-ink)',
                opacity: isInteractionLocked ? 0.45 : 1,
              }}
              title="Swap sides"
            >
              Swap
            </button>
            <span className={`mono-badge ${isCurrentSetComplete ? 'mono-badge-final' : 'mono-badge-live'}`}>
              {formatType === 'single' ? 'Single Set' : `Set ${currentSet + 1} of ${effectiveFormat.sets}`}
            </span>
            {canToggleScoringMode && (
              <button
                type="button"
                onClick={handleToggleScoringMode}
                disabled={isInteractionLocked}
                className="mono-btn"
                style={{ padding: '6px 10px', fontSize: '0.75rem', opacity: isInteractionLocked ? 0.45 : 1 }}
                title="Toggle scoring model"
              >
                {scoringMode === 'side-out' ? 'Side-out' : 'Rally'}
              </button>
            )}
          </div>
        </div>

        {/* ARIA live region for score announcements */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {team1Name}: {sets[currentSet]?.score1 || 0}. {team2Name}: {sets[currentSet]?.score2 || 0}. Set {currentSet + 1} of {effectiveFormat?.sets || 0}.
        </div>

        {/* Score halves — same arena structure as the quick scorer: big tabular
            number, accent-coloured name (with serving dot), a 2px leading underline,
            and a pop on each point. */}
        <div className="mono-arena-grid">
          {/* Left team */}
          <div className="mono-arena-col">
            <button
              type="button"
              onClick={() => canScoreCurrentSet && addPoint(leftTeam)}
              disabled={!canScoreCurrentSet}
              data-leading={leftScore > rightScore ? 'true' : 'false'}
              aria-label={`${leftName}: ${leftScore} points. ${scoreCardAssistiveHint}`}
              className="mono-arena-half"
              style={{ '--score-accent': teamAccent(leftScore, rightScore), touchAction: 'manipulation', opacity: canScoreCurrentSet ? 1 : 0.6 }}
            >
              <span className="mono-arena-overline" style={{ color: teamAccent(leftScore, rightScore) }}>
                {showServeIndicator && leftServing ? '● ' : ''}{leftName}
              </span>
              <span
                key={scoreAnimKey[sidesSwapped ? 'right' : 'left'] || 0}
                className="mono-arena-num mono-score mono-score-animate mono-scorer-score-value"
                style={{ color: teamAccent(leftScore, rightScore) }}
              >
                {leftScore}
              </span>
              <span className="mono-arena-hint">{scoreCardVisualHint}</span>
            </button>
          </div>

          {/* Right team */}
          <div className="mono-arena-col">
            <button
              type="button"
              onClick={() => canScoreCurrentSet && addPoint(rightTeam)}
              disabled={!canScoreCurrentSet}
              data-leading={rightScore > leftScore ? 'true' : 'false'}
              aria-label={`${rightName}: ${rightScore} points. ${scoreCardAssistiveHint}`}
              className="mono-arena-half"
              style={{ '--score-accent': teamAccent(rightScore, leftScore), touchAction: 'manipulation', opacity: canScoreCurrentSet ? 1 : 0.6 }}
            >
              <span className="mono-arena-overline" style={{ color: teamAccent(rightScore, leftScore) }}>
                {showServeIndicator && rightServing ? '● ' : ''}{rightName}
              </span>
              <span
                key={scoreAnimKey[sidesSwapped ? 'left' : 'right'] || 0}
                className="mono-arena-num mono-score mono-score-animate mono-scorer-score-value"
                style={{ color: teamAccent(rightScore, leftScore) }}
              >
                {rightScore}
              </span>
              <span className="mono-arena-hint">{scoreCardVisualHint}</span>
            </button>
          </div>
        </div>

        {/* Rules info */}
        <p className="text-xs text-center mb-2" style={{ color: 'var(--se-color-ink-faint)' }}>
          {targetPoints} points to win &middot; Win by {winBy}
        </p>
        {!isTouchDevice && (
          <p className="text-xs text-center mb-6" style={{ color: 'var(--se-color-ink-faint)' }}>
            Keyboard: Q = {leftName} &middot; P = {rightName} &middot; U = Undo
          </p>
        )}

        {/* Set history */}
        {sets.some(s => s.completed) && (
          <div className="mono-score-history-strip py-4 text-center text-sm mb-6">
            <div className="flex justify-center gap-3 flex-wrap">
              {sets.filter(s => s.completed).map((s, i) => (
                <span key={`completed-set-${i}-${s.score1}-${s.score2}`} className="font-mono">
                  Set {i + 1}: {s.score1}-{s.score2}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bottom bar */}
        <div className="mono-control-strip mono-scorer-control-strip pt-4">
          <button
            onClick={saveMatch}
            disabled={isInteractionLocked}
            className="mono-btn-primary w-full mb-3"
            style={{ padding: '12px', fontSize: '0.875rem', opacity: isInteractionLocked ? 0.45 : 1 }}
          >
            Save &amp; Return
          </button>
          <div className="flex gap-2">
            <button
              onClick={undo}
              disabled={history.length === 0 || isInteractionLocked}
              className="mono-btn flex-1"
              style={{ padding: '8px', fontSize: '0.8125rem', opacity: history.length === 0 || isInteractionLocked ? 0.4 : 1, touchAction: 'manipulation' }}
            >
              Undo
            </button>
            <button
              onClick={handleCancel}
              disabled={isInteractionLocked}
              className="mono-btn flex-1"
              style={{ padding: '8px', fontSize: '0.8125rem', opacity: isInteractionLocked ? 0.45 : 1 }}
            >
              Cancel
            </button>
            {hasChanges && (
              <button
                onClick={saveDraft}
                disabled={isInteractionLocked}
                className="mono-btn flex-1"
                style={{ padding: '8px', fontSize: '0.8125rem', borderColor: 'var(--primary)', color: 'var(--primary)', opacity: isInteractionLocked ? 0.45 : 1 }}
              >
                Save Draft
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Set Won Notification */}
      {showSetWon && (
        <div className="mono-set-won mono-set-won-animate">
          {setWonTeam} wins Set {currentSet}!
        </div>
      )}
    </div>
  );
}

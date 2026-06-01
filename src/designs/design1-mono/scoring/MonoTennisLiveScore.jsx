import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { getSportById } from '../../../models/sportRegistry';
import { clearData, loadData, loadSportTournaments, saveData, saveSportTournament } from '../../../utils/storage';
import { updateMatchInTournament } from '../../../utils/knockoutManager';
import { useAuth } from '../../../hooks/useAuth';
import { buildTournamentConvexPayload } from '../../../utils/tournamentSync';
import {
  buildTennisQuickHistoryEntry,
  getTennisQuickDraftKey,
} from '../../../utils/tennisQuickMatch';
import { useAppScoringPrompt } from '../components/AppScoringPrompt';
import RouteRecoveryActions from '../components/RouteRecoveryActions';
import { triggerConfetti } from '../utils/confetti';

const QUICK_MATCHES_KEY = 'se_quickmatches';

// Haptic feedback helper
const triggerHaptic = (pattern) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

const TENNIS_CONFETTI = {
  colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe'],
  includeDuration: false,
};

// Convert point value to tennis display (0→0, 1→15, 2→30, 3→40)
const pointToDisplay = (points) => {
  const map = { 0: '0', 1: '15', 2: '30', 3: '40' };
  return map[points] || points;
};

// Show game won notification
const showGameWon = (teamName, gameNumber, setNumber) => {
  const notification = document.createElement('div');
  notification.className = 'mono-set-won mono-set-won-animate';
  notification.textContent = `${teamName} wins Game ${gameNumber} (Set ${setNumber})!`;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 1500);
};

// Show set won notification
const showSetWon = (teamName, setNumber) => {
  const notification = document.createElement('div');
  notification.className = 'mono-set-won mono-set-won-animate';
  notification.textContent = `${teamName} wins Set ${setNumber}!`;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 1500);
};

// Build a blank set object
const makeBlankSet = () => ({
  games1: 0,
  games2: 0,
  points1: 0,
  points2: 0,
  isDeuce: false,
  advantage: null,
  isTiebreak: false,
  tiebreakPoints1: 0,
  tiebreakPoints2: 0,
  completed: false,
});

// Build the initial sets array for a match — S7723: use new Array()
const buildInitialSets = (numSets) =>
  new Array(numSets).fill(null).map(() => makeBlankSet());

// Check whether a set is complete
const isSetComplete = (set) => {
  if (set.isTiebreak) {
    const tb1 = set.tiebreakPoints1;
    const tb2 = set.tiebreakPoints2;
    return (tb1 >= 7 && tb1 - tb2 >= 2) || (tb2 >= 7 && tb2 - tb1 >= 2);
  }
  const g1 = set.games1;
  const g2 = set.games2;
  if (g1 === 6 && g2 === 6) return false; // Will switch to tiebreak
  return (g1 >= 6 && g1 - g2 >= 2) || (g2 >= 6 && g2 - g1 >= 2);
};

// Count sets won by each team from a list of completed sets
const countSetsWon = (completedSets) => {
  let team1Sets = 0;
  let team2Sets = 0;
  completedSets.forEach(set => {
    const team1Wins = set.isTiebreak
      ? set.tiebreakPoints1 > set.tiebreakPoints2
      : set.games1 > set.games2;
    if (team1Wins) team1Sets++;
    else team2Sets++;
  });
  return { team1Sets, team2Sets };
};

// Apply deuce/advantage logic to a set in-place — extracted to reduce cognitive complexity
const applyDeuceLogic = (set, team1Name, team2Name, currentSetNum) => {
  const p1 = set.points1;
  const p2 = set.points2;

  set.isDeuce = true;

  if (p1 === p2) {
    set.advantage = null;
  } else if (p1 > p2) {
    set.advantage = 1;
  } else {
    set.advantage = 2;
  }

  if (p1 - p2 >= 2) {
    set.games1++;
    set.points1 = 0;
    set.points2 = 0;
    set.isDeuce = false;
    set.advantage = null;
    triggerHaptic([50, 100, 50]);
    showGameWon(team1Name, set.games1, currentSetNum);
  } else if (p2 - p1 >= 2) {
    set.games2++;
    set.points1 = 0;
    set.points2 = 0;
    set.isDeuce = false;
    set.advantage = null;
    triggerHaptic([50, 100, 50]);
    showGameWon(team2Name, set.games2, currentSetNum);
  }
};

// Apply regular (no-deuce) game win logic to a set in-place
const applyRegularGameLogic = (set, team1Name, team2Name, currentSetNum) => {
  const p1 = set.points1;
  const p2 = set.points2;

  if (p1 >= 4 && p1 - p2 >= 2) {
    set.games1++;
    set.points1 = 0;
    set.points2 = 0;
    triggerHaptic([50, 100, 50]);
    showGameWon(team1Name, set.games1, currentSetNum);
  } else if (p2 >= 4 && p2 - p1 >= 2) {
    set.games2++;
    set.points1 = 0;
    set.points2 = 0;
    triggerHaptic([50, 100, 50]);
    showGameWon(team2Name, set.games2, currentSetNum);
  }
};

// Process a tiebreak point and return updated sets + optional next set index
const processTiebreakPoint = (newSets, setIdx, team, team1Name, team2Name, advanceFn) => {
  const set = newSets[setIdx];
  if (team === 1) set.tiebreakPoints1++;
  else set.tiebreakPoints2++;

  if (isSetComplete(set)) {
    set.completed = true;
    triggerHaptic([50, 100, 50]);
    const winner = set.tiebreakPoints1 > set.tiebreakPoints2 ? team1Name : team2Name;
    showSetWon(winner, setIdx + 1);
    advanceFn(setIdx, newSets.length);
  }
  return newSets;
};

// Process a regular-game point and return updated sets
const processRegularPoint = (newSets, setIdx, team, team1Name, team2Name, advanceFn) => {
  const set = newSets[setIdx];
  if (team === 1) set.points1++;
  else set.points2++;

  const p1 = set.points1;
  const p2 = set.points2;

  if (p1 >= 3 && p2 >= 3) {
    applyDeuceLogic(set, team1Name, team2Name, setIdx + 1);
  } else if (p1 >= 4 || p2 >= 4) {
    applyRegularGameLogic(set, team1Name, team2Name, setIdx + 1);
  }

  // 6-6 → tiebreak
  if (set.games1 === 6 && set.games2 === 6 && !set.isTiebreak) {
    set.isTiebreak = true;
    set.tiebreakPoints1 = 0;
    set.tiebreakPoints2 = 0;
  }

  if (isSetComplete(set)) {
    set.completed = true;
    triggerHaptic([50, 100, 50]);
    const winner = set.games1 > set.games2 ? team1Name : team2Name;
    showSetWon(winner, setIdx + 1);
    advanceFn(setIdx, newSets.length);
  }
  return newSets;
};

// Compute the score display values for the current set
const computeScoreDisplay = (setData) => {
  if (setData.isTiebreak) {
    return { score1: setData.tiebreakPoints1, score2: setData.tiebreakPoints2 };
  }
  if (setData.isDeuce) {
    if (setData.advantage === 1) return { score1: 'AD', score2: '40' };
    if (setData.advantage === 2) return { score1: '40', score2: 'AD' };
    return { score1: '40', score2: '40' };
  }
  return {
    score1: pointToDisplay(setData.points1),
    score2: pointToDisplay(setData.points2),
  };
};

// Apply loaded match data to component state — extracted to cut component cognitive complexity
const applyLoadedMatch = (foundMatch, found, setSets, setCurrentSet, setHistory) => {
  if (foundMatch.sets?.length > 0 && !foundMatch.draftState) {
    setSets(foundMatch.sets);
    const lastSetIndex = foundMatch.sets.findIndex(s => !s.completed);
    setCurrentSet(lastSetIndex >= 0 ? lastSetIndex : foundMatch.sets.length - 1);
  } else if (foundMatch.draftState) {
    setSets(foundMatch.draftState.sets);
    setCurrentSet(foundMatch.draftState.currentSet);
    setHistory(foundMatch.draftState.history || []);
  } else {
    const numSets = found.format?.sets || 3;
    setSets(buildInitialSets(numSets));
  }
};

// Build keyboard handler for scoring shortcuts
const makeKeyHandler = (addPoint, undo, leftTeam, rightTeam) => (e) => {
  switch (e.key.toLowerCase()) {
    case 'q': addPoint(leftTeam); break;
    case 'p': addPoint(rightTeam); break;
    case 'u': undo(); break;
    default: break;
  }
};

export default function MonoTennisLiveScore({ storageMode = 'tournament' }) {
  const navigate = useNavigate();
  const { sport, id, matchId } = useParams();
  const isQuickMatch = storageMode === 'quick';
  const quickDraftKey = isQuickMatch ? getTennisQuickDraftKey(matchId) : null;
  const lastClickRef = useRef(0);
  const { isAuthenticated } = useAuth();
  const saveMatchMutation = useMutation(api.matches.save);
  const navigateBack = () => navigate(isQuickMatch ? `/${sport}/quick` : `/${sport}/tournament/${id}`);

  // Core state
  const [sportConfig, setSportConfig] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [match, setMatch] = useState(null);

  const [sets, setSets] = useState(() => buildInitialSets(3));
  const [currentSet, setCurrentSet] = useState(0);
  const [history, setHistory] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [sidesSwapped, setSidesSwapped] = useState(false);
  const [scoreAnimKey, setScoreAnimKey] = useState({ left: 0, right: 0 });
  const [saveWarning, setSaveWarning] = useState('');
  const scoringPrompt = useAppScoringPrompt();

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
      // Local save is primary; cloud sync failures are non-blocking.
    }
  };

  // Load tournament/quick match data
  useEffect(() => {
    const config = getSportById(sport);
    if (!config) return;

    if (isQuickMatch) {
      const draft = loadData(getTennisQuickDraftKey(matchId), null);
      if (!draft) return;
      setSportConfig(config);
      setTournament(null);
      setMatch(draft);
      const draftSets = Array.isArray(draft.draftState?.sets) ? draft.draftState.sets : draft.sets;
      if (Array.isArray(draftSets)) {
        setSets(draftSets);
        const lastSetIndex = draftSets.findIndex(s => !s.completed);
        setCurrentSet(lastSetIndex >= 0 ? lastSetIndex : draftSets.length - 1);
      } else {
        setSets(buildInitialSets(draft.format?.sets || config.config?.sets || 3));
        setCurrentSet(0);
      }
      setHistory(draft.draftState?.history || []);
      return;
    }

    const tournaments = loadSportTournaments(config.storageKey);
    const found = tournaments.find(t => t.id === Number(id));
    if (!found) return;

    const foundMatch = found.matches.find(m => m.id === matchId)
      || (found.knockoutMatches || []).find(m => m.id === matchId);
    if (!foundMatch) return;

    setSportConfig(config);
    setTournament(found);
    setMatch(foundMatch);
    applyLoadedMatch(foundMatch, found, setSets, setCurrentSet, setHistory);
  }, [sport, id, matchId, isQuickMatch]);

  // Get team names
  const team1 = tournament?.teams?.find(t => t.id === match?.team1Id);
  const team2 = tournament?.teams?.find(t => t.id === match?.team2Id);
  const team1Name = isQuickMatch ? (match?.team1Name || match?.team1 || 'Team 1') : (team1?.name || 'Team 1');
  const team2Name = isQuickMatch ? (match?.team2Name || match?.team2 || 'Team 2') : (team2?.name || 'Team 2');

  // Side swap helpers
  const leftName = sidesSwapped ? team2Name : team1Name;
  const rightName = sidesSwapped ? team1Name : team2Name;

  // Check if match is complete
  const isMatchComplete = useMemo(() => {
    const completedSets = sets.filter(s => s.completed);
    const setsToWin = Math.ceil(sets.length / 2);
    const { team1Sets, team2Sets } = countSetsWon(completedSets);
    return team1Sets >= setsToWin || team2Sets >= setsToWin;
  }, [sets]);

  // Add point to team
  const addPoint = (team) => {
    if (scoringPrompt.isInteractionLocked) return;

    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;
    if (isMatchComplete) return;

    setHistory(prev => [...prev, {
      timestamp: Date.now(),
      sets: structuredClone(sets),
      currentSet,
    }].slice(-100));

    // advanceFn is called by the process helpers when a set completes
    const advanceFn = (setIdx, totalSets) => {
      if (setIdx < totalSets - 1) setCurrentSet(setIdx + 1);
    };

    setSets(prevSets => {
      const newSets = prevSets.map(s => ({ ...s }));
      const set = newSets[currentSet];
      if (set.completed) return prevSets;

      triggerHaptic([50]);

      if (set.isTiebreak) {
        return processTiebreakPoint(newSets, currentSet, team, team1Name, team2Name, advanceFn);
      }
      return processRegularPoint(newSets, currentSet, team, team1Name, team2Name, advanceFn);
    });

    setHasChanges(true);
    setScoreAnimKey(prev => ({ ...prev, [team === 1 ? 'left' : 'right']: (prev[team === 1 ? 'left' : 'right'] || 0) + 1 }));
  };

  // Undo last action
  const undo = () => {
    if (history.length === 0 || scoringPrompt.isInteractionLocked) return;

    const lastState = history[history.length - 1];
    setSets(lastState.sets);
    setCurrentSet(lastState.currentSet);
    setHistory(prev => prev.slice(0, -1));
    setHasChanges(true);
  };

  // Keyboard shortcuts (desktop only)
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    const hasTouch = 'ontouchstart' in globalThis || navigator.maxTouchPoints > 0;
    setIsTouchDevice(hasTouch);
  }, []);

  useEffect(() => {
    if (isTouchDevice) return;

    const leftTeam = sidesSwapped ? 2 : 1;
    const rightTeam = sidesSwapped ? 1 : 2;
    const handleKeyPress = (event) => {
      if (scoringPrompt.isInteractionLocked) return;
      makeKeyHandler(addPoint, undo, leftTeam, rightTeam)(event);
    };

    globalThis.addEventListener('keydown', handleKeyPress);
    return () => globalThis.removeEventListener('keydown', handleKeyPress);
  }, [currentSet, sets, history, sportConfig, tournament, sidesSwapped, isTouchDevice, scoringPrompt.isInteractionLocked]);

  // Save draft
  const saveDraft = () => {
    if (scoringPrompt.isInteractionLocked) return;

    if (isQuickMatch) {
      const ok = saveData(quickDraftKey, {
        ...match,
        sets,
        status: 'in-progress',
        draftState: {
          currentSet,
          sets,
          history,
          savedAt: new Date().toISOString(),
        },
      });
      if (!ok) {
        setSaveWarning('Save failed - storage may be full. Export your data.');
        return;
      }
      setSaveWarning('');
      setHasChanges(false);
      scoringPrompt.scheduleDraftRedirect(navigateBack);
      return;
    }

    const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
      ...m,
      sets,
      status: 'in-progress',
      draftState: {
        currentSet,
        sets,
        history,
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
    scoringPrompt.scheduleDraftRedirect(navigateBack);
  };

  const saveQuickMatch = () => {
    const completedAt = new Date().toISOString();
    const entry = buildTennisQuickHistoryEntry({
      match,
      sets,
      isComplete: isMatchComplete,
      completedAt,
    });

    if (!isMatchComplete) {
      const ok = saveData(quickDraftKey, {
        ...entry,
        sets,
        draftState: {
          currentSet,
          sets,
          history,
          savedAt: completedAt,
        },
      });
      if (!ok) {
        setSaveWarning('Save failed - storage may be full. Export your data.');
        return;
      }
      setSaveWarning('');
      scoringPrompt.scheduleDraftRedirect(navigateBack);
      return;
    }

    const quickMatches = loadData(QUICK_MATCHES_KEY, []);
    const withoutCurrent = quickMatches.filter((item) => String(item.id) !== String(match.id));
    const ok = saveData(QUICK_MATCHES_KEY, [...withoutCurrent, entry]);
    if (!ok) {
      setSaveWarning('Save failed - storage may be full. Export your data.');
      return;
    }

    clearData(quickDraftKey);
    setSaveWarning('');
    navigate('/history');
  };

  // Save match and return
  const saveMatch = () => {
    if (scoringPrompt.isInteractionLocked) return;

    if (isMatchComplete) {
      triggerConfetti(TENNIS_CONFETTI);
      triggerHaptic([100, 100, 100, 100, 100]);
    }

    if (isQuickMatch) {
      saveQuickMatch();
      return;
    }

    // S6660: flatten else-if instead of else { if }
    const { team1Sets: team1SetsWon, team2Sets: team2SetsWon } =
      countSetsWon(sets.filter(s => s.completed));

    let winner = null;
    if (team1SetsWon > team2SetsWon) winner = match.team1Id;
    else if (team2SetsWon > team1SetsWon) winner = match.team2Id;

    const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
      ...m,
      sets,
      status: isMatchComplete ? 'completed' : 'in-progress',
      winner,
      completedAt: isMatchComplete ? new Date().toISOString() : m.completedAt,
      draftState: isMatchComplete ? undefined : {
        currentSet,
        sets,
        history,
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

  // Cancel and discard changes
  const handleCancel = () => scoringPrompt.cancelOrNavigate(hasChanges, navigateBack);
  const confirmPendingPrompt = () => scoringPrompt.confirmDiscard(navigateBack);

  if ((!isQuickMatch && !tournament) || !match) {
    return (
      <RouteRecoveryActions
        eyebrow="Scorer recovery"
        title="Match not found"
        message="This tennis scorer link does not match a saved quick match or tournament match on this device."
        sportId="tennis"
        primaryLabel={isQuickMatch ? 'Back to Tennis setup' : 'Back to Tennis tournaments'}
        primaryPath={isQuickMatch ? '/tennis/quick' : '/tennis/tournament'}
      />
    );
  }

  const currentSetData = sets[currentSet];
  const isTiebreakMode = currentSetData?.isTiebreak;

  // Display score for current game/tiebreak
  const { score1: score1Display, score2: score2Display } = computeScoreDisplay(currentSetData);

  // Side swap derived display values
  const leftScoreDisplay = sidesSwapped ? score2Display : score1Display;
  const rightScoreDisplay = sidesSwapped ? score1Display : score2Display;
  const leftGames = sidesSwapped ? currentSetData.games2 : currentSetData.games1;
  const rightGames = sidesSwapped ? currentSetData.games1 : currentSetData.games2;
  const leftTeam = sidesSwapped ? 2 : 1;
  const rightTeam = sidesSwapped ? 1 : 2;
  const canScoreCurrentSet = !currentSetData.completed && !scoringPrompt.isInteractionLocked;
  const scoreCardAssistiveHint = scoringPrompt.isInteractionLocked
    ? 'Scoring is temporarily locked'
    : 'Press Enter or click to add point';
  const handleSwapSides = () => {
    if (scoringPrompt.isInteractionLocked) return;
    setSidesSwapped(s => !s);
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 mono-transition mono-visible">
      {saveWarning && (
        <div className="mono-alert mono-alert-danger mb-4">
          {saveWarning}
        </div>
      )}
      {scoringPrompt.renderPrompt(confirmPendingPrompt)}
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={handleCancel}
          disabled={scoringPrompt.isInteractionLocked}
          className="text-sm bg-transparent border-none cursor-pointer font-swiss"
          style={{ color: '#888', opacity: scoringPrompt.isInteractionLocked ? 0.45 : 1 }}
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSwapSides}
            disabled={scoringPrompt.isInteractionLocked}
            className="mono-btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              minWidth: 0,
              touchAction: 'manipulation',
              borderColor: sidesSwapped ? '#0066ff' : '#ddd',
              color: sidesSwapped ? '#0066ff' : '#111',
              opacity: scoringPrompt.isInteractionLocked ? 0.45 : 1,
            }}
            title="Swap sides"
          >
            Swap
          </button>
          <span
            className={`mono-badge ${isTiebreakMode ? 'mono-badge-paused' : 'mono-badge-live'}`}
          >
            {isTiebreakMode ? 'Tiebreak' : `Set ${currentSet + 1} of ${sets.length}`}
          </span>
          {isMatchComplete && (
            <span className="mono-badge mono-badge-final">Match Complete</span>
          )}
        </div>
      </div>

      {/* ARIA live region — S6819: use <output> instead of role="status" div */}
      <output aria-live="polite" aria-atomic="true" className="sr-only">
        {leftName}: {leftScoreDisplay}. {rightName}: {rightScoreDisplay}.
        {isTiebreakMode ? 'Tiebreak' : `Set ${currentSet + 1} of ${sets.length}`}.
      </output>

      {/* Score cards — S6819: use <button> instead of role="button" div */}
      <div className="mono-score-grid mb-8" style={{ minHeight: '250px' }}>
        {/* Left Team */}
        <button
          type="button"
          onClick={() => canScoreCurrentSet && addPoint(leftTeam)}
          aria-label={`${leftName}: ${leftScoreDisplay}. ${scoreCardAssistiveHint}`}
          disabled={!canScoreCurrentSet}
          className="flex-1 mono-score-pad flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
          style={{
            touchAction: 'manipulation',
            borderColor: canScoreCurrentSet ? '#0066ff' : '#ddd',
            opacity: canScoreCurrentSet ? 1 : 0.6,
          }}
        >
          <p className="text-sm uppercase tracking-widest font-normal" style={{ color: '#888' }}>
            {leftName}
          </p>
          <p
            key={scoreAnimKey[sidesSwapped ? 'right' : 'left'] || 0}
            className="text-7xl font-bold mono-score mono-score-animate font-mono"
            style={{ color: '#111' }}
          >
            {leftScoreDisplay}
          </p>
          <p className="text-xs" style={{ color: '#888' }}>
            Games: {leftGames}
          </p>
        </button>

        {/* Right Team */}
        <button
          type="button"
          onClick={() => canScoreCurrentSet && addPoint(rightTeam)}
          aria-label={`${rightName}: ${rightScoreDisplay}. ${scoreCardAssistiveHint}`}
          disabled={!canScoreCurrentSet}
          className="flex-1 mono-score-pad flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
          style={{
            touchAction: 'manipulation',
            borderColor: canScoreCurrentSet ? '#0066ff' : '#ddd',
            opacity: canScoreCurrentSet ? 1 : 0.6,
          }}
        >
          <p className="text-sm uppercase tracking-widest font-normal" style={{ color: '#888' }}>
            {rightName}
          </p>
          <p
            key={scoreAnimKey[sidesSwapped ? 'left' : 'right'] || 0}
            className="text-7xl font-bold mono-score mono-score-animate font-mono"
            style={{ color: '#111' }}
          >
            {rightScoreDisplay}
          </p>
          <p className="text-xs" style={{ color: '#888' }}>
            Games: {rightGames}
          </p>
        </button>
      </div>

      {/* Keyboard shortcuts hint (desktop only) */}
      {!isTouchDevice && (
        <p className="text-xs text-center mb-6" style={{ color: '#ccc' }}>
          Keyboard: Q = {leftName} · P = {rightName} · U = Undo
        </p>
      )}

      {/* Set history */}
      <div className="mb-8">
        <h3 className="text-xs uppercase tracking-widest font-normal mb-3" style={{ color: '#888' }}>
          Match Score
        </h3>
        <div className="flex flex-col gap-2">
          {sets.map((set, idx) => {
            const isActive = idx === currentSet;
            // S6479: use stable key derived from set label, not array index
            const setLabel = `Set ${idx + 1}`;
            const scoreDisplay = (set.isTiebreak && set.completed)
              ? `${set.games1}-${set.games2} (${set.tiebreakPoints1}-${set.tiebreakPoints2})`
              : `${set.games1}-${set.games2}`;

            return (
              <div
                key={setLabel}
                className="flex items-center justify-between px-4 py-2 mono-row-panel text-sm"
                style={{
                  borderColor: isActive ? '#0066ff' : '#eee',
                  backgroundColor: set.completed ? '#fafafa' : '#fff',
                }}
              >
                <span style={{ color: isActive ? '#0066ff' : '#888' }}>{setLabel}</span>
                <span className="font-mono font-bold" style={{ color: '#111' }}>
                  {scoreDisplay}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mono-control-strip pt-4">
        <button
          onClick={saveMatch}
          disabled={scoringPrompt.isInteractionLocked}
          className="mono-btn-primary w-full mb-3"
          style={{ padding: '12px', fontSize: '0.875rem', opacity: scoringPrompt.isInteractionLocked ? 0.45 : 1 }}
        >
          Save &amp; Return
        </button>
        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={history.length === 0 || scoringPrompt.isInteractionLocked}
            className="mono-btn flex-1"
            style={{ padding: '8px', fontSize: '0.8125rem', opacity: history.length === 0 || scoringPrompt.isInteractionLocked ? 0.4 : 1, touchAction: 'manipulation' }}
          >
            Undo
          </button>
          <button onClick={handleCancel} className="mono-btn flex-1" style={{ padding: '8px', fontSize: '0.8125rem' }}>
            Cancel
          </button>
          {hasChanges && !isMatchComplete && (
            <button
              onClick={saveDraft}
              disabled={scoringPrompt.isInteractionLocked}
              className="mono-btn flex-1"
              style={{ padding: '8px', fontSize: '0.8125rem', borderColor: '#0066ff', color: '#0066ff', opacity: scoringPrompt.isInteractionLocked ? 0.45 : 1 }}
            >
              Save Draft
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

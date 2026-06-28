import { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveBroadcast } from '../../../hooks/useLiveBroadcast';
import { getConsent } from '../../../lib/live/liveSession';
import LiveBroadcastBar from '../live/LiveBroadcastBar';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { getSportById } from '../../../models/sportRegistry';
import {
  clearData,
  isStaleQuickMatchDraft,
  loadData,
  loadSportTournaments,
  saveData,
  saveQuickMatch as saveStoredQuickMatch,
  saveSportTournament,
} from '../../../utils/storage';
import { updateMatchInTournament } from '../../../utils/knockoutManager';
import { useAuth } from '../../../hooks/useAuth';
import { buildTournamentConvexPayload } from '../../../utils/tournamentSync';
import {
  buildTennisQuickHistoryEntry,
  getTennisQuickDraftKey,
  mapTennisSetsForQuickHistory,
} from '../../../utils/tennisQuickMatch';
import { useAppScoringPrompt } from '../components/AppScoringPrompt';
import RouteRecoveryActions from '../components/RouteRecoveryActions';
import { triggerConfetti } from '../utils/confetti';

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

// Record a milestone (game/set won) so it can be rendered via React state + an
// aria-live region and announced — replaces the old direct-DOM injection which
// was invisible to assistive tech. A set-won supersedes a game-won fired by the
// same point, so callers overwrite (not append) the collector for that point.
const recordGameWon = (collect, teamName, gameNumber, setNumber) => {
  collect?.({ kind: 'game', text: `${teamName} wins Game ${gameNumber} (Set ${setNumber})!` });
};

const recordSetWon = (collect, teamName, setNumber) => {
  collect?.({ kind: 'set', text: `${teamName} wins Set ${setNumber}!` });
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

// Current-game point labels (15/30/40/AD, or tiebreak integers) for the live
// broadcast snapshot. Mirrors the standard tennis ladder used by the scorebug.
const TENNIS_LADDER = ['0', '15', '30', '40'];
const tennisGameLabels = (set) => {
  if (!set) return ['0', '0'];
  if (set.isTiebreak) return [String(set.tiebreakPoints1 ?? 0), String(set.tiebreakPoints2 ?? 0)];
  const p1 = set.points1 ?? 0;
  const p2 = set.points2 ?? 0;
  if (p1 >= 3 && p2 >= 3) {
    if (p1 === p2) return ['40', '40'];
    return p1 > p2 ? ['AD', '40'] : ['40', 'AD'];
  }
  return [TENNIS_LADDER[Math.min(p1, 3)], TENNIS_LADDER[Math.min(p2, 3)]];
};

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
    const team2Wins = set.isTiebreak
      ? set.tiebreakPoints2 > set.tiebreakPoints1
      : set.games2 > set.games1;
    if (team1Wins) team1Sets++;
    if (team2Wins) team2Sets++;
  });
  return { team1Sets, team2Sets };
};

// Derive the serving team (1 or 2) purely from match state. In tennis the server
// is a deterministic function of the score, so we compute it rather than tracking
// a separate state variable — this makes undo "just work" and avoids a StrictMode
// double-toggle. Assumption: team 1 serves the first game of the match.
//
// Serve parity is CUMULATIVE across the whole match (not per-set): we sum every
// game played in all sets up to and including the current one. The tiebreak code
// awards the winner a 13th deciding game (odd), which correctly flips the
// first-server into the next set. Regular game: server alternates each game.
// Tiebreak: the serve changes every 2 points (after the first point).
export const deriveServer = (sets, currentSet) => {
  const set = sets[currentSet];
  if (!set) return 1;
  let gamesBefore = 0;
  for (let i = 0; i <= currentSet; i += 1) {
    const s = sets[i];
    if (!s) continue;
    gamesBefore += (s.games1 || 0) + (s.games2 || 0);
  }
  const firstServer = gamesBefore % 2 === 0 ? 1 : 2;
  const other = firstServer === 1 ? 2 : 1;
  if (set.isTiebreak) {
    // Points already played in the tiebreak; p = the point about to be served.
    const p = (set.tiebreakPoints1 || 0) + (set.tiebreakPoints2 || 0) + 1;
    return Math.floor(p / 2) % 2 === 0 ? firstServer : other;
  }
  return firstServer;
};

// Apply deuce/advantage logic to a set in-place — extracted to reduce cognitive complexity
const applyDeuceLogic = (set, team1Name, team2Name, currentSetNum, collect) => {
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
    recordGameWon(collect, team1Name, set.games1, currentSetNum);
  } else if (p2 - p1 >= 2) {
    set.games2++;
    set.points1 = 0;
    set.points2 = 0;
    set.isDeuce = false;
    set.advantage = null;
    triggerHaptic([50, 100, 50]);
    recordGameWon(collect, team2Name, set.games2, currentSetNum);
  }
};

// Apply regular (no-deuce) game win logic to a set in-place
const applyRegularGameLogic = (set, team1Name, team2Name, currentSetNum, collect) => {
  const p1 = set.points1;
  const p2 = set.points2;

  if (p1 >= 4 && p1 - p2 >= 2) {
    set.games1++;
    set.points1 = 0;
    set.points2 = 0;
    triggerHaptic([50, 100, 50]);
    recordGameWon(collect, team1Name, set.games1, currentSetNum);
  } else if (p2 >= 4 && p2 - p1 >= 2) {
    set.games2++;
    set.points1 = 0;
    set.points2 = 0;
    triggerHaptic([50, 100, 50]);
    recordGameWon(collect, team2Name, set.games2, currentSetNum);
  }
};

// Process a tiebreak point and return updated sets + optional next set index
const processTiebreakPoint = (newSets, setIdx, team, team1Name, team2Name, advanceFn, collect) => {
  const set = newSets[setIdx];
  if (team === 1) set.tiebreakPoints1++;
  else set.tiebreakPoints2++;

  if (isSetComplete(set)) {
    set.completed = true;
    // Award the tiebreak winner the deciding game so the set reads 7-6 (not 6-6) —
    // both the per-set display and standings compare games (score1/score2).
    if (set.tiebreakPoints1 > set.tiebreakPoints2) set.games1 += 1;
    else set.games2 += 1;
    triggerHaptic([50, 100, 50]);
    const winner = set.tiebreakPoints1 > set.tiebreakPoints2 ? team1Name : team2Name;
    recordSetWon(collect, winner, setIdx + 1);
    advanceFn(setIdx, newSets.length);
  }
  return newSets;
};

// Process a regular-game point and return updated sets
const processRegularPoint = (newSets, setIdx, team, team1Name, team2Name, advanceFn, collect) => {
  const set = newSets[setIdx];
  if (team === 1) set.points1++;
  else set.points2++;

  const p1 = set.points1;
  const p2 = set.points2;

  if (p1 >= 3 && p2 >= 3) {
    applyDeuceLogic(set, team1Name, team2Name, setIdx + 1, collect);
  } else if (p1 >= 4 || p2 >= 4) {
    applyRegularGameLogic(set, team1Name, team2Name, setIdx + 1, collect);
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
    // A set-won supersedes the game-won the same point may have recorded.
    recordSetWon(collect, winner, setIdx + 1);
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
  // Milestone toast (game/set won) — rendered via React state into an aria-live
  // region so it is actually announced (replaces the old direct-DOM injection).
  // The pending milestone is recorded into a ref inside the setSets updater and
  // flushed in a post-commit effect (cannot call setState inside an updater).
  const [milestone, setMilestone] = useState(null);
  const milestoneRef = useRef(null);
  const milestoneTimerRef = useRef(null);
  const scoringPrompt = useAppScoringPrompt();

  // Live broadcast (dkt/b0z/6fj/87d): mirror each point/undo to the public watch
  // page. Tennis maps to the generic snapshot as: current-set GAMES -> pointsA/B,
  // sets won -> setsA/B, completed sets -> setScores, current game points ->
  // periodLabel ("40-30"). Additive; localStorage authoritative; gated on consent.
  const [liveEnabled, setLiveEnabled] = useState(() => getConsent() === 'accepted');
  const live = useLiveBroadcast({ enabled: liveEnabled });
  const liveRef = useRef(live);
  liveRef.current = live;
  const liveClientMatchId = isQuickMatch
    ? `${sport}:quick:${matchId}`
    : `${sport}:${id}:${matchId}`;
  const broadcastIntentRef = useRef(null);

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
      const draftKey = getTennisQuickDraftKey(matchId);
      const draft = loadData(draftKey, null);
      if (isStaleQuickMatchDraft(draft)) {
        clearData(draftKey);
        navigate(`/${sport}/quick`);
        return;
      }
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

    // A new point supersedes any milestone toast still showing — clear it first so
    // the aria-atomic live region doesn't re-announce the stale "wins Game/Set" text
    // alongside the new score.
    setMilestone(null);

    // Mirror this point to the live broadcast (snapshot built post-commit). team1 -> A.
    broadcastIntentRef.current = { kind: 'point', team: team === 1 ? 'A' : 'B', at: Date.now() };

    setHistory(prev => [...prev, {
      timestamp: Date.now(),
      sets: structuredClone(sets),
      currentSet,
    }].slice(-100));

    // advanceFn is called by the process helpers when a set completes
    const advanceFn = (setIdx, totalSets) => {
      if (setIdx < totalSets - 1) setCurrentSet(setIdx + 1);
    };

    // Collector overwrites (not appends) so a set-won supersedes the game-won the
    // same point fires, and the dev StrictMode double-invoke can't duplicate it.
    const collect = (m) => { milestoneRef.current = m; };

    setSets(prevSets => {
      const newSets = prevSets.map(s => ({ ...s }));
      const set = newSets[currentSet];
      if (!set || set.completed) return prevSets;

      triggerHaptic([50]);

      if (set.isTiebreak) {
        return processTiebreakPoint(newSets, currentSet, team, team1Name, team2Name, advanceFn, collect);
      }
      return processRegularPoint(newSets, currentSet, team, team1Name, team2Name, advanceFn, collect);
    });

    setHasChanges(true);
    setScoreAnimKey(prev => ({ ...prev, [team === 1 ? 'left' : 'right']: (prev[team === 1 ? 'left' : 'right'] || 0) + 1 }));
  };

  // Undo last action
  const undo = () => {
    if (history.length === 0 || scoringPrompt.isInteractionLocked) return;

    broadcastIntentRef.current = { kind: 'undo', at: Date.now() };
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

  // Auto-save the in-progress match as a draft on every scoring change, so
  // leaving the scorer (back button, navigating away, closing the app) always
  // keeps a resumable draft — no manual "Save Draft" step. Mirrors the volleyball
  // arena's continuous draft autosave. Skips empty/complete matches so we never
  // pile up blank drafts, and the draft is cleared on finish/discard. Tournament
  // matches autosave into the bracket so a resumable in-progress draft survives.
  useEffect(() => {
    if (!match || isMatchComplete || history.length === 0) return;
    if (isQuickMatch) {
      if (!quickDraftKey) return;
      saveData(quickDraftKey, {
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
    } else if (tournament && matchId) {
      const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
        ...m,
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
      }
    }
  }, [isQuickMatch, quickDraftKey, match, tournament, matchId, sportConfig, isMatchComplete, sets, currentSet, history]);

  // Broadcast the latest point/undo AFTER its state commits (§87d snapshot): a
  // point can finish a game/set, which React applies asynchronously, so we read
  // the settled sets here rather than guessing the post-point score in addPoint.
  useEffect(() => {
    const intent = broadcastIntentRef.current;
    if (!intent) return;
    broadcastIntentRef.current = null;

    const cur = sets[currentSet] || {};
    const completed = sets.filter((s) => s.completed);
    const { team1Sets, team2Sets } = countSetsWon(completed);
    const [labelA, labelB] = tennisGameLabels(cur);
    // Serve change is never a user action in tennis — it's a consequence of a
    // point, which already fires point()/undo(). So we don't add a serveChange
    // mirror; we just carry the derived server in the existing snapshot (team1->A),
    // matching how MonoSetsLiveScore broadcasts servingTeam.
    const server = deriveServer(sets, currentSet);
    const snapshot = {
      pointsA: cur.games1 || 0,
      pointsB: cur.games2 || 0,
      setsA: team1Sets,
      setsB: team2Sets,
      setScores: completed.map((s) => ({ a: s.games1 || 0, b: s.games2 || 0 })),
      servingTeam: server === 1 ? 'A' : 'B',
      currentUnit: currentSet + 1,
      periodLabel: `${labelA}-${labelB}`,
    };
    if (intent.kind === 'undo') {
      liveRef.current.undo({ at: intent.at, snapshot });
    } else {
      liveRef.current.point({ team: intent.team, value: 1, at: intent.at, snapshot });
    }
  }, [sets, currentSet]);

  // Flush a pending game/set milestone into React state AFTER the score commits,
  // so it renders in the aria-live region and is announced. Auto-dismisses after
  // 1.5s, matching the prior toast lifetime. Cleared on unmount.
  useEffect(() => {
    const pending = milestoneRef.current;
    if (!pending) return;
    milestoneRef.current = null;
    setMilestone(pending);
    if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current);
    milestoneTimerRef.current = setTimeout(() => setMilestone(null), 1500);
  }, [sets, currentSet]);

  useEffect(() => () => {
    if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current);
  }, []);

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

    const ok = saveStoredQuickMatch(entry);
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
      live.finalize();
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
      // Persist the shared set contract (score1/score2 = games) so standings + the
      // bracket UI can read sets — but ONLY once the match is complete. An
      // in-progress save must leave the top-level result fields empty, otherwise
      // calculateSetsStandings (which skips only pending/empty matches) would count
      // the unfinished match and award match points. draftState below keeps the raw
      // live shape for resume.
      sets: isMatchComplete ? mapTennisSetsForQuickHistory(sets) : [],
      status: isMatchComplete ? 'completed' : 'in-progress',
      winner: isMatchComplete ? winner : null,
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

  // Cancel and discard changes — clear the in-progress quick draft so the app
  // entry stops auto-resuming this match (otherwise you can't leave the scorer).
  // For tournament matches, drop the resumable draft and reset the match back to
  // 'pending' when it has no real result yet, so the bracket doesn't leave a
  // scoreless match stuck in-progress. Keep any partial set progress otherwise.
  const discardAndExit = () => {
    if (quickDraftKey) clearData(quickDraftKey);
    if (tournament) {
      const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
        ...m,
        status: m.winner || (m.sets || []).some(s => s.completed || s.games1 > 0 || s.games2 > 0)
          ? m.status
          : 'pending',
        draftState: undefined,
      }));
      saveSportTournament(sportConfig.storageKey, updatedTournament);
    }
    navigateBack();
  };
  const handleCancel = () => scoringPrompt.cancelOrNavigate(hasChanges, discardAndExit);
  const confirmPendingPrompt = () => scoringPrompt.confirmDiscard(discardAndExit);

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

  // Guard: after a set completes (or an undo rewinds past the array) sets[currentSet]
  // can be undefined, and the derived display values below destructure it — an
  // unguarded access crashes the render. Fall back to a blank set so the scorer
  // stays mounted (the match-complete badge / recovery still applies).
  const currentSetData = sets[currentSet] || makeBlankSet();
  const isTiebreakMode = currentSetData?.isTiebreak;
  // Serving indicator — derived from match state (server is a pure function of the
  // score in tennis). Flips per game, and every 2 points in a tiebreak.
  const servingTeam = deriveServer(sets, currentSet);
  const leftServing = sidesSwapped ? servingTeam === 2 : servingTeam === 1;
  const rightServing = sidesSwapped ? servingTeam === 1 : servingTeam === 2;
  const { team1Sets, team2Sets } = countSetsWon(sets.filter((s) => s.completed));
  const leftSetsWon = sidesSwapped ? team2Sets : team1Sets;
  const rightSetsWon = sidesSwapped ? team1Sets : team2Sets;

  // Display score for current game/tiebreak
  const { score1: score1Display, score2: score2Display } = computeScoreDisplay(currentSetData);

  // Side swap derived display values
  const leftScoreDisplay = sidesSwapped ? score2Display : score1Display;
  const rightScoreDisplay = sidesSwapped ? score1Display : score2Display;
  const leftGames = sidesSwapped ? currentSetData.games2 : currentSetData.games1;
  const rightGames = sidesSwapped ? currentSetData.games1 : currentSetData.games2;
  const leftTeam = sidesSwapped ? 2 : 1;
  const rightTeam = sidesSwapped ? 1 : 2;
  // Score colour follows the current-game lead: ahead = green, level (0-0, deuce)
  // = brown (both), trailing = ink. Compares the underlying point counts.
  const teamAccent = (mine, other) =>
    mine > other ? 'var(--primary)' : mine === other ? 'var(--se-color-warning)' : 'var(--se-color-ink)';
  const leftPoints = isTiebreakMode
    ? (sidesSwapped ? currentSetData.tiebreakPoints2 : currentSetData.tiebreakPoints1)
    : (sidesSwapped ? currentSetData.points2 : currentSetData.points1);
  const rightPoints = isTiebreakMode
    ? (sidesSwapped ? currentSetData.tiebreakPoints1 : currentSetData.tiebreakPoints2)
    : (sidesSwapped ? currentSetData.points1 : currentSetData.points2);
  // Require the REAL set (not the makeBlankSet fallback) — when sets[currentSet] is
  // missing the controls must disable, or a tap reaches the missing set and crashes.
  const canScoreCurrentSet = Boolean(sets[currentSet]) && !currentSetData.completed && !scoringPrompt.isInteractionLocked;
  const scoreCardAssistiveHint = scoringPrompt.isInteractionLocked
    ? 'Scoring is temporarily locked'
    : 'Press Enter or click to add point';
  const handleSwapSides = () => {
    if (scoringPrompt.isInteractionLocked) return;
    setSidesSwapped(s => !s);
  };

  return (
    <div className="mono-scorer-screen mono-arena-screen mono-transition mono-visible">
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

      {/* Live broadcast control (consent / LIVE indicator / share) */}
      <LiveBroadcastBar
        broadcast={live}
        descriptor={{
          clientMatchId: liveClientMatchId,
          sport,
          scorecardKind: 'tennis',
          teamA: { name: team1Name },
          teamB: { name: team2Name },
        }}
        enabled={liveEnabled}
        onEnableChange={setLiveEnabled}
      />

      {/* ARIA live region — standardized polite/atomic <output> (S6819). Announces
          the running score, set/serving context, and game/set milestones. */}
      <output aria-live="polite" aria-atomic="true" className="sr-only">
        {leftName}: {leftScoreDisplay}. {rightName}: {rightScoreDisplay}.
        {isTiebreakMode ? 'Tiebreak' : `Set ${currentSet + 1} of ${sets.length}`}.
        {' '}Serving: {servingTeam === 1 ? team1Name : team2Name}.
        {milestone ? ` ${milestone.text}` : ''}
      </output>

      {/* Seam: sets tally + format — matches the arena scorers */}
      <div className="mono-arena-seam">
        <span><b>{leftSetsWon}</b> &ndash; <b>{rightSetsWon}</b> sets</span>
        <span className="mono-arena-seam-rule">{isTiebreakMode ? 'tiebreak' : `best of ${sets.length}`}</span>
      </div>

      {/* Score halves — identical structure to the arena scorer (football/volleyball):
          big tabular number, accent-coloured team name, a 2px "leading" underline, and
          a subtle pop on each point. Tennis games sit in the arena hint slot.
          S6819: use <button> instead of role="button" div. */}
      <div className="mono-arena-grid">
        {/* Left team */}
        <div className="mono-arena-col">
          <button
            type="button"
            onClick={() => canScoreCurrentSet && addPoint(leftTeam)}
            disabled={!canScoreCurrentSet}
            data-leading={leftPoints > rightPoints ? 'true' : 'false'}
            aria-label={`${leftName}: ${leftScoreDisplay}. ${scoreCardAssistiveHint}`}
            className="mono-arena-half"
            style={{ '--score-accent': teamAccent(leftPoints, rightPoints), touchAction: 'manipulation', opacity: canScoreCurrentSet ? 1 : 0.6 }}
          >
            <span className="mono-arena-overline" style={{ color: teamAccent(leftPoints, rightPoints) }}>
              {leftServing ? <span aria-hidden="true">● </span> : ''}{leftName}
            </span>
            <span
              key={scoreAnimKey[sidesSwapped ? 'right' : 'left'] || 0}
              className="mono-arena-num mono-score mono-score-animate mono-scorer-score-value"
              style={{ color: teamAccent(leftPoints, rightPoints) }}
            >
              {leftScoreDisplay}
            </span>
            <span className="mono-arena-hint">{leftGames} {leftGames === 1 ? 'game' : 'games'}</span>
          </button>
        </div>

        {/* Right team */}
        <div className="mono-arena-col">
          <button
            type="button"
            onClick={() => canScoreCurrentSet && addPoint(rightTeam)}
            disabled={!canScoreCurrentSet}
            data-leading={rightPoints > leftPoints ? 'true' : 'false'}
            aria-label={`${rightName}: ${rightScoreDisplay}. ${scoreCardAssistiveHint}`}
            className="mono-arena-half"
            style={{ '--score-accent': teamAccent(rightPoints, leftPoints), touchAction: 'manipulation', opacity: canScoreCurrentSet ? 1 : 0.6 }}
          >
            <span className="mono-arena-overline" style={{ color: teamAccent(rightPoints, leftPoints) }}>
              {rightServing ? <span aria-hidden="true">● </span> : ''}{rightName}
            </span>
            <span
              key={scoreAnimKey[sidesSwapped ? 'left' : 'right'] || 0}
              className="mono-arena-num mono-score mono-score-animate mono-scorer-score-value"
              style={{ color: teamAccent(rightPoints, leftPoints) }}
            >
              {rightScoreDisplay}
            </span>
            <span className="mono-arena-hint">{rightGames} {rightGames === 1 ? 'game' : 'games'}</span>
          </button>
        </div>
      </div>

      {/* Completed-set history strip — matches the sets scorer. Shows games per
          set (tiebreak sets read 7-6 because the winner gets a deciding game). */}
      {sets.some(s => s.completed) && (
        <div className="mono-score-history-strip py-4 text-center text-sm mb-6">
          <div className="flex justify-center gap-3 flex-wrap">
            {sets.filter(s => s.completed).map((s, i) => (
              <span key={`completed-set-${i}-${s.games1}-${s.games2}`} className="font-mono">
                Set {i + 1}: {s.games1}-{s.games2}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bottom bar — thin line-divided action row to match the arena scorers.
          Saving is automatic (see the autosave effect); these are manual controls.
          "Save" keeps/finishes the match; "Discard" deletes this in-progress match. */}
      <div className="mono-control-strip mono-scorer-control-strip pt-4">
        <div className="mono-quick-action-row">
          <button
            onClick={undo}
            disabled={history.length === 0 || scoringPrompt.isInteractionLocked}
            className="mono-btn"
            style={{ opacity: history.length === 0 || scoringPrompt.isInteractionLocked ? 0.4 : 1, touchAction: 'manipulation' }}
          >
            Undo
          </button>
          <button
            onClick={handleSwapSides}
            disabled={scoringPrompt.isInteractionLocked}
            className="mono-btn"
            style={{ opacity: scoringPrompt.isInteractionLocked ? 0.45 : 1, touchAction: 'manipulation' }}
          >
            Swap
          </button>
          <button
            onClick={handleCancel}
            className="mono-btn mono-btn-danger"
            style={{ touchAction: 'manipulation' }}
          >
            Discard
          </button>
          <button
            onClick={saveMatch}
            disabled={scoringPrompt.isInteractionLocked}
            className="mono-btn"
            style={{ color: 'var(--primary)', opacity: scoringPrompt.isInteractionLocked ? 0.45 : 1, touchAction: 'manipulation' }}
          >
            Finish
          </button>
        </div>
      </div>
      </div>

      {/* Milestone toast (game/set won) — React-rendered (was direct DOM). The
          announcement itself lives in the polite <output> above; this is the
          visual counterpart, hidden from AT to avoid a double read. */}
      {milestone && (
        <div className="mono-set-won mono-set-won-animate" aria-hidden="true">
          {milestone.text}
        </div>
      )}
    </div>
  );
}

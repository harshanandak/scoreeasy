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
import { useLiveBroadcast } from '../../../hooks/useLiveBroadcast';
import { getConsent } from '../../../lib/live/liveSession';
import LiveBroadcastBar from '../live/LiveBroadcastBar';
import RouteRecoveryActions from '../components/RouteRecoveryActions';
import { useScoringCompletion } from './scoringCompletionContext';

const isTouchDevice = 'ontouchstart' in globalThis || navigator.maxTouchPoints > 0;

// Haptic feedback helper
const triggerHaptic = (pattern) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

export default function MonoSetsLiveScore() {
  const navigate = useNavigate();
  const completeProtectedScoring = useScoringCompletion();
  const { sport, id, matchId } = useParams();
  const { isAuthenticated } = useAuth();
  const saveMatchMutation = useMutation(api.matches.save);
  const navigateToTournament = () => navigate(`/${sport}/tournament/${id}`);

  // Core state
  const [sportConfig, setSportConfig] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [match, setMatch] = useState(null);
  // Load lifecycle: 'loading' until the effect resolves, then 'ready' (match
  // found) or 'notfound' (bad sport/tournament/match) so we can show a real
  // recovery surface instead of a permanent "Loading…" (issue #108).
  const [loadStatus, setLoadStatus] = useState('loading');

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

  // Live broadcast (dkt/b0z/6fj/87d): mirror each point/undo to the public watch
  // page with the engine-derived snapshot (current-set points + set tally +
  // serving). Additive — localStorage stays authoritative; gated on consent.
  const [liveEnabled, setLiveEnabled] = useState(() => getConsent() === 'accepted');
  const live = useLiveBroadcast({ enabled: liveEnabled });
  const liveRef = useRef(live);
  liveRef.current = live;
  const liveClientMatchId = `${sport}:${id}:${matchId}`;
  // Records the latest scoring action; its broadcast snapshot is computed from
  // the COMMITTED state in the effect below (a point can end a set and start the
  // next, which React applies asynchronously).
  const broadcastIntentRef = useRef(null);

  // Animation state
  const [showSetWon, setShowSetWon] = useState(false);
  const [setWonTeam, setSetWonTeam] = useState('');
  // The 1-indexed number of the set that JUST completed. Captured at completion
  // time because `currentSet` increments when the next set opens, so reading it
  // at render shows the wrong (next) number — and never advances at all on the
  // match-ending set (issue #108).
  const [setWonNumber, setSetWonNumber] = useState(0);
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
    if (!config) { setLoadStatus('notfound'); return; }

    const tournaments = loadSportTournaments(config.storageKey);
    const found = tournaments.find(t => t.id === Number(id));
    if (!found) { setLoadStatus('notfound'); return; }

    // Match IDs are stored as string or number depending on entry point (see
    // saveTournamentToConvex above), so normalize before comparing — a strict
    // string-only match sends numeric IDs into the "not found" path. Also reset
    // the knockout flag up front so a previously viewed knockout match doesn't
    // keep applying knockout format when we resolve a regular match next.
    const isMatchId = (m) => m.id === matchId || m.id === Number(matchId);
    isKnockoutRef.current = false;

    let foundMatch = (found.matches || []).find(isMatchId);
    if (!foundMatch) {
      foundMatch = (found.knockoutMatches || []).find(isMatchId);
      if (foundMatch) isKnockoutRef.current = true;
    }
    if (!foundMatch) { setLoadStatus('notfound'); return; }

    setSportConfig(config);
    setTournament(found);
    setMatch(foundMatch);
    setLoadStatus('ready');
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
    // The every-point-at-deuce switch only applies to UNCAPPED formats (e.g.
    // table tennis). Capped sports (badminton, maxPoints=30) don't use it — and
    // in fact reach this code path only via rotation===1 (handled above), so the
    // guard keeps the deuce special-case from ever mis-firing for them (#108).
    const maxPoints = sportConfig?.config?.maxPoints;
    const atDeuce = !maxPoints && (setScore?.score1 || 0) >= target - 1 && (setScore?.score2 || 0) >= target - 1;
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
    // Mirror the side-out to the broadcast like any sibling action: a serve
    // switch changes no score, so we emit a value:0 "point" whose snapshot
    // carries the new serving team (the watch reads servingTeam from the patched
    // snapshot). This is reversed in lockstep by undo (issue #108).
    if (scoringMode === 'side-out' && team !== servingTeam) {
      broadcastIntentRef.current = { kind: 'serve', team: team === 1 ? 'A' : 'B', value: 0, at: Date.now() };
      setServingTeam(team);
      return;
    }

    // An actual point is being scored — mark it for broadcast (snapshot built
    // once the set state settles, see the broadcast effect). team1 -> A.
    broadcastIntentRef.current = { kind: 'point', team: team === 1 ? 'A' : 'B', value: 1, at: Date.now() };

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
        setSetWonNumber(currentSet + 1); // the set that just completed (1-indexed)
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

  // Per-point correction (-1) for a team — fixes a mis-tap without unwinding the
  // whole undo stack. Floors at 0 (a no-op when the score is already 0), records
  // history so it is itself undoable, and never completes a set or rotates serve.
  // Mirrored to the broadcast as a value:-1 point so spectators stay in sync.
  const correctPoint = (team) => {
    if (!sportConfig || !tournament || isInteractionLocked) return;

    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;

    if (sets[currentSet]?.completed) return;

    const scoreKey = team === 1 ? 'score1' : 'score2';
    if ((sets[currentSet]?.[scoreKey] || 0) <= 0) return; // nothing to take away

    triggerHaptic(30);

    setHistory(prev => [...prev, {
      timestamp: Date.now(),
      sets: structuredClone(sets),
      currentSet,
      servingTeam,
      scoringMode,
    }].slice(-100));

    setHasChanges(true);

    broadcastIntentRef.current = { kind: 'correction', team: team === 1 ? 'A' : 'B', value: -1, at: Date.now() };

    setSets(prevSets => {
      const newSets = prevSets.map(s => ({ ...s }));
      newSets[currentSet][scoreKey] = Math.max(0, newSets[currentSet][scoreKey] - 1);
      return newSets;
    });
  };

  // Undo last action
  const undo = () => {
    if (history.length === 0 || isInteractionLocked) return;

    broadcastIntentRef.current = { kind: 'undo', at: Date.now() };
    const last = history[history.length - 1];
    setSets(last.sets);
    setCurrentSet(last.currentSet);
    if (last.servingTeam) setServingTeam(last.servingTeam);
    if (last.scoringMode) setScoringMode(last.scoringMode);
    setHistory(prev => prev.slice(0, -1));
  };

  // Auto-save the in-progress match to the tournament on every scoring change, so
  // leaving the scorer always keeps progress — no manual "Save Draft". "Discard"
  // clears this draft (reverts to the committed match); "Save" commits via saveMatch.
  useEffect(() => {
    if (!tournament || !matchId || isInteractionLocked) return;
    if (history.length === 0) return;
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
    saveSportTournament(sportConfig.storageKey, updatedTournament);
  }, [tournament, matchId, isInteractionLocked, sets, currentSet, history, servingTeam, scoringMode, effectiveFormat, sportConfig]);

  // Broadcast the latest point/undo AFTER its state commits (§87d snapshot): a
  // point may end a set and open the next, so we read the settled sets/serving
  // here rather than guessing the post-update score inside addPoint.
  useEffect(() => {
    const intent = broadcastIntentRef.current;
    if (!intent) return;
    broadcastIntentRef.current = null;

    const completed = sets.filter((s) => s.completed);
    const showServe = scoringMode === 'side-out' || Boolean(sportConfig?.config?.serviceRotation);
    const snapshot = {
      pointsA: sets[currentSet]?.score1 || 0,
      pointsB: sets[currentSet]?.score2 || 0,
      setsA: completed.filter((s) => s.score1 > s.score2).length,
      setsB: completed.filter((s) => s.score2 > s.score1).length,
      setScores: completed.map((s) => ({ a: s.score1, b: s.score2 })),
      servingTeam: showServe ? (servingTeam === 1 ? 'A' : 'B') : undefined,
      currentUnit: currentSet + 1,
      periodLabel: `Set ${currentSet + 1}`,
    };
    if (intent.kind === 'undo') {
      liveRef.current.undo({ at: intent.at, snapshot });
    } else {
      // 'point' (value 1), 'serve' switch (value 0) and 'correction' (value -1)
      // all flow through the same point() surface; the snapshot carries the
      // settled score/serving so spectators stay in lockstep with undo. Tag the
      // EVENT type so the spectator feed labels a serve switch / correction
      // instead of rendering a meaningless "+0" / "+-1" (the snapshot still
      // owns the score, so the label changes nothing about the running totals).
      const broadcastType = intent.kind === 'serve'
        ? 'serve_change'
        : intent.kind === 'correction'
          ? 'correction'
          : 'point';
      liveRef.current.point({ team: intent.team, value: intent.value ?? 1, type: broadcastType, at: intent.at, snapshot });
    }
  }, [sets, currentSet, servingTeam, scoringMode, sportConfig]);

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
      live.finalize();
      // Reference wiring (kernel 42f06561): a completed match lands on the
      // FULL-TIME result screen. Unwind the scorer entry AND the active-scoring
      // guard entry through the app-owned seam so Back from Result returns to the
      // bracket, never the frozen completed scorer (PR #128). A plain replace only
      // drops the guard entry, orphaning the scorer entry underneath.
      const resultPath = `/${sport}/tournament/${id}/match/${matchId}/result`;
      if (completeProtectedScoring) {
        completeProtectedScoring(resultPath);
      } else {
        navigate(resultPath, { replace: true });
      }
      return;
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

  // Discard the in-progress draft for this match (revert to its committed state),
  // then return to the bracket. Saving is automatic, so plain navigation keeps it.
  const discardAndExit = () => {
    if (tournament && matchId) {
      const reverted = updateMatchInTournament(tournament, matchId, m => ({
        ...m,
        draftState: undefined,
        // A resumed draft carries status 'in-progress'; once it is thrown away the
        // match has no committed score, so revert it to 'pending' to stop the bracket
        // advertising a resumable match that no longer has a draft.
        status: m.sets?.some(s => s.score1 > 0 || s.score2 > 0) || m.winner ? m.status : 'pending',
      }));
      saveSportTournament(sportConfig.storageKey, reverted);
    }
    navigateToTournament();
  };
  const hasDraftToDiscard = hasChanges || Boolean(match?.draftState) || history.length > 0;
  const handleDiscard = () => scoringPrompt.cancelOrNavigate(hasDraftToDiscard, discardAndExit);
  const confirmPendingPrompt = () => scoringPrompt.confirmDiscard(discardAndExit);

  if (loadStatus === 'notfound') {
    return (
      <RouteRecoveryActions
        eyebrow="Scorer recovery"
        title="Match not found"
        message="This scorer link does not match a saved tournament match on this device."
        sportId={getSportById(sport)?.id}
      />
    );
  }

  if (loadStatus !== 'ready' || !sportConfig || !tournament || !match) {
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
  // Broadcast scorecard kind, derived from the sport's ENGINE rather than
  // hardcoded (#108). Every sport this scorer drives (volleyball, badminton,
  // tabletennis, pickleball, squash) is engine 'sets' and renders through the
  // watch's points-per-set scorebug, whose kind is 'volleyball'. Deriving by
  // engine — instead of the sport id — avoids regressing the watch to the
  // generic card (its ScorecardPanel only special-cases 'volleyball'/'tennis').
  // Tennis routes to its own scorer, so it never reaches here.
  const liveScorecardKind = sportConfig?.engine === 'sets' ? 'volleyball' : 'generic';

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

        {/* Live broadcast control (consent / LIVE indicator / share) */}
        <LiveBroadcastBar
          broadcast={live}
          descriptor={{
            clientMatchId: liveClientMatchId,
            sport,
            scorecardKind: liveScorecardKind,
            teamA: { name: team1Name },
            teamB: { name: team2Name },
          }}
          enabled={liveEnabled}
          onEnableChange={setLiveEnabled}
        />

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

        {/* Per-team correction (-1) — fix a mis-tap without unwinding undo.
            Mirrors the left/right side-swap mapping of the arena above. */}
        <div className="mono-quick-action-row" style={{ marginBottom: '0.75rem' }}>
          <button
            type="button"
            onClick={() => canScoreCurrentSet && correctPoint(leftTeam)}
            disabled={!canScoreCurrentSet || leftScore <= 0}
            aria-label={`Correct ${leftName}: remove one point`}
            className="mono-btn"
            style={{ minHeight: 44, opacity: (!canScoreCurrentSet || leftScore <= 0) ? 0.4 : 1, touchAction: 'manipulation' }}
          >
            &minus;1 {leftName}
          </button>
          <button
            type="button"
            onClick={() => canScoreCurrentSet && correctPoint(rightTeam)}
            disabled={!canScoreCurrentSet || rightScore <= 0}
            aria-label={`Correct ${rightName}: remove one point`}
            className="mono-btn"
            style={{ minHeight: 44, opacity: (!canScoreCurrentSet || rightScore <= 0) ? 0.4 : 1, touchAction: 'manipulation' }}
          >
            &minus;1 {rightName}
          </button>
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
        {/* Unified bottom bar — same thin line-divided row as every scorer.
            Saving is automatic; Save commits & returns, Discard reverts this match. */}
        <div className="mono-control-strip mono-scorer-control-strip pt-4">
          <div className="mono-quick-action-row">
            <button
              onClick={undo}
              disabled={history.length === 0 || isInteractionLocked}
              className="mono-btn"
              style={{ opacity: history.length === 0 || isInteractionLocked ? 0.4 : 1, touchAction: 'manipulation' }}
            >
              Undo
            </button>
            <button
              onClick={handleSwapSides}
              disabled={isInteractionLocked}
              className="mono-btn"
              style={{ opacity: isInteractionLocked ? 0.45 : 1, touchAction: 'manipulation' }}
            >
              Swap
            </button>
            <button onClick={handleDiscard} className="mono-btn">
              Discard
            </button>
            <button
              onClick={saveMatch}
              disabled={isInteractionLocked}
              className="mono-btn"
              style={{ color: 'var(--primary)', opacity: isInteractionLocked ? 0.45 : 1, touchAction: 'manipulation' }}
            >
              Finish
            </button>
          </div>
        </div>
      </div>

      {/* Set Won Notification */}
      {showSetWon && (
        <div className="mono-set-won mono-set-won-animate">
          {setWonTeam} wins Set {setWonNumber}!
        </div>
      )}
    </div>
  );
}

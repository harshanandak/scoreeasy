import { broadcastServer, endChangeDue, firstServerForSet, freezeSetsFormat, serveAfterPoint, setWinRule, isSetsGameComplete } from '../../../models/setsRules';
import SetsRulesControls, { ServerChoice } from './SetsRulesControls';
import { useScoringProgress } from './scoringProgressContext';
import { useMatchCompletion } from '../../../hooks/useMatchCompletion';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { getSportById, isTeamColourTournamentSport } from '../../../models/sportRegistry';
import TeamSetsBoard from './TeamSetsBoard';
import { BoardSheetGroup } from './BoardShell';
import { useTeamColours } from './useTeamColours';
import { sportIdentity } from '../../../lib/sportIdentity';
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
  const teamColourStyle = useTeamColours(
    tournament?.teams.find(t => t.id === match?.team1Id)?.color,
    tournament?.teams.find(t => t.id === match?.team2Id)?.color,
    sport,
  );
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
  const completion = useMatchCompletion();
  const scoringPrompt = useAppScoringPrompt(completion);
  const isInteractionLocked = scoringPrompt.isInteractionLocked;
  const [servingTeam, setServingTeam] = useState(1);
  const [scoringMode, setScoringMode] = useState('rally');
  const [frozenFormat, setFrozenFormat] = useState(null);

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
  const { scoringStarted } = useScoringProgress(
    sets.some(set => set.score1 > 0 || set.score2 > 0), false, match?.draftState?.scoringStarted, `${sport}:${id}:${matchId}`,
  );

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

    if (completion.hydrate(foundMatch, `${sport}:${id}:${matchId}`, () => {
      const resultPath = `/${sport}/tournament/${id}/match/${matchId}/result`;
      if (completeProtectedScoring) completeProtectedScoring(resultPath);
      else navigate(resultPath, { replace: true });
    })) return;
    setSportConfig(config);
    const sourceFormat = isKnockoutRef.current && found.knockoutConfig?.format ? found.knockoutConfig.format : found.format;
    const legacy = Boolean(foundMatch.draftState || foundMatch.sets?.length || foundMatch.status === 'in-progress');
    const capturedFormat = freezeSetsFormat(config, foundMatch.format?.setsRules ? foundMatch.format : legacy ? sourceFormat : { ...sourceFormat, ...foundMatch.format }, { legacy, path: 'tournament' });
    setFrozenFormat(capturedFormat);
    setTournament(found);
    setMatch(foundMatch);
    setLoadStatus('ready');
    const supportedModes = config?.config?.scoringModes;
    const defaultScoringMode = (Array.isArray(supportedModes) && supportedModes.includes(config?.config?.defaultScoringMode))
      ? config.config.defaultScoringMode
      : (config?.config?.scoringType === 'side-out' ? 'side-out' : 'rally');
    const loadedMode = capturedFormat.setsRules?.version === 1
      ? capturedFormat.setsRules.scoringMode
      : foundMatch.scoringMode
      || foundMatch.draftState?.scoringMode
      || foundMatch.format?.scoringMode
      || defaultScoringMode;
    const validMode = Array.isArray(supportedModes) && supportedModes.length > 0
      ? (supportedModes.includes(loadedMode) ? loadedMode : defaultScoringMode)
      : loadedMode;
    setScoringMode(validMode);
    if (!foundMatch.format?.setsRules) {
      const capturedTournament = updateMatchInTournament(found, matchId, m => ({ ...m, format: capturedFormat }));
      if (!saveSportTournament(config.storageKey, capturedTournament)) setSaveWarning('Save failed - storage may be full. Export your data.');
    }
    setServingTeam(Object.hasOwn(foundMatch.draftState || {}, 'servingTeam') ? foundMatch.draftState.servingTeam : capturedFormat.setsRules?.initialServer ?? null);

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
      if (Object.hasOwn(foundMatch.draftState, 'servingTeam')) setServingTeam(foundMatch.draftState.servingTeam);
      if (capturedFormat.setsRules?.version !== 1 && foundMatch.draftState.scoringMode) setScoringMode(foundMatch.draftState.scoringMode);
      if (typeof foundMatch.draftState.sidesSwapped === 'boolean') setSidesSwapped(foundMatch.draftState.sidesSwapped);
    }
  }, [sport, id, matchId]);

  const effectiveFormat = frozenFormat;
  const rules = effectiveFormat?.setsRules;
  const checkSetComplete = (set) => rules ? isSetsGameComplete(set, setWinRule(rules, currentSet)) : false;
  const getCurrentSetTarget = (index) => rules ? setWinRule(rules, index).target : 0;

  // Add point
  const addPoint = (team) => {
    if (!sportConfig || !tournament || isInteractionLocked || completion.locked) return;
    if (scoringMode === 'side-out' && servingTeam == null) {
      setSaveWarning('Choose the serving team before scoring a side-out rally.');
      return;
    }

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
      sidesSwapped,
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

    const newSets = sets.map(s => ({ ...s }));
    const scoreKey = team === 1 ? 'score1' : 'score2';
    newSets[currentSet][scoreKey]++;
    if (scoringMode !== 'side-out') {
      setServingTeam(serveAfterPoint(rules, { score: newSets[currentSet], currentSet, sets: newSets, servingTeam, winner: team }));
    }

    if (rules.version === 1 && endChangeDue(rules, currentSet, newSets[currentSet]) && !endChangeDue(rules, currentSet, sets[currentSet])) setSidesSwapped(prev => !prev);

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
        setSets(newSets);
        return;
      }

      // Best-of format: check if match complete
      const t1SetsWon = newSets.filter(s => s.completed && s.score1 > s.score2).length;
      const t2SetsWon = newSets.filter(s => s.completed && s.score2 > s.score1).length;
      const setsToWin = rules.setsToWin;

      if (t1SetsWon >= setsToWin || t2SetsWon >= setsToWin) {
        // Match complete - trigger confetti
        triggerConfetti();
        triggerHaptic([100, 100, 100, 100, 100]); // Victory pattern
        setSets(newSets);
        return;
      }

      // Start next set
      if (currentSet < effectiveFormat.sets - 1) {
        newSets.push({ score1: 0, score2: 0, completed: false });
        setCurrentSet(prev => prev + 1);
        if (rules.version === 1) {
          setServingTeam(firstServerForSet(rules, currentSet + 1, newSets));
          if (rules.endChangeBetweenSets) setSidesSwapped(prev => !prev);
        }
      }
    }

    setSets(newSets);
  };

  // Per-point correction (-1) for a team — fixes a mis-tap without unwinding the
  // whole undo stack. Floors at 0, records undo history, and recomputes tracked
  // service/end changes without completing a game. A missing rally winner stays unknown.
  // Mirrored to the broadcast as a value:-1 point so spectators stay in sync.
  const correctPoint = (team) => {
    if (!sportConfig || !tournament || isInteractionLocked || completion.locked) return;

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
      sidesSwapped,
    }].slice(-100));

    setHasChanges(true);

    broadcastIntentRef.current = { kind: 'correction', team: team === 1 ? 'A' : 'B', value: -1, at: Date.now() };

    const newSets = sets.map(s => ({ ...s }));
    newSets[currentSet][scoreKey] = Math.max(0, newSets[currentSet][scoreKey] - 1);
    if (rules.version === 1) {
      setServingTeam(serveAfterPoint(rules, { score: newSets[currentSet], currentSet, sets: newSets, servingTeam, winner: null }));
      if (endChangeDue(rules, currentSet, newSets[currentSet]) !== endChangeDue(rules, currentSet, sets[currentSet])) setSidesSwapped(prev => !prev);
    }
    setSets(newSets);
  };

  // Undo last action
  const undo = () => {
    if (history.length === 0 || isInteractionLocked || completion.locked) return;

    broadcastIntentRef.current = { kind: 'undo', at: Date.now() };
    const last = history[history.length - 1];
    setSets(last.sets);
    setCurrentSet(last.currentSet);
    if (Object.hasOwn(last, 'servingTeam')) setServingTeam(last.servingTeam);
    if (typeof last.sidesSwapped === 'boolean') setSidesSwapped(last.sidesSwapped);
    // Frozen (version 1) rules own the scoring mode; only legacy matches restore it from history.
    if (last.scoringMode) setScoringMode(last.scoringMode);
    setHistory(prev => prev.slice(0, -1));
  };

  // Auto-save the in-progress match to the tournament on every scoring change, so
  // leaving the scorer always keeps progress — no manual "Save Draft". "Discard"
  // clears this draft (reverts to the committed match); "Save" commits via saveMatch.
  useEffect(() => {
    if (!tournament || !matchId || isInteractionLocked) return;
    if (history.length === 0 && !scoringStarted && !hasChanges) return;
    const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
      ...m,
      status: 'in-progress',
      format: { ...effectiveFormat, scoringMode },
      draftState: {
        scoringStarted,
        currentSet,
        sets: structuredClone(sets),
        history: structuredClone(history.slice(-50)),
        servingTeam,
        scoringMode,
        sidesSwapped,
        savedAt: new Date().toISOString(),
      },
    }));
    saveSportTournament(sportConfig.storageKey, updatedTournament);
  }, [tournament, matchId, isInteractionLocked, sets, currentSet, history, scoringStarted, servingTeam, scoringMode, effectiveFormat, sportConfig, sidesSwapped, hasChanges]);

  // Broadcast the latest point/undo AFTER its state commits (§87d snapshot): a
  // point may end a set and open the next, so we read the settled sets/serving
  // here rather than guessing the post-update score inside addPoint.
  useEffect(() => {
    const intent = broadcastIntentRef.current;
    if (!intent) return;
    broadcastIntentRef.current = null;

    const completed = sets.filter((s) => s.completed);
    const showServe = rules?.version === 1 || scoringMode === 'side-out' || Boolean(sportConfig?.config?.serviceRotation);
    const snapshot = {
      pointsA: sets[currentSet]?.score1 || 0,
      pointsB: sets[currentSet]?.score2 || 0,
      setsA: completed.filter((s) => s.score1 > s.score2).length,
      setsB: completed.filter((s) => s.score2 > s.score1).length,
      setScores: completed.map((s) => ({ a: s.score1, b: s.score2 })),
      servingTeam: showServe ? broadcastServer(servingTeam) : undefined,
      currentUnit: currentSet + 1,
      periodLabel: `${rules?.unit || 'Set'} ${currentSet + 1}`,
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
      const broadcastType = intent.type || (intent.kind === 'serve'
        ? 'serve_change'
        : intent.kind === 'correction'
          ? 'correction'
          : 'point');
      liveRef.current.point({ team: intent.team, value: intent.value ?? 1, type: broadcastType, at: intent.at, snapshot });
    }
  }, [sets, currentSet, servingTeam, scoringMode, sportConfig, rules]);

  // Save match and return
  const saveMatch = () => {
    if (isInteractionLocked) return;
    if (completion.locked) return;

    // Save all sets that have any score (including in-progress)
    const setsToSave = sets
      .filter(s => s.score1 > 0 || s.score2 > 0)
      .map(s => ({ ...s, completed: s.completed || false }));

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
      const setsToWin = rules.setsToWin;
      isMatchComplete = t1SetsWon >= setsToWin || t2SetsWon >= setsToWin;
    }

    const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
      ...m,
      sets: setsToSave,
      status: isMatchComplete ? 'completed' : 'in-progress',
      winner: isMatchComplete ? (t1SetsWon > t2SetsWon ? m.team1Id : m.team2Id) : null,
      format: { ...effectiveFormat, scoringMode },
      setsWon1: t1SetsWon,
      setsWon2: t2SetsWon,
      scoringMode,
      completedAt: isMatchComplete ? new Date().toISOString() : m.completedAt,
      draftState: isMatchComplete ? undefined : {
        scoringStarted,
        currentSet,
        sets: structuredClone(sets),
        history: structuredClone(history.slice(-50)),
        servingTeam,
        scoringMode,
        sidesSwapped,
        savedAt: new Date().toISOString(),
      },
    }));

    completion.complete(() => {
      const ok = saveSportTournament(sportConfig.storageKey, updatedTournament);
      if (!ok) {
        setSaveWarning('Save failed - storage may be full. Export your data.');
        return false;
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
    });
  };

  // Keyboard shortcuts (skip on touch-only devices)
  useEffect(() => {
    if (isTouchDevice) return;

    const handleKeyPress = (e) => {
      if (isInteractionLocked) return;
      if (completion.locked) return;
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
    if (completion.locked) return;
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
  const handleDiscard = () => scoringPrompt.requestPrompt({
    cancelLabel: 'Keep scoring', confirmLabel: 'Discard', tone: 'danger', type: 'discard', title: 'Discard changes?',
    message: `Delete ${team1Name} v ${team2Name}, ${sets[currentSet]?.score1 || 0}–${sets[currentSet]?.score2 || 0}? This can't be undone.`,
  });
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
  const showServeIndicator = rules?.version === 1 || scoringMode === 'side-out' || Boolean(sportConfig?.config?.serviceRotation);
  const leftServing = sidesSwapped ? servingTeam === 2 : servingTeam === 1;
  const rightServing = sidesSwapped ? servingTeam === 1 : servingTeam === 2;
  const canToggleScoringMode = availableScoringModes.includes('side-out') && availableScoringModes.includes('rally') && (rules.version === 0 || (!scoringStarted && history.length === 0));
  // Broadcast scorecard kind, derived from the sport's ENGINE rather than
  // hardcoded (#108). Every sport this scorer drives (volleyball, badminton,
  // tabletennis) is engine 'sets' and renders through the
  // watch's points-per-set scorebug, whose kind is 'volleyball'. Deriving by
  // engine — instead of the sport id — avoids regressing the watch to the
  // generic card (its ScorecardPanel only special-cases 'volleyball'/'tennis').
  // Tennis routes to its own scorer, so it never reaches here.
  const liveScorecardKind = sportConfig?.engine === 'sets' ? 'volleyball' : 'generic';

  const { winBy } = rules;
  const formatType = effectiveFormat.type || 'best-of';
  const targetPoints = getCurrentSetTarget(currentSet);
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
    if (completion.locked) return;
    setSidesSwapped(prev => !prev);
  };
  const handleToggleScoringMode = () => {
    if (isInteractionLocked) return;
    if (completion.locked) return;
    const next = scoringMode === 'side-out' ? 'rally' : 'side-out';
    if (!availableScoringModes.includes(next)) return;
    if (rules.version === 1 && scoringStarted) return;
    setScoringMode(next);
    if (rules.version === 1) updatePendingRules({ ...effectiveFormat, scoringMode: next });
    if (rules.version === 0) setServingTeam(1);
  };

  const updatePendingRules = (format) => {
    if (scoringStarted || history.length || completion.locked) return;
    const captured = freezeSetsFormat(sportConfig, { ...format, setsRules: undefined });
    setFrozenFormat(captured);
    setServingTeam(captured.setsRules.initialServer);
    setScoringMode(captured.setsRules.scoringMode);
    const updated = updateMatchInTournament(tournament, matchId, m => ({ ...m, format: captured }));
    if (!saveSportTournament(sportConfig.storageKey, updated)) setSaveWarning('Save failed - storage may be full. Export your data.');
  };
  const chooseSetServer = (team) => {
    if (completion.locked || isInteractionLocked) return;
    if (team == null && servingTeam == null) return;
    setHistory(prev => [...prev, { sets: structuredClone(sets), currentSet, servingTeam, sidesSwapped, scoringMode }].slice(-100));
    const next = structuredClone(sets);
    if (rules.serviceMode === 'alternating' || (!next[currentSet].score1 && !next[currentSet].score2)) next[currentSet] = { ...next[currentSet], firstServer: team };
    setSets(next);
    setServingTeam(rules.serviceMode === 'alternating' ? serveAfterPoint(rules, { score: next[currentSet], currentSet, sets: next, servingTeam: team }) : team);
    setHasChanges(true);
    broadcastIntentRef.current = { kind: 'serve', type: team == null ? 'correction' : 'serve_change', team: broadcastServer(team ?? servingTeam), value: 0, at: Date.now() };
  };
  const pendingRules = rules.version === 1 && !scoringStarted && history.length === 0;
  const serviceControls = rules.version === 1 && <>
    {pendingRules ? <SetsRulesControls sport={sport} format={effectiveFormat} onChange={updatePendingRules} names={[team1Name, team2Name]} />
      : <ServerChoice label={rules.serviceMode === 'alternating' ? `First server this ${rules.unit.toLowerCase()}` : 'Serving team'} value={rules.serviceMode === 'alternating' ? firstServerForSet(rules, currentSet, sets) : servingTeam} onChange={chooseSetServer} names={[team1Name, team2Name]} />}
  </>;

  if (isTeamColourTournamentSport(sport)) {
    const halves = [leftTeam, rightTeam].map(team => ({
      key: team === 1 ? 'a' : 'b', team,
      name: team === 1 ? team1Name : team2Name,
      score: sets[currentSet]?.[team === 1 ? 'score1' : 'score2'] || 0,
      serving: showServeIndicator && servingTeam === team,
      correctionDisabled: (sets[currentSet]?.[team === 1 ? 'score1' : 'score2'] || 0) <= 0,
    }));
    const completedSets = sets.filter(s => s.completed);
    const wins = team => completedSets.filter(s => team === 1 ? s.score1 > s.score2 : s.score2 > s.score1).length;
    // Probe the same frozen completion predicate that handles a scoring tap.
    const nextWinners = canScoreCurrentSet ? [1, 2].filter(team => {
      const next = { ...sets[currentSet] };
      next[team === 1 ? 'score1' : 'score2']++;
      return (scoringMode !== 'side-out' || servingTeam === team) && checkSetComplete(next);
    }) : [];
    const isMatchPoint = team => formatType === 'single' || wins(team) + 1 >= Math.ceil(effectiveFormat.sets / 2);
    const pointCue = nextWinners.length === 1
      ? `${isMatchPoint(nextWinners[0]) ? 'Match' : rules.unit} point · ${nextWinners[0] === 1 ? team1Name : team2Name}`
      : '';
    const last = history.at(-1);
    const undoSet = last?.sets[last.currentSet];
    const undoHint = undoSet
      ? `back to ${halves.map(h => undoSet[h.team === 1 ? 'score1' : 'score2']).join('–')} · ${rules.unit} ${last.currentSet + 1}`
      : '';
    return (
      <>
        <h1 className="sr-only">{sportConfig.name} match scorer</h1>
        {scoringPrompt.renderPrompt(confirmPendingPrompt)}
        <TeamSetsBoard
          title={`${team1Name} v ${team2Name}`}
          subtitle={`${sportConfig.name} · ${targetPoints} points to win · Win by ${winBy}`}
          sportColour={sportIdentity(sport)?.core}
          setUnit={rules.unit}
          colourStyle={teamColourStyle}
          halves={halves}
          isLive={Boolean(live.isLive)}
          meta={[formatType === 'single' ? `Single ${rules.unit}` : `${rules.unit} ${currentSet + 1} of ${rules.sets}`, `${rules.unit}s ${wins(leftTeam)}–${wins(rightTeam)}`, ...(rules.version === 1 && servingTeam == null ? ['Server unknown'] : [])]}
          pointCue={pointCue}
          lastLine={isCurrentSetComplete ? 'Match complete · Finish to save result' : `Score ${leftScore}–${rightScore} · ${scoringMode === 'side-out' ? 'Side-out' : 'Rally'}`}
          setHistory={completedSets.map((s, i) => ({
            label: `${rules.unit} ${i + 1}`,
            left: s[leftTeam === 1 ? 'score1' : 'score2'], right: s[rightTeam === 1 ? 'score1' : 'score2'],
            winnerKey: s.score1 > s.score2 ? 'a' : 'b', winnerName: s.score1 > s.score2 ? team1Name : team2Name,
          }))}
          canUndo={history.length > 0 && !isInteractionLocked}
          undoHint={undoHint}
          onUndo={undo} onPoint={addPoint} onSwap={handleSwapSides} onCorrect={correctPoint}
          onDiscard={handleDiscard} onFinish={saveMatch}
          scoringDisabled={!canScoreCurrentSet} controlsDisabled={isInteractionLocked}
          notice={saveWarning && <div className="mono-alert mono-alert-danger" role="alert">{saveWarning}</div>}
          live={<LiveBroadcastBar broadcast={live} descriptor={{ clientMatchId: liveClientMatchId, sport, scorecardKind: liveScorecardKind, teamA: { name: team1Name }, teamB: { name: team2Name } }} enabled={liveEnabled} onEnableChange={setLiveEnabled} />}
          options={(
            <BoardSheetGroup>
              <p className="sb-sheet-note"><b>{tournament.name}</b> · {targetPoints} points to win · Win by {winBy}</p>
              {serviceControls}
              <button type="button" className="sb-row" onClick={navigateToTournament}>Back to tournament</button>
              {canToggleScoringMode && <button type="button" className="sb-row" title="Toggle scoring model" disabled={isInteractionLocked} onClick={handleToggleScoringMode}>{scoringMode === 'side-out' ? 'Side-out' : 'Rally'}</button>}
              {!isTouchDevice && <p className="sb-sheet-note">Keyboard: Q = {leftName} · P = {rightName} · U = Undo</p>}
            </BoardSheetGroup>
          )}
        />
        {showSetWon && <div className="mono-set-won mono-set-won-animate">{setWonTeam} wins {rules.unit} {setWonNumber}!</div>}
      </>
    );
  }

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
        {rules.version === 1 && servingTeam == null && <p role="status">Server unknown</p>}
        {rules.version === 1 && <details><summary style={{ minHeight: 44 }}>Service and rules</summary>{serviceControls}</details>}
        {/* Top bar */}
        <div className="mono-scorer-topbar">
          <span className="text-sm font-swiss" style={{ color: 'var(--se-color-ink-muted)' }}>
            {sportConfig?.name || 'Match'}
          </span>
          <div className="mono-scorer-topbar-actions">
            <span className={`mono-badge ${isCurrentSetComplete ? 'mono-badge-final' : 'mono-badge-live'}`}>
              {formatType === 'single' ? `Single ${rules.unit}` : `${rules.unit} ${currentSet + 1} of ${rules.sets}`}
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
          {team1Name}: {sets[currentSet]?.score1 || 0}. {team2Name}: {sets[currentSet]?.score2 || 0}. {rules.unit} {currentSet + 1} of {rules.sets}.
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
                  {rules.unit} {i + 1}: {s.score1}-{s.score2}
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
          {setWonTeam} wins {rules.unit} {setWonNumber}!
        </div>
      )}
    </div>
  );
}

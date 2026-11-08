import { createPeriodMatch, applyPeriodAction, undoPeriodAction, periodTotals, periodResultDecided, freezePeriodMatch, periodPlayedSeconds, periodSnapshot } from '../../../utils/goalsPeriods';
import { useGoalsPeriodClock } from '../../../hooks/useGoalsPeriodClock';
import GoalsPeriodControls from './GoalsPeriodControls';
import TeamGoalsBoard from './TeamGoalsBoard';
import { useTeamColours } from './useTeamColours';
import { DEFAULT_TEAM_COLOURS } from '../../../lib/teamColour';
import { EARLY_FINISH_MESSAGE } from '../../../utils/matchOutcome';
import { isGoalsMatchDecided } from '../../../utils/goalsScoring';
import { useScoringProgress } from './scoringProgressContext';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSportById } from '../../../models/sportRegistry';
import { loadSportTournaments, saveSportTournament } from '../../../utils/storage';
import { updateMatchInTournament } from '../../../utils/knockoutManager';
import { useTimer } from '../../../hooks/useTimer';
import { useTournamentMatchSync } from '../../../hooks/useTournamentMatchSync';
import {
  getBasketballCompletionState,
  getFootballClockState,
  getFootballHalfLengthSeconds,
  getFootballMatchLimitSeconds,
  getTimedPeriodLimit,
  getTimedRemainingSeconds,
} from '../../../utils/goalsScoring';
import { useAppScoringPrompt } from '../components/AppScoringPrompt';
import { triggerConfetti } from '../utils/confetti';
import { useLiveBroadcast } from '../../../hooks/useLiveBroadcast';
import LiveBroadcastBar from '../live/LiveBroadcastBar';
import { useMatchCompletion } from '../../../hooks/useMatchCompletion';
import { useScoringCompletion } from './scoringCompletionContext';

const isTouchDevice = 'ontouchstart' in globalThis || navigator.maxTouchPoints > 0;

// Determine match winner from scores
const determineWinner = (s1, s2, match) => {
  if (s1 > s2) return match.team1Id;
  if (s2 > s1) return match.team2Id;
  return 'draw';
};

// Haptic feedback helper
const triggerHaptic = (pattern) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

export default function MonoGoalsLiveScore() {
  const navigate = useNavigate();
  const completeProtectedScoring = useScoringCompletion();
  const { sport, id, matchId } = useParams();
  const saveTournamentToConvex = useTournamentMatchSync({ sport, matchId });
  const navigateToTournament = () => navigate(`/${sport}/tournament/${id}`);
  const completeMatch = useCallback(() => {
    const tournamentPath = `/${sport}/tournament/${id}`;
    if (completeProtectedScoring) {
      completeProtectedScoring(tournamentPath);
    } else {
      navigate(tournamentPath, { replace: true });
    }
  }, [completeProtectedScoring, navigate, sport, id]);

  // Core state
  const [sportConfig, setSportConfig] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [match, setMatch] = useState(null);

  // Scoring state
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [history, setHistory] = useState([]);
  const [periodState, setPeriodState] = useState(null);
  const periodTime = useGoalsPeriodClock(periodState);
  const colourStyle = useTeamColours(DEFAULT_TEAM_COLOURS.a, DEFAULT_TEAM_COLOURS.b, sport);
  const [hasChanges, setHasChanges] = useState(false);
  const [sidesSwapped, setSidesSwapped] = useState(false);
  const [scoreAnimKey, setScoreAnimKey] = useState({ left: 0, right: 0 });
  const [saveWarning, setSaveWarning] = useState('');
  const [overtimePeriod, setOvertimePeriod] = useState(0);
  const completion = useMatchCompletion();
  const scoringPrompt = useAppScoringPrompt(completion);
  const showScoringWarning = scoringPrompt.showWarning;

  // Live broadcast (dkt/b0z/6fj): mirror each scoring action to the public watch
  // page. Purely additive — localStorage stays authoritative; a failed push never
  // breaks scoring. Sharing starts off and needs an explicit action for this match.
  const [liveEnabled, setLiveEnabled] = useState(false);
  const live = useLiveBroadcast({ enabled: liveEnabled });
  const liveClientMatchId = `${sport}:${id}:${matchId}`;

  // Timer for timed mode
  const timer = useTimer();
  const [timerStarted, setTimerStarted] = useState(false);

  // Debounce ref for rapid clicks
  const lastClickRef = useRef(0);
  const isKnockoutRef = useRef(false);
  // Track current scores for history snapshots
  const score1Ref = useRef(score1);
  const score2Ref = useRef(score2);
  score1Ref.current = score1;
  score2Ref.current = score2;


  // Load tournament and match
  const { scoringStarted } = useScoringProgress(
    score1 !== 0 || score2 !== 0, false, match?.draftState?.scoringStarted, `${sport}:${id}:${matchId}`,
  );

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

    if (completion.hydrate(foundMatch, `${sport}:${id}:${matchId}`, completeMatch)) return;
    setSportConfig(config);
    setTournament(found);
    setMatch(foundMatch);
    const frozen = foundMatch.draftState?.periodState || foundMatch.periodState;
    const matchFormat = isKnockoutRef.current && found.knockoutConfig?.format ? found.knockoutConfig.format : found.format;
    setPeriodState(frozen?.version === 1 ? frozen : matchFormat?.periods?.version === 1 ? createPeriodMatch(matchFormat.periods, Date.now()) : null);

    // Initialize from existing score if editing
    if (foundMatch.score1 !== null && foundMatch.score1 !== undefined && !foundMatch.draftState) {
      setScore1(foundMatch.score1);
      setScore2(foundMatch.score2);
    }

    // Restore from draft if exists
    if (foundMatch.draftState) {
      setScore1(foundMatch.draftState.score1);
      setScore2(foundMatch.draftState.score2);
      setHistory(foundMatch.draftState.history || []);
    }
  }, [sport, id, matchId]);

  // Effective format: use knockout format for knockout matches
  const effectiveFormat = isKnockoutRef.current && tournament?.knockoutConfig?.format
    ? tournament.knockoutConfig.format
    : tournament?.format;

  const buildLiveSnapshot = (pointsA = score1, pointsB = score2, state = periodState) => ({
    pointsA, pointsB, setsA: 0, setsB: 0, setScores: [], currentUnit: 1,
    periodLabel: sportConfig?.name,
    ...(state ? periodSnapshot(state, pointsA, pointsB) : {}),
  });

  // Start timer for timed mode
  useEffect(() => {
    if (!tournament || !timerStarted) return;
    const formatMode = effectiveFormat?.mode;
    if (formatMode === 'timed' && effectiveFormat?.timeLimit) {
      timer.start();
    }
  }, [tournament, timerStarted]);

  const isDecidedScore = (a, b) => periodState ? periodResultDecided(periodState, a, b, sportConfig.config.drawAllowed) : isGoalsMatchDecided({ format: effectiveFormat, score1: a, score2: b,
    elapsedSeconds: timer.elapsed, drawAllowed: sportConfig.config.drawAllowed,
    timeLimit: sport === 'football' ? getFootballMatchLimitSeconds({ timeLimitSeconds: effectiveFormat.timeLimit, timePresets: sportConfig.config.timePresets }) : effectiveFormat.timeLimit,
    overtimePeriod });
  const finishMatch = (finalScore1, finalScore2) => completion.complete(() => {
    const decided = isDecidedScore(finalScore1, finalScore2);
    const frozenPeriod = periodState ? freezePeriodMatch(periodState, Date.now(), decided) : null;
    const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
      ...m,
      score1: finalScore1,
      score2: finalScore2,
      status: 'completed',
      ...(frozenPeriod ? { periodState: frozenPeriod } : {}),
      resultType: decided ? 'decided' : 'abandoned',
      winner: decided ? determineWinner(finalScore1, finalScore2, m) : null,
      draftState: undefined,
      completedAt: new Date().toISOString(),
      ...(frozenPeriod ? { elapsedSeconds: periodPlayedSeconds(frozenPeriod, Date.now()) } : {}),
    }));
    if (!saveSportTournament(sportConfig.storageKey, updatedTournament)) {
      setSaveWarning('Save failed - storage may be full. Export your data.');
      return false;
    }
    setSaveWarning('');
    saveTournamentToConvex(updatedTournament);
    if (frozenPeriod) setPeriodState(frozenPeriod);
    live.finalize({ resultType: decided ? 'decided' : 'abandoned', ...(frozenPeriod ? { snapshot: periodSnapshot(frozenPeriod, finalScore1, finalScore2) } : {}) });
    return true;
  }, completeMatch, 300);

  // Auto-end match when time expires in timed mode
  useEffect(() => {
    if (!tournament || !sportConfig || scoringPrompt.isInteractionLocked) return undefined;
    if (periodState) return undefined;
    const formatMode = effectiveFormat?.mode;
    const timeLimit = effectiveFormat?.timeLimit;
    const timedMatchLimit = sport === 'football'
      ? getFootballMatchLimitSeconds({ timeLimitSeconds: timeLimit, timePresets: sportConfig.config.timePresets })
      : timeLimit;
    const currentPeriodLimit = getTimedPeriodLimit({ timeLimit: timedMatchLimit, overtimePeriod });

    if (formatMode === 'timed' && timedMatchLimit && timer.elapsed >= currentPeriodLimit) {
      const completionState = getBasketballCompletionState({
        score1,
        score2,
        drawAllowed: sportConfig.config.drawAllowed,
        overtimePeriod,
      });
      if (!completionState.canComplete) {
        setOvertimePeriod((period) => period + 1);
        showScoringWarning(completionState.message);
        return undefined;
      }

      // Time's up - auto-save match
      triggerConfetti();
      triggerHaptic([100, 100, 100, 100, 100]);

      finishMatch(score1, score2);
    }

    return undefined;
  }, [timer.elapsed, tournament, sportConfig, score1, score2, matchId, sport, completeMatch, scoringPrompt.isInteractionLocked, showScoringWarning, overtimePeriod]);

  // Add point/goal
  const addScore = (team, value = 1) => {
    if (!sportConfig || !tournament || scoringPrompt.isInteractionLocked) return;

    // Check if time is up in timed mode
    const formatMode = effectiveFormat?.mode;
    const timeLimit = effectiveFormat?.timeLimit;
    const timedMatchLimit = sport === 'football'
      ? getFootballMatchLimitSeconds({ timeLimitSeconds: timeLimit, timePresets: sportConfig.config.timePresets })
      : timeLimit;
    const currentPeriodLimit = getTimedPeriodLimit({ timeLimit: timedMatchLimit, overtimePeriod });
    if (periodState ? periodState.phase !== 'playing' : formatMode === 'timed' && timedMatchLimit && timer.elapsed >= currentPeriodLimit) {
      return; // Don't allow scoring after time expires
    }

    // Debounce rapid clicks
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;

    // Start timer on first action (timed mode)
    if (!timerStarted) {
      setTimerStarted(true);
    }

    // Haptic feedback: short pulse on score
    triggerHaptic(50);

    // Save to history BEFORE modifying (use refs for current values)
    setHistory(prev => [...prev, {
      timestamp: Date.now(),
      score1: score1Ref.current,
      score2: score2Ref.current,
    }].slice(-100));

    setHasChanges(true);
    setScoreAnimKey(prev => ({ ...prev, [team === 1 ? 'left' : 'right']: (prev[team === 1 ? 'left' : 'right'] || 0) + 1 }));

    // Calculate new scores
    const newScore1 = team === 1 ? score1Ref.current + value : score1Ref.current;
    const newScore2 = team === 2 ? score2Ref.current + value : score2Ref.current;

    // Update score
    if (team === 1) {
      setScore1(newScore1);
    } else {
      setScore2(newScore2);
    }

    // Mirror to the live broadcast (no-op when not broadcasting). team1 -> A.
    const nextPeriod = periodState ? applyPeriodAction(periodState, { type: 'score', team: team === 1 ? 'A' : 'B', value, at: Date.now() }) : null;
    if (nextPeriod) setPeriodState(nextPeriod);
    live.point({ team: team === 1 ? 'A' : 'B', value, at: Date.now(), snapshot: buildLiveSnapshot(newScore1, newScore2, nextPeriod) });

    // Auto-end in points mode (formatMode already declared above)
    if ((formatMode || 'free') === 'points' && effectiveFormat.target) {
      if (newScore1 >= effectiveFormat.target || newScore2 >= effectiveFormat.target) {
        triggerConfetti();
        triggerHaptic([100, 100, 100, 100, 100]);

        finishMatch(newScore1, newScore2);
      }
    }
  };

  // Undo last action
  const undo = () => {
    if (scoringPrompt.isInteractionLocked) return;
    if (periodState) {
      const next = undoPeriodAction(periodState, Date.now()); const totals = periodTotals(next);
      setPeriodState(next); setScore1(totals.A); setScore2(totals.B);
      live.point({ team: 'A', value: 0, type: 'correction', at: Date.now(), snapshot: buildLiveSnapshot(totals.A, totals.B, next) });
      return;
    }
    if (history.length === 0) return;

    const last = history[history.length - 1];
    setScore1(last.score1);
    setScore2(last.score2);
    setHistory(prev => prev.slice(0, -1));
    live.undo({ at: Date.now(), snapshot: buildLiveSnapshot(last.score1, last.score2) });
  };

  // Auto-save the in-progress match to the tournament on every score change, so
  // leaving the scorer always keeps progress — no manual "Save Draft". "Discard"
  // clears this draft (reverts to the committed match); "Save" commits via saveMatch.
  useEffect(() => {
    if (!tournament || !matchId || scoringPrompt.isInteractionLocked) return;
    if (!periodState && history.length === 0 && !scoringStarted) return;
    const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
      ...m,
      status: 'in-progress',
      draftState: {
        scoringStarted,
        ...(periodState ? { periodState } : {}),
        score1,
        score2,
        history: structuredClone(history.slice(-50)),
        savedAt: new Date().toISOString(),
      },
    }));
    saveSportTournament(sportConfig.storageKey, updatedTournament);
  }, [periodState, tournament, matchId, score1, score2, history, scoringStarted, sportConfig, scoringPrompt.isInteractionLocked]);

  // Keyboard input shares the current handlers, including the latest broadcast and period state.
  const keyboardActionsRef = useRef(null);
  keyboardActionsRef.current = { addScore, undo, leftTeam: sidesSwapped ? 2 : 1, rightTeam: sidesSwapped ? 1 : 2 };

  // Keyboard shortcuts (skip on touch-only devices)
  useEffect(() => {
    if (isTouchDevice) return;

    const handleKeyPress = (e) => {
      if (scoringPrompt.isInteractionLocked) return;
      // Ignore if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'q':
          keyboardActionsRef.current.addScore(keyboardActionsRef.current.leftTeam, 1);
          break;
        case 'p':
          keyboardActionsRef.current.addScore(keyboardActionsRef.current.rightTeam, 1);
          break;
        case 'u':
          keyboardActionsRef.current.undo();
          break;
        default:
          break;
      }
    };

    globalThis.addEventListener('keydown', handleKeyPress);
    return () => globalThis.removeEventListener('keydown', handleKeyPress);
  }, [sidesSwapped, scoringPrompt.isInteractionLocked]);

  // Save match and return
  const saveMatch = (confirmed = false) => {
    confirmed = confirmed === true;
    if (!confirmed && scoringPrompt.isInteractionLocked) return;
    if (!isDecidedScore(score1, score2)) {
      if (!confirmed) {
        scoringPrompt.requestPrompt({ type: 'early-finish', title: 'End match?', message: EARLY_FINISH_MESSAGE, confirmLabel: 'End match', cancelLabel: 'Keep scoring' });
        return;
      }
      finishMatch(score1, score2);
      return;
    }

    const completionState = getBasketballCompletionState({
      score1,
      score2,
      drawAllowed: sportConfig.config.drawAllowed,
      overtimePeriod,
    });
    if (!completionState.canComplete) {
      setOvertimePeriod((period) => period + 1);
      showScoringWarning(completionState.message);
      return;
    }

    // Trigger celebration for completed match
    if (score1 !== 0 || score2 !== 0) {
      triggerConfetti();
      triggerHaptic([100, 100, 100, 100, 100]); // Victory pattern
    }

    finishMatch(score1, score2);
  };

  // Cancel and return
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
        status: m.score1 || m.score2 || m.winner ? m.status : 'pending',
      }));
      saveSportTournament(sportConfig.storageKey, reverted);
    }
    navigateToTournament();
  };
  const handleDiscard = () => scoringPrompt.requestPrompt({
    cancelLabel: 'Keep scoring', confirmLabel: 'Discard', tone: 'danger', type: 'discard', title: 'Discard changes?',
    message: `Delete ${team1Name} v ${team2Name}, ${score1}–${score2}? This can't be undone.`,
  });
  const confirmPendingPrompt = () => {
    if (scoringPrompt.pendingPrompt?.type === 'early-finish') { scoringPrompt.closePrompt(); saveMatch(true); return; }
    scoringPrompt.confirmDiscard(discardAndExit);
  };

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
  const quickButtons = sportConfig.config.quickButtons;

  const liveDescriptor = {
    snapshot: buildLiveSnapshot(),
    clientMatchId: liveClientMatchId,
    sport,
    scorecardKind: 'goals',
    teamA: { name: team1Name },
    teamB: { name: team2Name },
  };

  // Side swap helpers
  const leftTeam = sidesSwapped ? 2 : 1;
  const rightTeam = sidesSwapped ? 1 : 2;
  const leftName = sidesSwapped ? team2Name : team1Name;
  const rightName = sidesSwapped ? team1Name : team2Name;
  const leftScore = sidesSwapped ? score2 : score1;
  const rightScore = sidesSwapped ? score1 : score2;
  // Score colour follows the lead: ahead = green, tied = brown (both), trailing = ink.
  const teamAccent = (mine, other) =>
    mine > other ? 'var(--primary)' : mine === other ? 'var(--se-color-warning)' : 'var(--se-color-ink)';

  // Timed mode helpers
  const isTimedMode = effectiveFormat?.mode === 'timed';
  const timeLimit = isTimedMode ? effectiveFormat.timeLimit : null;
  const timedMatchLimit = sport === 'football' && timeLimit
    ? getFootballMatchLimitSeconds({
      timeLimitSeconds: timeLimit,
      timePresets: sportConfig.config.timePresets,
    })
    : timeLimit;
  const remainingSeconds = isTimedMode && timedMatchLimit
    ? getTimedRemainingSeconds({ elapsedSeconds: timer.elapsed, timeLimit: timedMatchLimit, overtimePeriod })
    : null;
  const isTimeUp = !periodState && isTimedMode && remainingSeconds === 0;
  const footballClockState = sport === 'football' && isTimedMode
    ? getFootballClockState({
      elapsedSeconds: timer.elapsed,
      halfLengthSeconds: getFootballHalfLengthSeconds({
        timeLimitSeconds: timeLimit,
        timePresets: sportConfig.config.timePresets,
      }),
    })
    : null;

  const formatCountdown = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (periodState) {
    const periodAction = (type) => {
      if (scoringPrompt.isInteractionLocked) return;
      const next = applyPeriodAction(periodState, { type, at: Date.now() });
      setPeriodState(next);
      live.point({ team: 'A', value: 0, type: 'correction', at: Date.now(), snapshot: buildLiveSnapshot(score1, score2, next) });
    };
    const halves = [leftTeam, rightTeam].map(team => ({ key: team === 1 ? 'a' : 'b', team, name: team === 1 ? team1Name : team2Name, score: team === 1 ? score1 : score2 }));
    return <>
      <h1 className="sr-only">{sportConfig.name} match scorer</h1>
      {scoringPrompt.renderPrompt(confirmPendingPrompt)}
      <TeamGoalsBoard sportConfig={sportConfig} title={`${team1Name} v ${team2Name}`} subtitle={periodState.source || effectiveFormat.periods?.source}
        colourStyle={colourStyle} halves={halves} clock={periodTime.formatted} clockLabel="Time remaining"
        status={`${periodTime.label}${periodState.startedAt == null && periodState.phase === 'playing' ? ' · paused' : ''}`}
        scoringLocked={periodState.phase !== 'playing' || scoringPrompt.isInteractionLocked}
        lastLine="Score for either team" actionCount={periodState.history.length} canUndo={periodState.history.length > 0 && !scoringPrompt.isInteractionLocked}
        undoHint="Previous action" isLive={Boolean(live.isLive)} onScore={addScore} onUndo={undo} onSwap={() => setSidesSwapped(v => !v)}
        onCorrect={team => {
          const next = applyPeriodAction(periodState, { type: 'score', team: team === 1 ? 'A' : 'B', value: -1, at: Date.now() });
          const totals = periodTotals(next); setPeriodState(next); setScore1(totals.A); setScore2(totals.B);
          live.point({ team: 'A', value: 0, type: 'correction', at: Date.now(), snapshot: buildLiveSnapshot(totals.A, totals.B, next) });
        }} onFinish={saveMatch} onDiscard={handleDiscard}
        notice={saveWarning ? <p role="alert">{saveWarning}</p> : null}
        periodControls={<GoalsPeriodControls state={periodState} remaining={periodTime.remaining} onAction={periodAction} onFinish={saveMatch} locked={scoringPrompt.isInteractionLocked} tied={score1 === score2} />}
        live={<LiveBroadcastBar broadcast={live} descriptor={liveDescriptor} enabled={liveEnabled} onEnableChange={setLiveEnabled} />} />
    </>;
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
        {/* Top bar */}
        <div className="mono-scorer-topbar">
          <span className="text-sm font-swiss" style={{ color: 'var(--se-color-ink-muted)' }}>
            {sportConfig?.name || 'Match'}
          </span>
          <div className="mono-scorer-topbar-actions">
            {isTimedMode ? (
              <span className={`mono-badge ${isTimeUp ? 'mono-badge-paused' : 'mono-badge-live'}`} style={{ color: isTimeUp ? 'var(--destructive)' : undefined }}>
                {overtimePeriod > 0
                  ? `OT ${overtimePeriod}`
                  : footballClockState
                  ? `${footballClockState.label}${footballClockState.phase === 'full-time' ? '' : ` - ${formatCountdown(footballClockState.remainingSeconds)}`}`
                  : isTimeUp ? "Time's up!" : formatCountdown(remainingSeconds)}
              </span>
            ) : (
              <span className="mono-badge mono-badge-live">
                {overtimePeriod > 0 ? `OT ${overtimePeriod}` : effectiveFormat?.mode === 'points' ? `First to ${effectiveFormat.target}` : 'Live Scoring'}
              </span>
            )}
          </div>
        </div>

        {/* Live broadcast control (consent / LIVE indicator / share) */}
        <LiveBroadcastBar
          broadcast={live}
          descriptor={liveDescriptor}
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
          {leftName}: {leftScore}. {rightName}: {rightScore}.
        </div>

        {/* Score halves — same arena layout as the quick scorer. With quick
            buttons (e.g. basketball +1/+2/+3) the half is a display and the buttons
            sit below; otherwise the half itself taps to add a point. */}
        <div className="mono-arena-grid">
          {/* Left team */}
          <div className="mono-arena-col">
            {quickButtons ? (
              /* With quick buttons the half is a live SCORE DISPLAY (the buttons
                 below do the scoring), so render an informational element — not a
                 disabled <button>, which reads as a dead control (I-049). */
              <div
                role="img"
                data-leading={leftScore > rightScore ? 'true' : 'false'}
                aria-label={`${leftName} score: ${leftScore}`}
                className="mono-arena-half mono-arena-half-display"
                style={{ '--score-accent': teamAccent(leftScore, rightScore) }}
              >
                <span className="mono-arena-overline" style={{ color: teamAccent(leftScore, rightScore) }}>
                  {leftName}
                </span>
                <span
                  key={scoreAnimKey[sidesSwapped ? 'right' : 'left'] || 0}
                  className="mono-arena-num mono-score mono-score-animate mono-scorer-score-value"
                  style={{ color: teamAccent(leftScore, rightScore) }}
                >
                  {leftScore}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => addScore(leftTeam, 1)}
                disabled={isTimeUp || scoringPrompt.isInteractionLocked}
                data-leading={leftScore > rightScore ? 'true' : 'false'}
                aria-label={`Add 1 point to ${leftName}`}
                className="mono-arena-half"
                style={{ '--score-accent': teamAccent(leftScore, rightScore), touchAction: 'manipulation' }}
              >
                <span className="mono-arena-overline" style={{ color: teamAccent(leftScore, rightScore) }}>
                  {leftName}
                </span>
                <span
                  key={scoreAnimKey[sidesSwapped ? 'right' : 'left'] || 0}
                  className="mono-arena-num mono-score mono-score-animate mono-scorer-score-value"
                  style={{ color: teamAccent(leftScore, rightScore) }}
                >
                  {leftScore}
                </span>
                <span className="mono-arena-hint">Tap +1</span>
              </button>
            )}
            {quickButtons && (
              <div className="flex flex-col gap-2 w-full px-4" style={{ marginTop: 8 }}>
                {quickButtons.map((btn, idx) => (
                  <button
                    key={`left-btn-${btn.label}-${idx}`}
                    onClick={() => addScore(leftTeam, btn.value)}
                    className="mono-btn mono-arena-action"
                    style={{ touchAction: 'manipulation' }}
                    disabled={isTimeUp || scoringPrompt.isInteractionLocked}
                    aria-label={`Add ${btn.value} ${btn.value === 1 ? 'point' : 'points'} to ${leftName}`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right team */}
          <div className="mono-arena-col">
            {quickButtons ? (
              /* Informational score display (see left half, I-049). */
              <div
                role="img"
                data-leading={rightScore > leftScore ? 'true' : 'false'}
                aria-label={`${rightName} score: ${rightScore}`}
                className="mono-arena-half mono-arena-half-display"
                style={{ '--score-accent': teamAccent(rightScore, leftScore) }}
              >
                <span className="mono-arena-overline" style={{ color: teamAccent(rightScore, leftScore) }}>
                  {rightName}
                </span>
                <span
                  key={scoreAnimKey[sidesSwapped ? 'left' : 'right'] || 0}
                  className="mono-arena-num mono-score mono-score-animate mono-scorer-score-value"
                  style={{ color: teamAccent(rightScore, leftScore) }}
                >
                  {rightScore}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => addScore(rightTeam, 1)}
                disabled={isTimeUp || scoringPrompt.isInteractionLocked}
                data-leading={rightScore > leftScore ? 'true' : 'false'}
                aria-label={`Add 1 point to ${rightName}`}
                className="mono-arena-half"
                style={{ '--score-accent': teamAccent(rightScore, leftScore), touchAction: 'manipulation' }}
              >
                <span className="mono-arena-overline" style={{ color: teamAccent(rightScore, leftScore) }}>
                  {rightName}
                </span>
                <span
                  key={scoreAnimKey[sidesSwapped ? 'left' : 'right'] || 0}
                  className="mono-arena-num mono-score mono-score-animate mono-scorer-score-value"
                  style={{ color: teamAccent(rightScore, leftScore) }}
                >
                  {rightScore}
                </span>
                <span className="mono-arena-hint">Tap +1</span>
              </button>
            )}
            {quickButtons && (
              <div className="flex flex-col gap-2 w-full px-4" style={{ marginTop: 8 }}>
                {quickButtons.map((btn, idx) => (
                  <button
                    key={`right-btn-${btn.label}-${idx}`}
                    onClick={() => addScore(rightTeam, btn.value)}
                    className="mono-btn mono-arena-action"
                    style={{ touchAction: 'manipulation' }}
                    disabled={isTimeUp || scoringPrompt.isInteractionLocked}
                    aria-label={`Add ${btn.value} ${btn.value === 1 ? 'point' : 'points'} to ${rightName}`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <p className="text-xs text-center mb-2" style={{ color: 'var(--se-color-ink-faint)' }}>
          {isTimedMode ? `${Math.floor(timeLimit / 60)} min match` :
           effectiveFormat?.mode === 'points' ? `First to ${effectiveFormat.target}` : 'Free play'}
          {' · '}
          {sportConfig.config.drawAllowed ? 'Draws allowed' : 'No draws'}
        </p>
        {!isTouchDevice && (
          <p className="text-xs text-center mb-6" style={{ color: 'var(--se-color-ink-faint)' }}>
            Keyboard: Q = {leftName} &middot; P = {rightName} &middot; U = Undo
          </p>
        )}

        {/* Unified bottom bar — same thin line-divided row as every scorer.
            Saving is automatic; Save commits & returns, Discard reverts this match. */}
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
              onClick={() => { setSidesSwapped(s => !s); }}
              disabled={scoringPrompt.isInteractionLocked}
              className="mono-btn"
              style={{ opacity: scoringPrompt.isInteractionLocked ? 0.45 : 1, touchAction: 'manipulation' }}
            >
              Swap
            </button>
            <button onClick={handleDiscard} className="mono-btn">
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
    </div>
  );
}

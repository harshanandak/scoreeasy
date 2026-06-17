import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { getSportById } from '../../../models/sportRegistry';
import { loadSportTournaments, saveSportTournament } from '../../../utils/storage';
import { updateMatchInTournament } from '../../../utils/knockoutManager';
import { useTimer } from '../../../hooks/useTimer';
import { useAuth } from '../../../hooks/useAuth';
import { buildTournamentConvexPayload } from '../../../utils/tournamentSync';
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
  const { sport, id, matchId } = useParams();
  const { isAuthenticated } = useAuth();
  const saveMatchMutation = useMutation(api.matches.save);
  const navigateToTournament = () => navigate(`/${sport}/tournament/${id}`);

  // Core state
  const [sportConfig, setSportConfig] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [match, setMatch] = useState(null);

  // Scoring state
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [history, setHistory] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [sidesSwapped, setSidesSwapped] = useState(false);
  const [scoreAnimKey, setScoreAnimKey] = useState({ left: 0, right: 0 });
  const [saveWarning, setSaveWarning] = useState('');
  const [overtimePeriod, setOvertimePeriod] = useState(0);
  const scoringPrompt = useAppScoringPrompt();
  const showScoringWarning = scoringPrompt.showWarning;

  // Timer for timed mode
  const timer = useTimer();
  const [timerStarted, setTimerStarted] = useState(false);

  // Debounce ref for rapid clicks
  const lastClickRef = useRef(0);
  const isKnockoutRef = useRef(false);
  const autoFinishTimeoutRef = useRef(null);
  // Track current scores for history snapshots
  const score1Ref = useRef(score1);
  const score2Ref = useRef(score2);
  score1Ref.current = score1;
  score2Ref.current = score2;

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

  // Start timer for timed mode
  useEffect(() => {
    if (!tournament || !timerStarted) return;
    const formatMode = effectiveFormat?.mode;
    if (formatMode === 'timed' && effectiveFormat?.timeLimit) {
      timer.start();
    }
  }, [tournament, timerStarted]);

  // Auto-end match when time expires in timed mode
  useEffect(() => {
    if (!tournament || !sportConfig || scoringPrompt.isInteractionLocked) return undefined;
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

      autoFinishTimeoutRef.current = setTimeout(() => {
        if (scoringPrompt.isInteractionLocked) return;

        const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
          ...m,
          score1,
          score2,
          status: 'completed',
          winner: determineWinner(score1, score2, m),
          draftState: undefined,
          completedAt: new Date().toISOString(),
        }));
        const ok = saveSportTournament(sportConfig.storageKey, updatedTournament);
        if (!ok) {
          setSaveWarning('Save failed - storage may be full. Export your data.');
          return;
        }
        setSaveWarning('');
        saveTournamentToConvex(updatedTournament);
        navigate(`/${sport}/tournament/${id}`);
        autoFinishTimeoutRef.current = null;
      }, 300);

      return () => {
        if (autoFinishTimeoutRef.current) {
          clearTimeout(autoFinishTimeoutRef.current);
          autoFinishTimeoutRef.current = null;
        }
      };
    }

    return undefined;
  }, [timer.elapsed, tournament, sportConfig, score1, score2, matchId, sport, id, navigate, scoringPrompt.isInteractionLocked, showScoringWarning, overtimePeriod]);

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
    if (formatMode === 'timed' && timedMatchLimit && timer.elapsed >= currentPeriodLimit) {
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

    // Auto-end in points mode (formatMode already declared above)
    if ((formatMode || 'free') === 'points' && effectiveFormat.target) {
      if (newScore1 >= effectiveFormat.target || newScore2 >= effectiveFormat.target) {
        triggerConfetti();
        triggerHaptic([100, 100, 100, 100, 100]);

        // Save match as completed
        setTimeout(() => {
          const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
            ...m,
            score1: newScore1,
            score2: newScore2,
            status: 'completed',
            winner: determineWinner(newScore1, newScore2, m),
            draftState: undefined,
            completedAt: new Date().toISOString(),
          }));
          const ok = saveSportTournament(sportConfig.storageKey, updatedTournament);
          if (!ok) {
            setSaveWarning('Save failed - storage may be full. Export your data.');
            return;
          }
          setSaveWarning('');
          saveTournamentToConvex(updatedTournament);
          navigate(`/${sport}/tournament/${id}`);
        }, 300);
      }
    }
  };

  // Undo last action
  const undo = () => {
    if (history.length === 0 || scoringPrompt.isInteractionLocked) return;

    const last = history[history.length - 1];
    setScore1(last.score1);
    setScore2(last.score2);
    setHistory(prev => prev.slice(0, -1));
  };

  // Save draft (in-progress match)
  const saveDraft = () => {
    if (scoringPrompt.isInteractionLocked) return;

    const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
      ...m,
      status: 'in-progress',
      draftState: {
        score1,
        score2,
        history: structuredClone(history.slice(-50)),
        savedAt: new Date().toISOString(),
      },
    }));

    const ok = saveSportTournament(sportConfig.storageKey, updatedTournament);
    if (!ok) {
      setSaveWarning('Save failed - storage may be full. Export your data.');
      return;
    }
    setSaveWarning('');

    if (autoFinishTimeoutRef.current) {
      clearTimeout(autoFinishTimeoutRef.current);
      autoFinishTimeoutRef.current = null;
    }
    timer.pause();
    setHasChanges(false);
    scoringPrompt.scheduleDraftRedirect(navigateToTournament);
  };

  // Keyboard shortcuts (skip on touch-only devices)
  useEffect(() => {
    if (isTouchDevice) return;

    const handleKeyPress = (e) => {
      if (scoringPrompt.isInteractionLocked) return;
      // Ignore if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'q':
          addScore(leftTeam, 1);
          break;
        case 'p':
          addScore(rightTeam, 1);
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
  }, [score1, score2, history, sportConfig, tournament, sidesSwapped, scoringPrompt.isInteractionLocked]); // Dependencies for addScore/undo

  // Save match and return
  const saveMatch = () => {
    if (scoringPrompt.isInteractionLocked) return;

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

    const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
      ...m,
      score1,
      score2,
      status: 'completed',
      winner: determineWinner(score1, score2, m),
      draftState: undefined,
      completedAt: new Date().toISOString(),
    }));

    const ok = saveSportTournament(sportConfig.storageKey, updatedTournament);
    if (!ok) {
      setSaveWarning('Save failed - storage may be full. Export your data.');
      return;
    }
    setSaveWarning('');
    saveTournamentToConvex(updatedTournament);

    // Delay navigation slightly to show confetti
    setTimeout(() => {
      navigate(`/${sport}/tournament/${id}`);
    }, 300);
  };

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
  const quickButtons = sportConfig.config.quickButtons;

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
  const isTimeUp = isTimedMode && remainingSeconds === 0;
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
              onClick={() => { setSidesSwapped(s => !s); }}
              className="mono-btn"
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                minWidth: 0,
                touchAction: 'manipulation',
                borderColor: sidesSwapped ? 'var(--primary)' : 'var(--se-color-line)',
                color: sidesSwapped ? 'var(--primary)' : 'var(--se-color-ink)',
              }}
              title="Swap sides"
            >
              Swap
            </button>
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
            <button
              type="button"
              onClick={quickButtons ? undefined : () => addScore(leftTeam, 1)}
              disabled={quickButtons ? true : (isTimeUp || scoringPrompt.isInteractionLocked)}
              data-leading={leftScore > rightScore ? 'true' : 'false'}
              aria-label={quickButtons ? `${leftName} score: ${leftScore}` : `Add 1 point to ${leftName}`}
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
              {!quickButtons && <span className="mono-arena-hint">Tap +1</span>}
            </button>
            {quickButtons && (
              <div className="flex flex-col gap-2 w-full px-4" style={{ marginTop: 8 }}>
                {quickButtons.map((btn, idx) => (
                  <button
                    key={`left-btn-${btn.label}-${idx}`}
                    onClick={() => addScore(leftTeam, btn.value)}
                    className="mono-btn text-sm py-2"
                    style={{ touchAction: 'manipulation', opacity: isTimeUp || scoringPrompt.isInteractionLocked ? 0.4 : 1 }}
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
            <button
              type="button"
              onClick={quickButtons ? undefined : () => addScore(rightTeam, 1)}
              disabled={quickButtons ? true : (isTimeUp || scoringPrompt.isInteractionLocked)}
              data-leading={rightScore > leftScore ? 'true' : 'false'}
              aria-label={quickButtons ? `${rightName} score: ${rightScore}` : `Add 1 point to ${rightName}`}
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
              {!quickButtons && <span className="mono-arena-hint">Tap +1</span>}
            </button>
            {quickButtons && (
              <div className="flex flex-col gap-2 w-full px-4" style={{ marginTop: 8 }}>
                {quickButtons.map((btn, idx) => (
                  <button
                    key={`right-btn-${btn.label}-${idx}`}
                    onClick={() => addScore(rightTeam, btn.value)}
                    className="mono-btn text-sm py-2"
                    style={{ touchAction: 'manipulation', opacity: isTimeUp || scoringPrompt.isInteractionLocked ? 0.4 : 1 }}
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

        {/* Bottom bar */}
        <div className="mono-control-strip mono-scorer-control-strip pt-4">
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
            {hasChanges && (
              <button
                onClick={saveDraft}
                disabled={scoringPrompt.isInteractionLocked}
                className="mono-btn flex-1"
                style={{ padding: '8px', fontSize: '0.8125rem', borderColor: 'var(--primary)', color: 'var(--primary)', opacity: scoringPrompt.isInteractionLocked ? 0.45 : 1 }}
              >
                Save Draft
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

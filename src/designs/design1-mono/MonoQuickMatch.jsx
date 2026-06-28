import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { OVERS_PRESETS, CRICKET_FORMATS, buildCricketFormat, ballsToOvers, calculateRunRate, getPowerplayPhase, getCricketFormat } from '../../utils/cricketCalculations';
import BackArrow from './components/BackArrow';
import { POINTS_PRESETS, validateSingleSetScore } from '../../utils/volleyballCalculations';
import { clearData, saveData, loadData, saveQuickMatch, isStaleQuickMatchDraft } from '../../utils/storage';
import { getSportById } from '../../models/sportRegistry';
import { useTimer } from '../../hooks/useTimer';
import { getSportDefaults, applyStandardDefaults } from '../../utils/sportDefaults';
import { useAuth } from '../../hooks/useAuth';
import { useMatchSync, buildQuickMatchClientId } from '../../hooks/useMatchSync';
import { useDebounce } from '../../hooks/useDebounce';
import { useLiveBroadcast } from '../../hooks/useLiveBroadcast';
import { getConsent } from '../../lib/live/liveSession';
import LiveBroadcastBar from './live/LiveBroadcastBar';
import PlayerSearchInput from './components/PlayerSearchInput';
import { cloneSetsSnapshot } from '../../utils/cloneSetsSnapshot';
import { applySetPoint, getBestOfResultScore, getSetWinRule, isSetComplete } from '../../utils/quickMatchSets';
import { buildResultShareText, getResultSetSummary, getShareStatusText } from '../../utils/quickMatchResult';
import { getSportStartLabel } from '../../utils/startActions';
import { shareText } from '../../mobile/share';
import { CRICKET_RUN_VALUES } from '../../utils/cricketRunControls';
import { buildTennisQuickDraft, getTennisQuickDraftKey } from '../../utils/tennisQuickMatch';
import {
  correctionImpact,
  endMatchImpact,
  scoreImpact,
  warningImpact,
} from '../../mobile/haptics';

// Generic confirm dialog. Defaults reproduce the original "End match?" copy/ids
// byte-for-byte, so existing end-match usage is unchanged; a distinct idPrefix
// lets a second instance (e.g. Discard) mount without duplicate DOM ids.
function ConfirmDialog({
  onCancel,
  onConfirm,
  idPrefix = 'end-match',
  eyebrow = 'Match control',
  title = 'End match?',
  message = 'This will finish the current match and save the result.',
  cancelLabel = 'Keep scoring',
  confirmLabel = 'End match',
}) {
  const cancelButtonRef = useRef(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelRef.current();
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleBackdropPointerDown = (event) => {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  };

  return (
    <div
      className="app-confirm-backdrop"
      role="presentation"
      onMouseDown={handleBackdropPointerDown}
      onTouchStart={handleBackdropPointerDown}
    >
      <section
        className="app-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${idPrefix}-title`}
        aria-describedby={`${idPrefix}-message`}
      >
        <p className="app-confirm-eyebrow">{eyebrow}</p>
        <h2 id={`${idPrefix}-title`} className="app-confirm-title">{title}</h2>
        <p id={`${idPrefix}-message`} className="app-confirm-message">
          {message}
        </p>
        <div className="app-confirm-actions">
          <button
            type="button"
            ref={cancelButtonRef}
            onClick={onCancel}
            className="app-confirm-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="app-confirm-primary"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function ScoringStatusStrip({ label, value, lastAction }) {
  // Always render the polite live region (even when empty) so the FIRST action is
  // announced — a live region must already be in the DOM before its content
  // changes. Collapse the visible chrome when there's nothing to show.
  const hasContent = Boolean(label || lastAction);

  return (
    <div
      className={hasContent ? 'mono-score-mini mb-4 flex items-center justify-between gap-3' : undefined}
      style={hasContent ? { padding: '10px 12px' } : undefined}
      aria-live="polite"
    >
      {label ? (
        <div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--se-color-ink-muted)' }}>{label}</p>
          <p className="text-sm font-medium" style={{ color: 'var(--se-color-ink)' }}>{value}</p>
        </div>
      ) : <span />}
      {lastAction && (
        <p className="text-xs text-right" style={{ color: 'var(--se-color-ink-muted)' }}>
          Last: {lastAction}
        </p>
      )}
    </div>
  );
}

// Correction = the one action the score pad can't do (the pad already adds +1).
function CorrectionControls({ teamName, onMinus }) {
  return (
    <div className="mt-2 flex justify-center">
      <button
        type="button"
        onClick={onMinus}
        className="mono-correct"
        aria-label={`Subtract one from ${teamName}`}
      >
        &minus;1
      </button>
    </div>
  );
}

CorrectionControls.propTypes = {
  teamName: PropTypes.string.isRequired,
  onMinus: PropTypes.func.isRequired,
};

function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-2" />
    </svg>
  );
}

// One shared bottom bar for every scorer: [Undo · Swap · Discard · Finish].
// Saving is automatic; Finish ends the match (with confirm), Discard drops it.
function ThumbActionBar({ canUndo, onUndo, onSwap, onDiscard, onEnd }) {
  return (
    <div className="mono-scorer-control-strip mono-quick-action-strip">
      <div className="mono-quick-action-row">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="mono-btn mono-quick-undo"
          aria-label="Undo last action"
          title="Undo last action"
          style={{ color: canUndo ? 'var(--se-color-ink)' : 'var(--se-color-ink-faint)' }}
        >
          <UndoIcon />
        </button>
        {onSwap ? (
          <button type="button" onClick={onSwap} className="mono-btn">
            Swap
          </button>
        ) : null}
        {onDiscard ? (
          <button type="button" onClick={onDiscard} className="mono-btn">
            Discard
          </button>
        ) : null}
        {onEnd ? (
          <button type="button" onClick={onEnd} className="mono-btn" style={{ color: 'var(--primary)' }}>
            Finish
          </button>
        ) : null}
      </div>
    </div>
  );
}

function EndMatchButton({ onEnd }) {
  return (
    <button type="button" onClick={onEnd} className="mono-scorer-end-chip" aria-label="End Match">
      End
    </button>
  );
}

ThumbActionBar.propTypes = {
  canUndo: PropTypes.bool,
  onUndo: PropTypes.func.isRequired,
  onSwap: PropTypes.func,
  onDiscard: PropTypes.func,
  onEnd: PropTypes.func,
};

EndMatchButton.propTypes = {
  onEnd: PropTypes.func.isRequired,
};

// Scoring-phase notice. The "resumed" info reads as a quiet ambient line; real
// save errors and end-match validation keep a proper alert box. Tone is derived
// from the message so the save/end logic sites stay untouched.
function ScoringNotice({ message }) {
  if (!message) return null;
  const tone = message.startsWith('Resumed')
    ? 'info'
    : message.includes('cannot end tied')
      ? 'warning'
      : 'danger';
  if (tone === 'info') {
    return (
      <p className="mono-scorer-note" role="status">{message}</p>
    );
  }
  return (
    <div className={`mono-alert mb-4 ${tone === 'warning' ? 'mono-alert-warning' : 'mono-alert-danger'}`} role="alert">
      {message}
    </div>
  );
}

ScoringNotice.propTypes = {
  message: PropTypes.string,
};

// CrickHeroes-style "this over" strip, derived from the existing per-delivery log (no new storage).
function cricketOverPips(history, innings, battingTeam) {
  const inn = history.filter((h) => h.innings === innings && h.battingTeam === battingTeam);
  const extraLabel = { wide: 'Wd', noBall: 'Nb', bye: 'B', legBye: 'Lb' };
  let cur = [];
  let last = [];
  let legal = 0;
  for (const d of inn) {
    let pip;
    if (d.type === 'wicket') pip = { label: 'W', kind: 'wicket' };
    else if (d.type === 'extra') pip = { label: extraLabel[d.extraType] || 'Ex', kind: 'extra' };
    else pip = { label: String(d.value), kind: d.value === 4 ? 'four' : d.value === 6 ? 'six' : 'run' };
    cur.push(pip);
    const isLegal = d.type === 'runs' || d.type === 'wicket' || (d.type === 'extra' && (d.extraType === 'bye' || d.extraType === 'legBye'));
    if (isLegal) {
      legal += 1;
      if (legal === 6) { last = cur; cur = []; legal = 0; }
    }
  }
  return cur.length ? cur : last;
}

function getWinnerName(score1, score2, team1Name, team2Name, tiedName = 'Tie') {
  if (score1 > score2) return team1Name;
  if (score2 > score1) return team2Name;
  return tiedName;
}

function getRestoredTimerElapsed(draft) {
  const savedElapsed = Math.max(0, Number(draft?.timerElapsed) || 0);
  const savedAt = Date.parse(draft?.updatedAt || '');
  if (!Number.isFinite(savedAt)) return savedElapsed;

  return savedElapsed + Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
}

function formatMinutes(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'No time limit';
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

function getRuleSummary({ engine, format, formatMode, isCricket, isGoals, sportConfig, selectedCricketFormat }) {
  if (isCricket) {
    const formatName = selectedCricketFormat?.name || 'Cricket';
    const limit = format.trackOvers === false
      ? `${format.maxBalls || 'unlimited'} balls`
      : `${format.overs || 'unlimited'} overs`;
    const innings = (format.totalInnings || 2) === 4 ? '2 innings per side' : '1 innings per side';
    return `${formatName} - ${limit} - ${format.players || 6} players - ${innings}`;
  }

  if (engine === 'sets') {
    const winBy = format.customization?.winBy || sportConfig?.config?.winBy || 2;
    if (format.type === 'best-of') {
      return `Best of ${format.sets || 3} - ${format.points || sportConfig?.config?.pointsPerSet || 25} pts - win by ${winBy}`;
    }
    return `Single set - first to ${format.target || format.points || sportConfig?.config?.pointsPerSet || 25} - win by ${winBy}`;
  }

  if (isGoals) {
    if (format.mode === 'timed') return `Timed match - ${formatMinutes(format.timeLimit)}`;
    if (format.mode === 'points') {
      return `First to ${format.target || sportConfig?.config?.winPoints || 5} ${sportConfig?.config?.scoringUnit || 'point'}s`;
    }
    return 'Free play - tap to score';
  }

  return formatMode === 'standard' ? 'Standard rules' : 'Custom rules';
}

export default function MonoQuickMatch() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sport } = useParams();
  const [searchParams] = useSearchParams();
  const preselectedFormat = searchParams.get('format');
  const sportConfig = getSportById(sport);
  const engine = sportConfig?.engine || 'goals';
  const isCricket = engine === 'custom-cricket';
  const isTennis = sport === 'tennis';
  const isGoals = engine === 'goals';

  const timer = useTimer();
  const startedAtRef = useRef(null);

  const [phase, setPhase] = useState('setup'); // setup | scoring | result
  const visible = true; // always visible; no fade-in needed for quick match
  const [setupStep, setSetupStep] = useState(() => {
    if (!isCricket || !preselectedFormat) return 2;
    const preset = CRICKET_FORMATS.find(f => f.id === preselectedFormat);
    return preset?.customizable ? 3 : 2;
  }); // 1: Format, 2: Rules (when editing), 3: Teams
  const [sidesSwapped, setSidesSwapped] = useState(false); // flip left/right teams for referee scoring
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showInningsBreak, setShowInningsBreak] = useState(false);
  const endMatchTriggerRef = useRef(null);
  const [servingTeam, setServingTeam] = useState(1);
  const [lastAction, setLastAction] = useState('');

  // Debounce ref for rapid clicks
  const lastClickRef = useRef(0);

  // Setup state
  const initialPreset = isCricket && preselectedFormat
    ? (CRICKET_FORMATS.find(f => f.id === preselectedFormat)?.id || 'T20')
    : 'T20';
  const initialFormatMode = isCricket && preselectedFormat
    ? (CRICKET_FORMATS.find(f => f.id === preselectedFormat)?.customizable ? 'custom' : 'standard')
    : 'standard';
  const [formatMode, setFormatMode] = useState(initialFormatMode);
  const [cricketPreset, setCricketPreset] = useState(initialPreset);
  const wizardTeams = Array.isArray(location.state?.teams) ? location.state.teams : null;
  const [team1Name, setTeam1Name] = useState(wizardTeams?.[0] || 'Team A');
  const [team2Name, setTeam2Name] = useState(wizardTeams?.[1] || 'Team B');
  const [saveWarning, setSaveWarning] = useState('');

  // The "resumed your match" info is a transient toast — auto-dismiss it shortly
  // after it appears. Real save errors / end-match validation messages are NOT
  // dismissed here; they persist until the user resolves them.
  useEffect(() => {
    if (saveWarning && saveWarning.startsWith('Resumed')) {
      const dismissTimer = setTimeout(() => setSaveWarning(''), 3300);
      return () => clearTimeout(dismissTimer);
    }
    return undefined;
  }, [saveWarning]);

  // Auth + Convex integration for match saving
  const { isAuthenticated, user, cloudAuthAvailable } = useAuth();

  // Referee toggle (only for referee/both roles)
  const showRefereeOption = isAuthenticated && (user?.role === 'referee' || user?.role === 'both');
  const [isRefereeing, setIsRefereeing] = useState(user?.role === 'referee');

  // Team search (autocomplete suggestions for authenticated users)
  const debouncedTeam1 = useDebounce(team1Name, 300);
  const debouncedTeam2 = useDebounce(team2Name, 300);
  const [showTeam1Suggestions, setShowTeam1Suggestions] = useState(false);
  const [showTeam2Suggestions, setShowTeam2Suggestions] = useState(false);
  const team1Ref = useRef(null);
  const team2Ref = useRef(null);

  const team1Results = useQuery(
    api.teams.search,
    isAuthenticated && showTeam1Suggestions && debouncedTeam1.length >= 2
      ? { sport, prefix: debouncedTeam1 }
      : 'skip'
  );
  const team2Results = useQuery(
    api.teams.search,
    isAuthenticated && showTeam2Suggestions && debouncedTeam2.length >= 2
      ? { sport, prefix: debouncedTeam2 }
      : 'skip'
  );

  // Sort team results by matchCount descending
  const sortedTeam1 = (team1Results || []).slice().sort((a, b) => b.matchCount - a.matchCount);
  const sortedTeam2 = (team2Results || []).slice().sort((a, b) => b.matchCount - a.matchCount);

  // Convex useQuery returns undefined while in-flight and [] when it finishes with
  // no matches; both collapsed to "render nothing" before. Split them so the
  // dropdown can show a "Searching…" affordance and an explicit empty state.
  const team1Querying = isAuthenticated && showTeam1Suggestions && debouncedTeam1.length >= 2;
  const team1Loading = team1Querying && team1Results === undefined;
  const team1Empty = team1Querying && team1Results !== undefined && sortedTeam1.length === 0;
  const team2Querying = isAuthenticated && showTeam2Suggestions && debouncedTeam2.length >= 2;
  const team2Loading = team2Querying && team2Results === undefined;
  const team2Empty = team2Querying && team2Results !== undefined && sortedTeam2.length === 0;

  // Close team suggestion dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (team1Ref.current && !team1Ref.current.contains(e.target)) setShowTeam1Suggestions(false);
      if (team2Ref.current && !team2Ref.current.contains(e.target)) setShowTeam2Suggestions(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Team player rosters (optional tagging)
  const [team1Players, setTeam1Players] = useState([]);
  const [team2Players, setTeam2Players] = useState([]);
  const [showTeam1Roster, setShowTeam1Roster] = useState(false);
  const [showTeam2Roster, setShowTeam2Roster] = useState(false);
  const { syncState, syncError, syncMatch, retrySync, resetSync } = useMatchSync({
    sport,
    isAuthenticated,
    user,
    team1Players,
    team2Players,
    isRefereeing,
  });
  const [format, setFormat] = useState(() => {
    if (isCricket) return buildCricketFormat(initialPreset);
    if (initialFormatMode === 'standard') return applyStandardDefaults(sport, {});
    if (isGoals) return { mode: 'free' };
    return { type: 'single', target: 15, points: 25 };
  });
  const [showCustomOvers, setShowCustomOvers] = useState(false);
  const [customOvers, setCustomOvers] = useState('');

  // Cricket scoring state
  const [battingTeam, setBattingTeam] = useState(1);
  const [innings, setInnings] = useState(1);
  const [scores, setScores] = useState({
    team1: { runs: 0, balls: 0, wickets: 0, allOut: false },
    team2: { runs: 0, balls: 0, wickets: 0, allOut: false },
  });

  // Sets (volleyball etc.) scoring state
  const [vScore1, setVScore1] = useState(0);
  const [vScore2, setVScore2] = useState(0);

  // Best-of sets tracking
  const [sets, setSets] = useState([{ score1: 0, score2: 0, completed: false }]);
  const [currentSet, setCurrentSet] = useState(0);

  // Sets undo history
  const [vScoreHistory, setVScoreHistory] = useState([]);

  // Goals scoring state
  const [gScore1, setGScore1] = useState(0);
  const [gScore2, setGScore2] = useState(0);
  const [gScoreHistory, setGScoreHistory] = useState([]);

  // Cricket undo history
  const [cricketHistory, setCricketHistory] = useState([]);

  // Cricket: Free hit and trial ball state
  const [freeHit, setFreeHit] = useState(false);
  const [trialBallUsed, setTrialBallUsed] = useState(false);
  const draftHydratedSportRef = useRef(null);
  const restoredDraftRef = useRef(false);
  const scoringSportRef = useRef(null);
  const quickMatchDraftKey = `se_quickmatch_draft_${sport}`;

  // Live broadcast (dkt/b0z): mirror each point/undo to the public watch page with
  // the engine-derived snapshot. Additive — localStorage stays authoritative; a
  // failed/offline broadcast never breaks local scoring. Consent is global.
  const [liveEnabled, setLiveEnabled] = useState(() => getConsent() === 'accepted');
  const live = useLiveBroadcast({ enabled: liveEnabled });
  const liveRef = useRef(live);
  liveRef.current = live;
  // Records the latest scoring action; its broadcast snapshot is computed from the
  // COMMITTED state in the post-commit effect below (a point can end a set / chase).
  const broadcastIntentRef = useRef(null);
  // Stable per-match id (R2): QuickMatch has no matchId during scoring, so we mint a
  // numeric id when scoring STARTS and persist/restore it in the draft. Null until
  // then so the bar doesn't fire goLive on the setup screen.
  const liveMatchIdRef = useRef(null);

  // Result state
  const [result, setResult] = useState(null);
  const [shareStatus, setShareStatus] = useState('');

  useEffect(() => {
    if (user?.role === 'referee') {
      setIsRefereeing(true);
    } else if (user?.role && user.role !== 'both') {
      setIsRefereeing(false);
    }
  }, [user?.role]);

  // Start timer when scoring begins
  useEffect(() => {
    if (phase === 'scoring') {
      if (!startedAtRef.current) startedAtRef.current = new Date().toISOString();
      timer.start();
    } else if (phase === 'result') {
      timer.pause();
    }
  }, [phase]);

  useEffect(() => {
    if (draftHydratedSportRef.current === sport) return;
    const previousSport = draftHydratedSportRef.current;
    draftHydratedSportRef.current = sport;
    restoredDraftRef.current = false;
    scoringSportRef.current = null;

    const draft = loadData(quickMatchDraftKey, null);
    if (isStaleQuickMatchDraft(draft)) {
      clearData(quickMatchDraftKey);
    }

    if (!draft || isStaleQuickMatchDraft(draft) || draft.sport !== sport || draft.phase !== 'scoring') {
      if (previousSport && phase === 'scoring') {
        setPhase('setup');
        timer.pause();
        setSaveWarning('');
      }
      return;
    }

    restoredDraftRef.current = true;
    scoringSportRef.current = sport;
    setTeam1Name(draft.team1Name || '');
    setTeam2Name(draft.team2Name || '');
    if (draft.format) setFormat(draft.format);
    if (draft.scores) setScores(draft.scores);
    if (Array.isArray(draft.sets)) setSets(draft.sets);
    if (typeof draft.currentSet === 'number') setCurrentSet(draft.currentSet);
    if (typeof draft.vScore1 === 'number') setVScore1(draft.vScore1);
    if (typeof draft.vScore2 === 'number') setVScore2(draft.vScore2);
    if (typeof draft.gScore1 === 'number') setGScore1(draft.gScore1);
    if (typeof draft.gScore2 === 'number') setGScore2(draft.gScore2);
    if (Array.isArray(draft.vScoreHistory)) setVScoreHistory(draft.vScoreHistory);
    if (Array.isArray(draft.gScoreHistory)) setGScoreHistory(draft.gScoreHistory);
    if (Array.isArray(draft.cricketHistory)) setCricketHistory(draft.cricketHistory);
    if (typeof draft.innings === 'number') setInnings(draft.innings);
    if (typeof draft.battingTeam === 'number') setBattingTeam(draft.battingTeam);
    if (typeof draft.freeHit === 'boolean') setFreeHit(draft.freeHit);
    if (typeof draft.trialBallUsed === 'boolean') setTrialBallUsed(draft.trialBallUsed);
    if (typeof draft.servingTeam === 'number') setServingTeam(draft.servingTeam);
    if (typeof draft.lastAction === 'string') setLastAction(draft.lastAction);
    // Restore the stable live id (R2) so a reload re-attaches to the SAME live match
    // (create is idempotent on owner+clientMatchId). Fall back for pre-feature drafts.
    liveMatchIdRef.current = draft.quickMatchId || Date.now();
    timer.restore(getRestoredTimerElapsed(draft), false);
    startedAtRef.current = draft.startedAt || new Date().toISOString();
    setSaveWarning('Resumed your in-progress quick match on this device.');
    setPhase('scoring');
  }, [quickMatchDraftKey, sport]);

  useEffect(() => {
    if (phase !== 'scoring') return;
    if (scoringSportRef.current !== sport) return;

    saveData(quickMatchDraftKey, {
      phase,
      sport,
      team1Name,
      team2Name,
      format,
      scores,
      sets,
      currentSet,
      vScore1,
      vScore2,
      gScore1,
      gScore2,
      vScoreHistory,
      gScoreHistory,
      cricketHistory,
      innings,
      battingTeam,
      freeHit,
      trialBallUsed,
      servingTeam,
      lastAction,
      quickMatchId: liveMatchIdRef.current,
      timerElapsed: timer.elapsed,
      startedAt: startedAtRef.current,
      updatedAt: new Date().toISOString(),
    });
    // `timer.elapsed` is intentionally omitted: it ticks every second, which would
    // re-serialize and re-save the entire draft each tick. We persist `startedAt`
    // and reconstruct elapsed from wall-clock on restore, so the per-tick write is
    // pure churn. The body still snapshots the latest timer value on real changes.
  }, [battingTeam, cricketHistory, currentSet, format, freeHit, gScore1, gScore2, gScoreHistory, innings, lastAction, phase, quickMatchDraftKey, scores, servingTeam, sets, sport, team1Name, team2Name, trialBallUsed, vScore1, vScore2, vScoreHistory]);

  // Whether this sport rotates serve to the point winner (drives the snapshot's
  // servingTeam). Declared HERE, before the broadcast effect that reads it, so the
  // effect's dependency array doesn't hit a temporal-dead-zone ReferenceError.
  const tracksPointWinnerServe = sport === 'volleyball' || sport === 'badminton';

  // Live broadcast: build the latest point/undo snapshot from the COMMITTED state
  // (a single tap can end a set / chase / open the next unit, which React applies
  // asynchronously). No-op until the bar has run goLive — point/undo return null
  // until then. The dependency array lists EVERY score-state variable read below.
  useEffect(() => {
    const intent = broadcastIntentRef.current;
    if (!intent) return;
    broadcastIntentRef.current = null;

    let snapshot;
    if (isCricket) {
      const battingName = battingTeam === 1 ? team1Name : team2Name;
      const battingScore = battingTeam === 1 ? scores.team1 : scores.team2;
      snapshot = {
        pointsA: scores.team1.runs,
        pointsB: scores.team2.runs,
        setsA: 0,
        setsB: 0,
        setScores: [],
        servingTeam: undefined,
        currentUnit: innings,
        periodLabel: `${battingName} ${battingScore.runs}/${battingScore.wickets} (${ballsToOvers(battingScore.balls)})`,
      };
    } else if (isGoals) {
      snapshot = {
        pointsA: gScore1,
        pointsB: gScore2,
        setsA: 0,
        setsB: 0,
        setScores: [],
        currentUnit: 1,
      };
    } else if (format.type === 'best-of') {
      const completed = sets.filter((s) => s.completed);
      snapshot = {
        pointsA: sets[currentSet]?.score1 || 0,
        pointsB: sets[currentSet]?.score2 || 0,
        setsA: completed.filter((s) => s.score1 > s.score2).length,
        setsB: completed.filter((s) => s.score2 > s.score1).length,
        setScores: completed.map((s) => ({ a: s.score1, b: s.score2 })),
        servingTeam: tracksPointWinnerServe ? (servingTeam === 1 ? 'A' : 'B') : undefined,
        currentUnit: currentSet + 1,
        periodLabel: `Set ${currentSet + 1}`,
      };
    } else {
      snapshot = {
        pointsA: vScore1,
        pointsB: vScore2,
        setsA: 0,
        setsB: 0,
        setScores: [],
        servingTeam: tracksPointWinnerServe ? (servingTeam === 1 ? 'A' : 'B') : undefined,
        currentUnit: 1,
      };
    }

    if (intent.kind === 'undo') {
      liveRef.current.undo({ at: intent.at, snapshot });
    } else {
      liveRef.current.point({ team: intent.team, value: intent.value ?? 1, at: intent.at, snapshot });
    }
  }, [scores, gScore1, gScore2, vScore1, vScore2, sets, currentSet, servingTeam, innings, battingTeam, isCricket, isGoals, format.type, tracksPointWinnerServe, team1Name, team2Name]);

  // Finalize ordering (R1): finalizeMatch runs SYNCHRONOUSLY inside the scoring
  // handlers at auto-completion, so the winning point's broadcast effect runs AFTER
  // it. A separate effect declared IMMEDIATELY AFTER the snapshot effect runs in
  // source order — so the last point enqueues BEFORE finalize drains+archives.
  useEffect(() => {
    if (phase === 'result') void liveRef.current.finalize();
  }, [phase]);

  // Apply cricket defaults when the quick-match sport route changes.
  useEffect(() => {
    if (restoredDraftRef.current) return;
    if (!isCricket || !sport) return;

    const preset = CRICKET_FORMATS.find(f => f.id === preselectedFormat);
    const nextPreset = preset?.id || 'T20';
    setCricketPreset(nextPreset);
    setFormatMode(preset?.customizable ? 'custom' : 'standard');
    setFormat(buildCricketFormat(nextPreset));
    setSetupStep(preset?.customizable ? 3 : 2);
  }, [isCricket, preselectedFormat, sport]);

  // Reset defaults when leaving cricket on the same mounted quick-match route.
  useEffect(() => {
    if (restoredDraftRef.current) return;
    if (isCricket || !sport) return;

    setFormatMode('standard');
    setSetupStep(2);
    const defaults = getSportDefaults(sport);
    if (defaults && Object.keys(defaults).length > 0) {
      setFormat(applyStandardDefaults(sport, {}));
    }
  }, [isCricket, sport]);

  // Apply standard defaults when format mode is 'standard'
  useEffect(() => {
    if (restoredDraftRef.current) return;
    if (isCricket || formatMode !== 'standard' || !sport) return;

    const defaults = getSportDefaults(sport);
    if (defaults && Object.keys(defaults).length > 0) {
      setFormat(applyStandardDefaults(sport, {}));
    }
  }, [formatMode, isCricket, sport]);

  // Goals mode helpers
  const isTimedMode = isGoals && format.mode === 'timed';
  const isPointsMode = isGoals && format.mode === 'points';
  const timeLimit = isTimedMode ? format.timeLimit : null;
  const remainingSeconds = isTimedMode ? Math.max(0, timeLimit - timer.elapsed) : null;
  const isTimeUp = isTimedMode && remainingSeconds === 0;
  const scoringUnit = sportConfig?.config?.scoringUnit || 'point';
  // A no-draw sport tied at full time still needs ONE deciding score, so the
  // time-up lock must permit exactly that — otherwise 0-0 with no undo history is a
  // dead end (can't score, can't undo, can't end on a tie). Once the tie breaks,
  // needsDecidingScore goes false and the lock re-engages.
  const goalsDrawAllowed = sportConfig?.config?.drawAllowed ?? true;
  const needsDecidingScore = isTimeUp && !goalsDrawAllowed && gScore1 === gScore2;
  const scoringLocked = isTimeUp && !needsDecidingScore;

  // Timed mode: pause when the clock first reaches zero. Open the end prompt ONCE,
  // but only when the match is actually endable — not while a no-draw tie still
  // needs a deciding score (so the prompt appears after that decider breaks the
  // tie). The one-shot ref resets whenever the clock isn't up (e.g. a new match).
  const timeUpPromptedRef = useRef(false);
  useEffect(() => {
    if (!isTimeUp) {
      timeUpPromptedRef.current = false;
      return;
    }
    timer.pause();
    if (!needsDecidingScore && !timeUpPromptedRef.current) {
      timeUpPromptedRef.current = true;
      setShowEndConfirm(true);
    }
  }, [isTimeUp, needsDecidingScore]);

  // Live broadcast descriptor (shared across all three sport branches). clientMatchId
  // stays null until scoring starts (so the bar doesn't fire goLive on setup).
  const liveScorecardKind = isCricket ? 'cricket' : isGoals ? 'goals' : 'volleyball';
  const liveDescriptor = {
    clientMatchId: liveMatchIdRef.current ? buildQuickMatchClientId(sport, liveMatchIdRef.current) : null,
    sport,
    scorecardKind: liveScorecardKind,
    teamA: { name: team1Name },
    teamB: { name: team2Name },
  };

  const formatCountdown = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  const createSyncMeta = (status, error = '') => ({
    status,
    error,
    updatedAt: new Date().toISOString(),
  });

  const normalizeWinnerToken = (winner) => {
    if (typeof winner !== 'string') return winner;
    const lower = winner.trim().toLowerCase();
    if (lower === 'draw') return 'Draw';
    if (lower === 'tie') return 'Tie';
    return winner;
  };

  const summarizeInningsScore = (entry) => {
    if (!Array.isArray(entry.innings) || entry.innings.length === 0) return null;
    const t1Id = entry.team1Id || 'team1';
    const t2Id = entry.team2Id || 'team2';
    const score1 = entry.innings
      .filter((inn) => inn.teamId === t1Id)
      .reduce((sum, inn) => sum + (inn.runs || 0), 0);
    const score2 = entry.innings
      .filter((inn) => inn.teamId === t2Id)
      .reduce((sum, inn) => sum + (inn.runs || 0), 0);
    return { score1, score2 };
  };

  const persistQuickMatch = (entry) => {
    const nowIso = new Date().toISOString();
    const inningsSummary = summarizeInningsScore(entry);
    const canonicalTeam1 = entry.team1 || entry.team1Name || team1Name.trim();
    const canonicalTeam2 = entry.team2 || entry.team2Name || team2Name.trim();
    const score1 = typeof entry.score1 === 'number'
      ? entry.score1
      : (inningsSummary?.score1 ?? entry.team1Score?.runs ?? 0);
    const score2 = typeof entry.score2 === 'number'
      ? entry.score2
      : (inningsSummary?.score2 ?? entry.team2Score?.runs ?? 0);
    const canonicalDate = entry.date || entry.completedAt || entry.createdAt || nowIso;
    const normalized = {
      ...entry,
      team1: canonicalTeam1,
      team2: canonicalTeam2,
      team1Name: entry.team1Name || canonicalTeam1,
      team2Name: entry.team2Name || canonicalTeam2,
      score1,
      score2,
      date: canonicalDate,
      winner: normalizeWinnerToken(entry.winner),
    };
    if ((normalized.status === 'completed' || normalized.winner) && !normalized.completedAt) {
      normalized.completedAt = canonicalDate;
    }
    const ok = saveQuickMatch(normalized);
    if (!ok) {
      setSaveWarning('Save failed - storage may be full. Export your data.');
      return false;
    }
    setSaveWarning('');
    return true;
  };

  const applySyncStateToResult = (entry, status, error = '', clientMatchId = entry.clientMatchId) => {
    const nextResult = {
      ...entry,
      clientMatchId,
      sync: createSyncMeta(status, error),
    };
    setResult(nextResult);
    persistQuickMatch(nextResult);
  };

  const syncCompletedMatch = (entry) => {
    if (!isAuthenticated || !user) {
      resetSync();
      return;
    }

    void syncMatch(entry).then((response) => {
      if (!response) return;
      if (response.status === 'synced') {
        applySyncStateToResult(entry, 'synced', '', response.clientMatchId);
        return;
      }
      if (response.status === 'failed') {
        applySyncStateToResult(entry, 'failed', response.error, response.clientMatchId);
      }
    });
  };

  const finalizeMatch = (entry) => {
    void endMatchImpact();

    const clientMatchId = entry.clientMatchId || buildQuickMatchClientId(sport, entry.id);
    const nextResult = {
      ...entry,
      clientMatchId,
      sync: createSyncMeta(isAuthenticated && user ? 'syncing' : 'idle'),
    };

    setShowEndConfirm(false);
    setResult(nextResult);
    const saved = persistQuickMatch(nextResult);
    if (saved) clearData(quickMatchDraftKey);
    setPhase('result');
    syncCompletedMatch(nextResult);
  };

  const getTeamLabel = (team) => (team === 1 ? team1Name : team2Name);

  const restoreEndMatchTriggerFocus = () => {
    const trigger = endMatchTriggerRef.current;
    endMatchTriggerRef.current = null;
    if (!trigger || typeof trigger.focus !== 'function') return;

    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => trigger.focus());
    } else {
      trigger.focus();
    }
  };

  const requestEndMatch = (event) => {
    endMatchTriggerRef.current = event?.currentTarget || null;
    setShowEndConfirm(true);
  };

  const cancelEndMatch = () => {
    setShowEndConfirm(false);
    restoreEndMatchTriggerFocus();
  };

  const confirmEndMatch = () => {
    setShowEndConfirm(false);
    endMatchTriggerRef.current = null;
    endMatchManually();
  };

  // Discard the in-progress quick match. Gated behind a confirm dialog so a single
  // tap can't silently wipe an in-progress match (the actual wipe is in confirm*).
  const requestDiscardQuickMatch = () => {
    setShowDiscardConfirm(true);
  };
  const cancelDiscardQuickMatch = () => {
    setShowDiscardConfirm(false);
  };
  const confirmDiscardQuickMatch = () => {
    setShowDiscardConfirm(false);
    clearData(quickMatchDraftKey);
    navigate('/app');
  };

  const handleSideSwap = () => {
    void correctionImpact();
    setSidesSwapped(prev => !prev);
    setLastAction('Sides swapped');
  };

  const retryResultSync = () => {
    if (!result) return;

    const nextResult = {
      ...result,
      clientMatchId: result.clientMatchId || buildQuickMatchClientId(sport, result.id),
    };

    applySyncStateToResult(nextResult, 'syncing', '', nextResult.clientMatchId);

    const request = syncState === 'failed' ? retrySync() : syncMatch(nextResult);
    void request.then((response) => {
      if (!response) return;
      if (response.status === 'synced') {
        applySyncStateToResult(nextResult, 'synced', '', response.clientMatchId);
        return;
      }
      if (response.status === 'failed') {
        applySyncStateToResult(nextResult, 'failed', response.error, response.clientMatchId);
      }
    });
  };

  const totalBalls = isCricket
    ? (format.trackOvers !== false
      ? (format.overs ? format.overs * 6 : Infinity)
      : (format.maxBalls || Infinity))
    : Infinity;
  const maxWickets = isCricket
    ? (format.lastManStands ? (format.players || 6) : (format.players || 6) - 1)
    : 10;

  const startMatch = () => {
    if (!team1Name.trim() || !team2Name.trim()) return;
    setSaveWarning('');
    setShareStatus('');
    setResult(null);
    resetSync();
    clearData(quickMatchDraftKey);
    setVScore1(0);
    setVScore2(0);
    setGScore1(0);
    setGScore2(0);
    setSets([{ score1: 0, score2: 0, completed: false }]);
    setCurrentSet(0);
    setVScoreHistory([]);
    setGScoreHistory([]);
    setCricketHistory([]);
    setScores({ team1: { runs: 0, balls: 0, wickets: 0, allOut: false }, team2: { runs: 0, balls: 0, wickets: 0, allOut: false } });
    setInnings(1);
    setBattingTeam(1);
    setServingTeam(1);
    setLastAction('');
    setSidesSwapped(false);
    setShowEndConfirm(false);
    setShowDiscardConfirm(false);
    setShowInningsBreak(false);
    timer.reset();
    startedAtRef.current = null;
    scoringSportRef.current = sport;

    // Test format (4 innings) → save to quick match storage and navigate to test scorer
    if (isCricket && format.totalInnings === 4) {
      const matchId = Date.now();
      const nowIso = new Date().toISOString();
      const match = {
        id: matchId, sport,
        team1Id: 'team1', team2Id: 'team2',
        team1: team1Name.trim(), team2: team2Name.trim(),
        team1Name: team1Name.trim(), team2Name: team2Name.trim(),
        format,
        status: 'in-progress',
        innings: [],
        score1: 0,
        score2: 0,
        date: nowIso,
        createdAt: nowIso,
      };
      if (!persistQuickMatch(match)) return;
      navigate(`/${sport}/quick/test-match/${matchId}`);
      return;
    }

    if (isTennis) {
      const matchId = Date.now();
      const nowIso = new Date().toISOString();
      const draft = buildTennisQuickDraft({
        matchId,
        sport,
        team1Name: team1Name.trim(),
        team2Name: team2Name.trim(),
        format,
        sets: null,
        nowIso,
      });
      if (!saveData(getTennisQuickDraftKey(matchId), draft)) {
        setSaveWarning('Save failed - storage may be full. Export your data.');
        return;
      }
      navigate(`/${sport}/quick/live/${matchId}`);
      return;
    }

    // Mint the stable live-broadcast match id (R2) right before scoring begins —
    // tennis/test-cricket branches above navigate away and never reach this line.
    liveMatchIdRef.current = Date.now();
    setPhase('scoring');
  };

  // Cricket: Add runs
  const addRuns = (runs) => {
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;
    void scoreImpact();

    if (freeHit) setFreeHit(false);

    const key = battingTeam === 1 ? 'team1' : 'team2';
    const battingName = battingTeam === 1 ? team1Name : team2Name;
    setLastAction(`${battingName} +${runs} run${runs === 1 ? '' : 's'}`);
    broadcastIntentRef.current = { kind: 'point', team: battingTeam === 1 ? 'A' : 'B', value: runs, at: Date.now() };
    setCricketHistory(prev => [...prev, { type: 'runs', key, value: runs, freeHit, innings, battingTeam }]);

    // Pure updater: compute the new score only. Innings flip / match finish are
    // handled by a single post-commit effect, so they read committed state and
    // can't double-fire when React re-invokes the updater (StrictMode/batching).
    setScores(prev => {
      const team = { ...prev[key] };
      team.runs += runs;
      team.balls += 1;
      return { ...prev, [key]: team };
    });
  };

  const addWicket = () => {
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;
    void scoreImpact();

    if (freeHit) setFreeHit(false);

    const key = battingTeam === 1 ? 'team1' : 'team2';
    const battingName = battingTeam === 1 ? team1Name : team2Name;
    setLastAction(`${battingName} wicket`);
    // A wicket adds no runs; broadcast it as a value-0 point so the public snapshot
    // (which carries the authoritative score + wicket count) refreshes.
    broadcastIntentRef.current = { kind: 'point', team: battingTeam === 1 ? 'A' : 'B', value: 0, at: Date.now() };
    setCricketHistory(prev => [...prev, { type: 'wicket', key, freeHit, innings, battingTeam }]);

    // Pure updater: compute the new score (incl. all-out flag). Innings flip /
    // finish are handled by the post-commit transition effect.
    setScores(prev => {
      const team = { ...prev[key] };
      team.wickets += 1;
      team.balls += 1;
      if (team.wickets >= maxWickets) team.allOut = true;
      return { ...prev, [key]: team };
    });
  };

  const addExtra = (type) => {
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;
    void scoreImpact();

    const key = battingTeam === 1 ? 'team1' : 'team2';
    const battingName = battingTeam === 1 ? team1Name : team2Name;
    const countsAsBall = type === 'bye' || type === 'legBye';
    // Byes / leg byes are legal deliveries, so a free hit is used up even when no
    // runs come off the bat. Wides / no-balls don't count as a ball and keep it.
    if (countsAsBall && freeHit) setFreeHit(false);
    const extraLabel = { wide: 'wide', noBall: 'no ball', bye: 'bye', legBye: 'leg bye' };
    setLastAction(`${battingName} ${extraLabel[type] || 'extra'} +1`);
    broadcastIntentRef.current = { kind: 'point', team: battingTeam === 1 ? 'A' : 'B', value: 1, at: Date.now() };
    setCricketHistory(prev => [...prev, { type: 'extra', key, extraType: type, freeHit, innings, battingTeam }]);
    // Pure updater: add the extra run (+ a ball for byes/leg-byes). Innings flip /
    // chase-complete / finish are handled by the post-commit transition effect.
    setScores(prev => {
      const team = { ...prev[key], runs: prev[key].runs + 1 };
      if (countsAsBall) {
        team.balls += 1;
      }
      return { ...prev, [key]: team };
    });

    // No ball triggers free hit if format supports it
    if (type === 'noBall' && format.freeHit) {
      setFreeHit(true);
    }
  };

  const undoCricketAction = () => {
    if (cricketHistory.length === 0) return;
    void correctionImpact();

    broadcastIntentRef.current = { kind: 'undo', at: Date.now() };
    const last = cricketHistory[cricketHistory.length - 1];
    setCricketHistory(prev => prev.slice(0, -1));
    setLastAction('Undid last cricket action');
    if (typeof last.innings === 'number') setInnings(last.innings);
    if (typeof last.battingTeam === 'number') setBattingTeam(last.battingTeam);

    // Restore free hit state from history entry
    setFreeHit(last.freeHit || false);

    setScores(prev => {
      const team = { ...prev[last.key] };
      if (last.type === 'runs') {
        team.runs = Math.max(0, team.runs - last.value);
        team.balls = Math.max(0, team.balls - 1);
      } else if (last.type === 'wicket') {
        team.wickets = Math.max(0, team.wickets - 1);
        team.balls = Math.max(0, team.balls - 1);
        team.allOut = false;
      } else if (last.type === 'extra') {
        team.runs = Math.max(0, team.runs - 1);
        if (last.extraType === 'bye' || last.extraType === 'legBye') {
          team.balls = Math.max(0, team.balls - 1);
        }
        team.allOut = false;
      }
      return { ...prev, [last.key]: team };
    });
  };

  const makeTimerFields = () => ({
    startedAt: startedAtRef.current,
    endedAt: new Date().toISOString(),
    elapsedSeconds: timer.elapsed,
  });

  const finishCricketMatch = (finalScores) => {
    const s = finalScores || scores;
    const winner = s.team1.runs > s.team2.runs ? team1Name
      : s.team2.runs > s.team1.runs ? team2Name
      : 'Tie';
    const r = {
      id: Date.now(), sport,
      team1: team1Name, team2: team2Name,
      team1Score: s.team1, team2Score: s.team2,
      winner, format,
      date: new Date().toISOString(),
      ...makeTimerFields(),
    };
            finalizeMatch(r);
  };

  // Cricket innings flip / match finish as a single POST-COMMIT effect, instead of
  // side effects inside the setScores updaters (which read stale closure state and
  // could double-fire when React re-invokes an updater under StrictMode/batching).
  // It reads the COMMITTED scores. Ordering vs the broadcast/finalize effects is
  // safe: the boundary ball's broadcast is gated on a one-shot intent ref, so the
  // innings/battingTeam change here re-runs that effect harmlessly (no new intent →
  // no re-broadcast); and finishCricketMatch defers setPhase('result') to the next
  // render, so the winning ball still enqueues before finalize drains (R1).
  useEffect(() => {
    if (!isCricket || phase !== 'scoring') return;
    const key = battingTeam === 1 ? 'team1' : 'team2';
    const team = scores[key];
    if (!team) return;
    const inningsOver = team.balls >= totalBalls || team.wickets >= maxWickets;
    const chaseTarget = battingTeam === 2 ? scores.team1.runs : scores.team2.runs;
    const chaseDone = innings === 2 && team.runs > chaseTarget;
    if (innings === 1 && inningsOver) {
      setShowInningsBreak(true);
      setInnings(2);
      setBattingTeam(battingTeam === 1 ? 2 : 1);
    } else if (innings === 2 && (inningsOver || chaseDone)) {
      finishCricketMatch(scores);
    }
  }, [scores, innings, battingTeam, isCricket, phase, totalBalls, maxWickets]);

  const completeSetIfNeeded = (candidateSets, setIndex, activeSetIndex = currentSet) => {
    const update = { nextSets: candidateSets, nextActiveSetIndex: null, result: null };
    if (!(format.type === 'best-of' && sportConfig?.config)) return update;
    if (!candidateSets[setIndex]) return update;

    const s1 = candidateSets[setIndex].score1;
    const s2 = candidateSets[setIndex].score2;
    const completionRule = getSetWinRule({ format, sportConfig, currentSet: setIndex });

    if (!isSetComplete({ score1: s1, score2: s2 }, completionRule)) {
      candidateSets[setIndex].completed = false;
      return update;
    }

    candidateSets[setIndex].completed = true;
    const resultScore = getBestOfResultScore(candidateSets);
    const t1SetsWon = resultScore.setsWon1;
    const t2SetsWon = resultScore.setsWon2;
    const setsToWin = Math.ceil(format.sets / 2);

    if (t1SetsWon >= setsToWin || t2SetsWon >= setsToWin) {
      const winner = t1SetsWon > t2SetsWon ? team1Name : team2Name;
      const r = {
        id: Date.now(), sport,
        team1: team1Name, team2: team2Name,
        sets: candidateSets,
        score1: resultScore.score1,
        score2: resultScore.score2,
        setsWon1: t1SetsWon,
        setsWon2: t2SetsWon,
        winner, format,
        date: new Date().toISOString(),
        ...makeTimerFields(),
      };
      return { ...update, result: r };
    }

    if (setIndex === activeSetIndex && !candidateSets[setIndex + 1]) {
      candidateSets.push({ score1: 0, score2: 0, completed: false });
      return { ...update, nextActiveSetIndex: setIndex + 1 };
    }

    return update;
  };

  const applySetCompletionUpdate = (update) => {
    setSets(update.nextSets);
    if (typeof update.nextActiveSetIndex === 'number') setCurrentSet(update.nextActiveSetIndex);
    if (update.result) finalizeMatch(update.result);
  };

  // Volleyball: Add point
  const addPoint = (team) => {
    // Debounce rapid clicks
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;
    void scoreImpact();

    if (tracksPointWinnerServe) setServingTeam(team);
    setLastAction(`${getTeamLabel(team)} +1 ${scoringUnit}`);

    broadcastIntentRef.current = { kind: 'point', team: team === 1 ? 'A' : 'B', at: Date.now() };

    setVScoreHistory(prev => [...prev, {
      team,
      vScore1,
      vScore2,
      sets: cloneSetsSnapshot(sets),
      currentSet,
      servingTeam,
    }].slice(-100));

    // Best-of format (multi-set)
    if (format.type === 'best-of' && sportConfig?.config) {
      const newSets = applySetPoint(sets, currentSet, team);
      applySetCompletionUpdate(completeSetIfNeeded(newSets, currentSet));
    } else {
      // Single set format
      const target = format.target;
      const winBy = sportConfig?.config?.winBy ?? 2;
      const cap = sportConfig?.config?.maxPoints ?? null;
      const updater = (prev) => prev + 1;
      if (team === 1) {
        setVScore1(updater);
      } else {
        setVScore2(updater);
      }

      const newS1 = team === 1 ? vScore1 + 1 : vScore1;
      const newS2 = team === 2 ? vScore2 + 1 : vScore2;

      if (validateSingleSetScore(newS1, newS2, target, winBy, cap)) {
        const winner = newS1 > newS2 ? team1Name : team2Name;
        const r = {
          id: Date.now(), sport,
          team1: team1Name, team2: team2Name,
          score1: newS1, score2: newS2,
          winner, format,
          date: new Date().toISOString(),
          ...makeTimerFields(),
        };
            finalizeMatch(r);
      }
    }
  };

  const undoPoint = () => {
    if (vScoreHistory.length === 0) return;
    void correctionImpact();

    broadcastIntentRef.current = { kind: 'undo', at: Date.now() };
    const last = vScoreHistory[vScoreHistory.length - 1];
    setVScoreHistory(prev => prev.slice(0, -1));
    setLastAction('Undid last point');

    if (Array.isArray(last.sets)) {
      setSets(last.sets);
      setCurrentSet(last.currentSet || 0);
    }
    if (typeof last.servingTeam === 'number') setServingTeam(last.servingTeam);

    if (typeof last.vScore1 === 'number' && typeof last.vScore2 === 'number') {
      setVScore1(last.vScore1);
      setVScore2(last.vScore2);
      return;
    }

    if (last.team === 1) setVScore1(prev => Math.max(0, prev - 1));
    else setVScore2(prev => Math.max(0, prev - 1));
  };

  const adjustSetScore = (team, delta) => {
    const teamName = getTeamLabel(team);
    const activeSetScore = sets[currentSet] || { score1: 0, score2: 0, completed: false };
    const correctsPreviousSet = format.type === 'best-of'
      && delta < 0
      && currentSet > 0
      && activeSetScore.score1 === 0
      && activeSetScore.score2 === 0
      && sets[currentSet - 1]?.completed;
    const correctionSet = correctsPreviousSet ? sets[currentSet - 1] : activeSetScore;
    const activeScore = format.type === 'best-of'
      ? (team === 1 ? correctionSet?.score1 || 0 : correctionSet?.score2 || 0)
      : (team === 1 ? vScore1 : vScore2);
    if (delta < 0 && activeScore === 0) {
      setLastAction(`${teamName} already at 0`);
      return;
    }

    void correctionImpact();
    setLastAction(`${teamName} ${delta > 0 ? '+1' : '-1'} correction`);
    broadcastIntentRef.current = delta > 0
      ? { kind: 'point', team: team === 1 ? 'A' : 'B', at: Date.now() }
      : { kind: 'undo', at: Date.now() };
    setVScoreHistory(prev => [...prev, {
      team,
      vScore1,
      vScore2,
      sets: cloneSetsSnapshot(sets),
      currentSet,
      servingTeam,
    }].slice(-100));
    if (delta > 0 && tracksPointWinnerServe) setServingTeam(team);

    if (format.type === 'best-of') {
      const nextSets = cloneSetsSnapshot(sets);
      const currentScores = nextSets[currentSet] || { score1: 0, score2: 0, completed: false };
      const shouldCorrectPreviousSet = delta < 0
        && currentSet > 0
        && currentScores.score1 === 0
        && currentScores.score2 === 0
        && nextSets[currentSet - 1]?.completed;
      const targetSet = shouldCorrectPreviousSet ? currentSet - 1 : currentSet;

      if (!nextSets[targetSet]) nextSets[targetSet] = { score1: 0, score2: 0, completed: false };
      const key = team === 1 ? 'score1' : 'score2';
      nextSets[targetSet] = {
        ...nextSets[targetSet],
        [key]: Math.max(0, (nextSets[targetSet][key] || 0) + delta),
        completed: false,
      };

      if (shouldCorrectPreviousSet) nextSets.splice(targetSet + 1);

      const update = completeSetIfNeeded(nextSets, targetSet, targetSet);
      setSets(update.nextSets);
      if (typeof update.nextActiveSetIndex === 'number') {
        setCurrentSet(update.nextActiveSetIndex);
      } else if (shouldCorrectPreviousSet) {
        setCurrentSet(targetSet);
      }
      if (update.result) finalizeMatch(update.result);
      return;
    }

    const newS1 = team === 1 ? Math.max(0, vScore1 + delta) : vScore1;
    const newS2 = team === 2 ? Math.max(0, vScore2 + delta) : vScore2;
    setVScore1(newS1);
    setVScore2(newS2);

    if (delta > 0 && validateSingleSetScore(newS1, newS2, format.target, sportConfig?.config?.winBy ?? 2, sportConfig?.config?.maxPoints ?? null)) {
      const winner = newS1 > newS2 ? team1Name : team2Name;
      const r = {
        id: Date.now(), sport,
        team1: team1Name, team2: team2Name,
        score1: newS1, score2: newS2,
        winner, format,
        date: new Date().toISOString(),
        ...makeTimerFields(),
      };
      finalizeMatch(r);
    }
  };

  const getGoalWinner = (score1, score2) => {
    const drawAllowed = sportConfig?.config?.drawAllowed ?? true;
    if (score1 > score2) return team1Name;
    if (score2 > score1) return team2Name;
    return drawAllowed ? 'Draw' : 'Tie';
  };

  const finalizeGoalScore = (score1, score2) => {
    const drawAllowed = sportConfig?.config?.drawAllowed ?? true;
    if (!drawAllowed && score1 === score2) {
      void warningImpact();
      setSaveWarning(`${sportConfig.name} cannot end tied. Add the deciding score before ending.`);
      return;
    }

    finalizeMatch({
      id: Date.now(), sport,
      team1: team1Name, team2: team2Name,
      score1, score2,
      winner: getGoalWinner(score1, score2),
      format,
      date: new Date().toISOString(),
      ...makeTimerFields(),
    });
  };

  // Goals: Add score for a team
  const addGoal = (team, value = 1) => {
    // Timed mode: once the clock hits zero scoring is locked — EXCEPT the one
    // deciding score a no-draw tie still needs (scoringLocked encodes that). This
    // is the load-bearing guard; the render also disables the controls to match.
    if (scoringLocked) return;
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;
    void scoreImpact();

    const newS1 = team === 1 ? gScore1 + value : gScore1;
    const newS2 = team === 2 ? gScore2 + value : gScore2;

    broadcastIntentRef.current = { kind: 'point', team: team === 1 ? 'A' : 'B', value, at: Date.now() };

    if (team === 1) setGScore1(newS1);
    else setGScore2(newS2);
    setGScoreHistory(prev => [...prev, { team, value }]);
    setLastAction(`${getTeamLabel(team)} +${value} ${scoringUnit}${value === 1 ? '' : 's'}`);

    // Auto-end in points mode
    if (isPointsMode && format.target) {
      if (newS1 >= format.target || newS2 >= format.target) {
        finalizeGoalScore(newS1, newS2);
      }
    }
  };

  const undoGoal = () => {
    if (gScoreHistory.length === 0) return;
    void correctionImpact();

    broadcastIntentRef.current = { kind: 'undo', at: Date.now() };
    const last = gScoreHistory[gScoreHistory.length - 1];
    if (last.team === 1) setGScore1(prev => Math.max(0, prev - last.value));
    else setGScore2(prev => Math.max(0, prev - last.value));
    setGScoreHistory(prev => prev.slice(0, -1));
    setLastAction('Undid last score');
  };

  const adjustGoalScore = (team, delta) => {
    const teamName = getTeamLabel(team);
    const currentScore = team === 1 ? gScore1 : gScore2;
    if (delta < 0 && currentScore === 0) {
      setLastAction(`${teamName} already at 0`);
      return;
    }

    void correctionImpact();
    broadcastIntentRef.current = delta > 0
      ? { kind: 'point', team: team === 1 ? 'A' : 'B', value: delta, at: Date.now() }
      : { kind: 'undo', at: Date.now() };
    const newS1 = team === 1 ? Math.max(0, gScore1 + delta) : gScore1;
    const newS2 = team === 2 ? Math.max(0, gScore2 + delta) : gScore2;
    setGScore1(newS1);
    setGScore2(newS2);
    setGScoreHistory(prev => [...prev, { team, value: delta }]);
    setLastAction(`${teamName} ${delta > 0 ? '+1' : '-1'} correction`);

    if (delta > 0 && isPointsMode && format.target && (newS1 >= format.target || newS2 >= format.target)) {
      finalizeGoalScore(newS1, newS2);
    }
  };

  const endMatchGoals = () => {
    const drawAllowed = sportConfig?.config?.drawAllowed ?? true;
    if (!drawAllowed && gScore1 === gScore2) {
      void warningImpact();
      setSaveWarning(`${sportConfig.name} cannot end tied. Add the deciding score before ending.`);
      return;
    }
    finalizeGoalScore(gScore1, gScore2);
  };

  const getManualSetsResult = () => {
    if (format.type === 'best-of') {
      const bestOfResult = getBestOfResultScore(sets, { includeActiveWhenTied: true });
      return {
        score1: bestOfResult.score1,
        score2: bestOfResult.score2,
        winner: getWinnerName(bestOfResult.score1, bestOfResult.score2, team1Name, team2Name),
        extra: { sets, setsWon1: bestOfResult.setsWon1, setsWon2: bestOfResult.setsWon2 },
      };
    }

    return {
      score1: vScore1,
      score2: vScore2,
      winner: getWinnerName(vScore1, vScore2, team1Name, team2Name),
      extra: {},
    };
  };

  const endMatchManually = () => {
    if (isCricket) {
      finishCricketMatch(scores);
    } else if (isGoals) {
      endMatchGoals();
    } else {
      const manualResult = getManualSetsResult();
      const r = {
        id: Date.now(), sport,
        team1: team1Name, team2: team2Name,
        score1: manualResult.score1, score2: manualResult.score2,
        ...manualResult.extra,
        winner: manualResult.winner, format, date: new Date().toISOString(),
        ...makeTimerFields(),
      };
            finalizeMatch(r);
    }
  };

  const resetMatchState = (nextPhase = 'setup', options = {}) => {
    restoredDraftRef.current = false;
    setSaveWarning('');
    setPhase(nextPhase);
    if (options.resetTeams) {
      setTeam1Name('Team A');
      setTeam2Name('Team B');
      setTeam1Players([]);
      setTeam2Players([]);
    }
    setScores({ team1: { runs: 0, balls: 0, wickets: 0, allOut: false }, team2: { runs: 0, balls: 0, wickets: 0, allOut: false } });
    setVScore1(0);
    setVScore2(0);
    setGScore1(0);
    setGScore2(0);
    setServingTeam(1);
    setLastAction('');
    setShowEndConfirm(false);
    setSidesSwapped(false);
    setGScoreHistory([]);
    setVScoreHistory([]);
    setSets([{ score1: 0, score2: 0, completed: false }]);
    setCurrentSet(0);
    setCricketHistory([]);
    setFreeHit(false);
    setTrialBallUsed(false);
    setInnings(1);
    setBattingTeam(1);
    setResult(null);
    setShareStatus('');
    resetSync();
    liveRef.current?.reset?.(); // drop the prior live session so the next match starts clean (R2)
    clearData(quickMatchDraftKey);
    timer.reset();
    startedAtRef.current = null;
    // Mint a fresh live id when going STRAIGHT into scoring (e.g. "play again"),
    // matching the setup→start path — otherwise a rematch has no clientMatchId and
    // can't go live. null for setup; the start handler mints there.
    liveMatchIdRef.current = nextPhase === 'scoring' ? Date.now() : null;
    if (nextPhase === 'scoring') scoringSportRef.current = sport;
  };

  const shareResult = async () => {
    if (!result) return;
    setShareStatus('Opening share...');
    try {
      const response = await shareText({
        title: 'Score Easy result',
        text: buildResultShareText(result, { isCricket }),
        dialogTitle: 'Share match result',
      });
      setShareStatus(getShareStatusText(response));
    } catch {
      setShareStatus('Could not share result.');
    }
  };

  // === SETUP PHASE ===
  // Determine if cricket has customizable rules (gully/custom need a Rules step)
  const cricketHasRules = isCricket && (cricketPreset === 'gully' || cricketPreset === 'custom');
  const hasRulesStep = cricketHasRules || (!isCricket && formatMode === 'custom');
  // Cricket: Format → [Rules] → Teams | Non-cricket: Format → [Rules] → Teams
  const totalSteps = hasRulesStep ? 3 : 2;
  const stepLabels = hasRulesStep
    ? ['Format', 'Match Rules', 'Teams']
    : ['Format', 'Teams'];

  // Current step label for display
  const currentStepLabel = stepLabels[setupStep - 1] || '';

  // Derived: selected cricket format info for summary
  const selectedCricketFormat = isCricket
    ? CRICKET_FORMATS.find(f => f.id === cricketPreset)
    : null;
  const ruleSummary = getRuleSummary({
    engine,
    format,
    formatMode,
    isCricket,
    isGoals,
    sportConfig,
    selectedCricketFormat,
  });
  const teamNamesReady = Boolean(team1Name.trim() && team2Name.trim());
  const isTeamSetupStep = setupStep === totalSteps;
  const showRosterSetup = showTeam1Roster || showTeam2Roster;
  const playerCount = team1Players.length + team2Players.length;
  const startButtonLabel = getSportStartLabel(sportConfig);
  const toggleRosterSetup = () => {
    const nextState = !showRosterSetup;
    setShowTeam1Roster(nextState);
    setShowTeam2Roster(nextState);
  };
  const quickMatchScoringHeading = `${sportConfig?.name || sport || 'Sport'} quick match`;
  const handleSetupBack = () => {
    if (isTeamSetupStep) {
      const browserHistoryIndex = globalThis.history?.state?.idx;
      const hasPriorRoute = typeof browserHistoryIndex === 'number'
        ? browserHistoryIndex > 0
        : location.key !== 'default';
      if (hasPriorRoute) {
        navigate(-1);
        return;
      }
      navigate(`/play?sport=${sport}`, { replace: true });
      return;
    }
    setSetupStep(totalSteps);
  };

  if (phase === 'setup') {
    return (
      <div className={`min-h-screen px-6 py-10 mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>
        <div className="max-w-2xl mx-auto">
          {saveWarning && (
            <div className="mono-alert mono-alert-danger mb-4">
              {saveWarning}
            </div>
          )}
          {/* Header */}
          <nav className="flex items-center gap-4 mb-6">
            <button
              onClick={handleSetupBack}
              className="text-sm bg-transparent border-none cursor-pointer font-swiss"
              style={{ color: 'var(--se-color-ink-muted)' }}
              aria-label={isTeamSetupStep ? 'Go back' : 'Return to match setup'}
            >
              <BackArrow />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--se-color-ink)' }}>
                {sportConfig?.icon || '\u{1F3D0}'} Quick Match
              </h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--se-color-ink-muted)' }}>
                {isTeamSetupStep ? 'Setup match' : `Edit ${currentStepLabel.toLowerCase()}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/${sport}/tournament`)}
              className="bg-transparent border-none cursor-pointer"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--primary)', padding: '12px 0', minHeight: 44 }}
              aria-label="Switch to tournament setup"
            >
              Tournament &rarr;
            </button>
          </nav>

          {/* Step progress bar */}
          {!isTeamSetupStep && (
            <div className="flex gap-1 mb-8">
              {Array.from({ length: totalSteps }, (_, i) => (
                <div
                  key={`step-bar-${i}`}
                  className="flex-1"
                  style={{
                    height: '3px',
                    background: i < setupStep ? 'var(--primary)' : 'var(--muted)',
                    transition: 'background 0.2s ease',
                  }}
                />
              ))}
            </div>
          )}

          {/* ──────── STEP 1: FORMAT ──────── */}
          {setupStep === 1 && (
            <>
              {/* Cricket Format Cards */}
              {isCricket && (
                <div className="mb-8">
                  <label className="text-xs uppercase tracking-widest font-normal mb-4 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                    Choose Format
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {CRICKET_FORMATS.map(cf => {
                      const isSelected = cricketPreset === cf.id;
                      return (
                        <button
                          key={cf.id}
                          onClick={() => {
                            setCricketPreset(cf.id);
                            setFormatMode(cf.customizable ? 'custom' : 'standard');
                            setFormat(buildCricketFormat(cf.id));
                            setShowCustomOvers(false);
                            setCustomOvers('');
                          }}
                          className={`mono-setup-option text-left ${isSelected ? 'mono-setup-option-selected' : ''}`}
                          style={{
                            padding: '16px',
                            cursor: 'pointer',
                          }}
                        >
                          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--se-color-ink)' }}>
                            {cf.name}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--se-color-ink-muted)' }}>{cf.desc}</p>
                          {cf.id !== 'custom' && (
                            <p className="text-xs font-mono mt-2" style={{ color: '#aaa' }}>
                              {cf.overs ? `${cf.overs} ov` : 'Unlimited'} &middot; {cf.players}p
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Non-cricket: Format Mode */}
              {!isCricket && (
                <div className="mb-8">
                  <label className="text-xs uppercase tracking-widest font-normal mb-4 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                    Format Mode
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setFormatMode('standard')}
                      className={`mono-setup-option flex-1 text-left ${formatMode === 'standard' ? 'mono-setup-option-selected' : ''}`}
                      style={{
                        padding: '16px',
                        cursor: 'pointer',
                      }}
                    >
                      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--se-color-ink)' }}>Standard</p>
                      <p className="text-xs" style={{ color: 'var(--se-color-ink-muted)' }}>Official rules for {sportConfig?.name || 'this sport'}</p>
                    </button>
                    <button
                      onClick={() => setFormatMode('custom')}
                      className={`mono-setup-option flex-1 text-left ${formatMode === 'custom' ? 'mono-setup-option-selected' : ''}`}
                      style={{
                        padding: '16px',
                        cursor: 'pointer',
                      }}
                    >
                      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--se-color-ink)' }}>Custom</p>
                      <p className="text-xs" style={{ color: 'var(--se-color-ink-muted)' }}>Set your own rules</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Next button */}
              <button
                onClick={() => setSetupStep(2)}
                className="mono-btn-primary w-full"
                style={{ padding: '12px', fontSize: '0.9375rem' }}
              >
                Next: {hasRulesStep ? 'Match Rules' : 'Teams'}
              </button>
            </>
          )}

          {/* ──────── STEP 2: MATCH RULES (conditional) ──────── */}
          {setupStep === 2 && hasRulesStep && (
            <>
              {/* Format summary card */}
              {isCricket && selectedCricketFormat && (
                <div className="mono-soft-panel mb-6 flex items-center gap-3" style={{ padding: '12px 16px' }}>
                  <span className="text-2xl">🏏</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--se-color-ink)' }}>{selectedCricketFormat.name}</p>
                    <p className="text-xs" style={{ color: 'var(--se-color-ink-muted)' }}>{selectedCricketFormat.desc}</p>
                  </div>
                  <button
                    onClick={() => setSetupStep(1)}
                    className="ml-auto text-xs bg-transparent border-none cursor-pointer"
                    style={{ color: 'var(--primary)' }}
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Cricket customizable rules */}
              {isCricket && cricketHasRules && (
                <div className="mb-6">
                  {/* Scoring Format toggle (Custom only) */}
                  {cricketPreset === 'custom' && (
                    <div className="mb-6">
                      <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                        Scoring format
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setFormat(prev => ({ ...prev, trackOvers: true, maxBalls: null }))}
                          className={format.trackOvers !== false ? 'mono-btn-primary' : 'mono-btn'}
                          style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                        >
                          Track by Overs
                        </button>
                        <button
                          onClick={() => setFormat(prev => ({ ...prev, trackOvers: false, overs: null, powerplay: [] }))}
                          className={format.trackOvers === false ? 'mono-btn-primary' : 'mono-btn'}
                          style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                        >
                          Track by Balls
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Overs (when tracking overs) */}
                  {format.trackOvers !== false && (
                    <div className="mb-6">
                      <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                        Overs
                      </span>
                      <div className="flex gap-2 flex-wrap mb-3">
                        <button
                          onClick={() => {
                            setFormat(prev => ({ ...prev, overs: null }));
                            setCustomOvers('');
                            setShowCustomOvers(false);
                          }}
                          className={format.overs === null && !showCustomOvers ? 'mono-btn-primary' : 'mono-btn'}
                          style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                        >
                          No limit
                        </button>
                        {OVERS_PRESETS.map(preset => (
                          <button
                            key={preset.value}
                            onClick={() => {
                              setFormat(prev => ({ ...prev, overs: preset.value }));
                              setCustomOvers('');
                              setShowCustomOvers(false);
                            }}
                            className={format.overs === preset.value && !showCustomOvers ? 'mono-btn-primary' : 'mono-btn'}
                            style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                          >
                            {preset.label}
                          </button>
                        ))}
                        <button
                          onClick={() => { setShowCustomOvers(true); setCustomOvers(''); }}
                          className={showCustomOvers ? 'mono-btn-primary' : 'mono-btn'}
                          style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                        >
                          Custom
                        </button>
                      </div>
                      {showCustomOvers && (
                        <div className="flex items-center gap-2 mb-3">
                          <input
                            type="number" min="1" max="50"
                            className="mono-input"
                            style={{ width: '80px', textAlign: 'center' }}
                            placeholder="1-50" value={customOvers}
                            onChange={(e) => {
                              const v = Number.parseInt(e.target.value);
                              setCustomOvers(e.target.value);
                              if (v >= 1 && v <= 50) setFormat(prev => ({ ...prev, overs: v }));
                            }}
                          />
                          <span className="text-xs" style={{ color: 'var(--se-color-ink-muted)' }}>overs</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ball limit (when tracking balls only, Custom) */}
                  {cricketPreset === 'custom' && format.trackOvers === false && (
                    <div className="mb-6">
                      <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                        Ball limit
                      </span>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setFormat(prev => ({ ...prev, maxBalls: null }))}
                          className={!format.maxBalls ? 'mono-btn-primary' : 'mono-btn'}
                          style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                        >
                          No limit
                        </button>
                        <button
                          onClick={() => setFormat(prev => ({ ...prev, maxBalls: Math.max(6, (prev.maxBalls || 30) - 6) }))}
                          className="mono-btn"
                          style={{ width: '40px', height: '40px', padding: 0, fontSize: '1.25rem', fontWeight: 700 }}
                        >
                          &minus;
                        </button>
                        <span className="text-2xl font-bold font-mono" style={{ color: 'var(--se-color-ink)', minWidth: '36px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                          {format.maxBalls || '\u221E'}
                        </span>
                        <button
                          onClick={() => setFormat(prev => ({ ...prev, maxBalls: (prev.maxBalls || 24) + 6 }))}
                          className="mono-btn"
                          style={{ width: '40px', height: '40px', padding: 0, fontSize: '1.25rem', fontWeight: 700 }}
                        >
                          +
                        </button>
                      </div>
                      <p className="text-xs mt-2" style={{ color: 'var(--se-color-ink-faint)' }}>No over structure — just track runs and balls</p>
                    </div>
                  )}

                  <hr className="mono-divider mb-6" />

                  {/* Players */}
                  <div className="mb-6">
                    <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                      Players per side
                    </span>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setFormat(prev => ({ ...prev, players: Math.max(2, (prev.players || 6) - 1) }))}
                        className="mono-btn"
                        style={{ width: '40px', height: '40px', padding: 0, fontSize: '1.25rem', fontWeight: 700 }}
                        disabled={format.players <= 2}
                      >
                        &minus;
                      </button>
                      <span className="text-2xl font-bold font-mono" style={{ color: 'var(--se-color-ink)', minWidth: '36px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                        {format.players || 6}
                      </span>
                      <button
                        onClick={() => {
                          const maxPlayers = format.solo ? 10 : 11;
                          setFormat(prev => ({ ...prev, players: Math.min(maxPlayers, (prev.players || 6) + 1) }));
                        }}
                        className="mono-btn"
                        style={{ width: '40px', height: '40px', padding: 0, fontSize: '1.25rem', fontWeight: 700 }}
                        disabled={format.players >= (format.solo ? 10 : 11)}
                      >
                        +
                      </button>
                    </div>
                    <p className="text-xs mt-2" style={{ color: 'var(--se-color-ink-faint)' }}>
                      {(format.players || 6) - 1} wickets to bowl a team out
                    </p>
                  </div>

                  {/* Match type */}
                  <div className="mb-6">
                    <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                      Match type
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFormat(prev => ({ ...prev, solo: true, players: Math.min(prev.players || 6, 10) }))}
                        className={format.solo ? 'mono-btn-primary' : 'mono-btn'}
                        style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                      >
                        Bat Only
                      </button>
                      <button
                        onClick={() => setFormat(prev => ({ ...prev, solo: false }))}
                        className={format.solo === false ? 'mono-btn-primary' : 'mono-btn'}
                        style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                      >
                        Bat &amp; Bowl
                      </button>
                    </div>
                    <p className="text-xs mt-2" style={{ color: 'var(--se-color-ink-faint)' }}>
                      {format.solo
                        ? 'One team bats, other bowls'
                        : 'Both teams bat and bowl'
                      }
                    </p>
                  </div>

                  {/* Innings Format (Gully and Custom) */}
                  <div className="mb-6">
                    <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                      Innings
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFormat(prev => ({ ...prev, totalInnings: 2, declaration: false, followOn: false }))}
                        className={(format.totalInnings || 2) === 2 ? 'mono-btn-primary' : 'mono-btn'}
                        style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                      >
                        1 per side
                      </button>
                      <button
                        onClick={() => setFormat(prev => ({ ...prev, totalInnings: 4, declaration: true, followOn: true }))}
                        className={format.totalInnings === 4 ? 'mono-btn-primary' : 'mono-btn'}
                        style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                      >
                        2 per side (Test style)
                      </button>
                    </div>
                  </div>

                  {/* House Rules (Gully only) */}
                  {cricketPreset === 'gully' && (
                    <div className="mb-6">
                      <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="text-xs bg-transparent border-none cursor-pointer font-swiss"
                        style={{ color: 'var(--primary)', padding: '8px 0', marginBottom: showAdvanced ? 8 : 0 }}
                      >
                        {showAdvanced ? '- Hide advanced options' : '+ Advanced options'}
                      </button>
                      {showAdvanced && (
                        <div>
                          <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                            House rules
                          </span>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setFormat(prev => ({ ...prev, lastManStands: !prev.lastManStands }))}
                              className={format.lastManStands ? 'mono-btn-primary' : 'mono-btn'}
                              style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                            >
                              Last Man Batting
                            </button>
                            <button
                              onClick={() => setFormat(prev => ({ ...prev, trialBall: !prev.trialBall }))}
                              className={format.trialBall ? 'mono-btn-primary' : 'mono-btn'}
                              style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                            >
                              Trial Ball
                            </button>
                            <button
                              onClick={() => setFormat(prev => ({ ...prev, oneTipOneHand: !prev.oneTipOneHand }))}
                              className={format.oneTipOneHand ? 'mono-btn-primary' : 'mono-btn'}
                              style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                            >
                              One Tip One Hand
                            </button>
                          </div>
                          <p className="text-xs mt-2" style={{ color: 'var(--se-color-ink-faint)' }}>
                            {format.lastManStands && 'Last batter plays alone \u00B7 '}
                            {format.trialBall && 'First ball doesn\'t count \u00B7 '}
                            {format.oneTipOneHand && 'One-bounce catch = out'}
                            {!format.lastManStands && !format.trialBall && !format.oneTipOneHand && 'Toggle rules on/off'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Non-cricket custom rules */}
              {!isCricket && formatMode === 'custom' && (
                <div className="mb-6">
                  {/* Sets sports */}
                  {engine === 'sets' && sportConfig?.config?.setFormats && (
                    <>
                      <div className="mb-6">
                        <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                          Format
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setFormat(prev => ({ type: 'best-of', sets: 3, points: prev.points || 25 }))}
                            className={format.type === 'best-of' ? 'mono-btn-primary' : 'mono-btn'}
                            style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                          >
                            Best-of
                          </button>
                          <button
                            onClick={() => setFormat(prev => ({ type: 'single', target: prev.target || 15, points: prev.points || 25 }))}
                            className={format.type === 'single' ? 'mono-btn-primary' : 'mono-btn'}
                            style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                          >
                            Single set
                          </button>
                        </div>
                      </div>

                      {format.type === 'best-of' && (
                        <>
                          <div className="mb-6">
                            <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                              Sets
                            </span>
                            <div className="flex gap-2 flex-wrap">
                              {sportConfig.config.setFormats.filter(f => f.sets > 1).map((formatOption, idx) => (
                                <button
                                  key={`set-format-${formatOption.sets}-${idx}`}
                                  onClick={() => setFormat(prev => ({ ...prev, type: 'best-of', sets: formatOption.sets }))}
                                  className={format.sets === formatOption.sets ? 'mono-btn-primary' : 'mono-btn'}
                                  style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                                >
                                  {formatOption.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="mb-6">
                            <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                              Points per set
                            </span>
                            <div className="flex gap-2 flex-wrap">
                              {POINTS_PRESETS.map(preset => (
                                <button
                                  key={preset.value}
                                  onClick={() => setFormat(prev => ({ ...prev, points: preset.value }))}
                                  className={format.points === preset.value ? 'mono-btn-primary' : 'mono-btn'}
                                  style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {format.type === 'single' && (
                        <div className="mb-6">
                          <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                            Points to win
                          </span>
                          <div className="flex gap-2 flex-wrap">
                            {POINTS_PRESETS.map(preset => (
                              <button
                                key={preset.value}
                                onClick={() => setFormat(prev => ({ ...prev, type: 'single', target: preset.value }))}
                                className={format.target === preset.value ? 'mono-btn-primary' : 'mono-btn'}
                                style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Goals sports */}
                  {isGoals && (
                    <>
                      <div className="mb-6">
                        <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                          How are you playing?
                        </span>
                        <div className="flex gap-2">
                          {[
                            { key: 'free', label: 'Free play' },
                            { key: 'timed', label: 'By time' },
                            { key: 'points', label: 'By points' },
                          ].map(opt => (
                            <button
                              key={opt.key}
                              onClick={() => setFormat({ mode: opt.key })}
                              className={format.mode === opt.key ? 'mono-btn-primary' : 'mono-btn'}
                              style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {format.mode === 'timed' && (
                        <div className="mb-6">
                          <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                            Time limit
                          </span>
                          <div className="flex gap-2 flex-wrap">
                            {(sportConfig?.config?.timePresets || [
                              { label: '10 min', value: 600 },
                              { label: '20 min', value: 1200 },
                              { label: '30 min', value: 1800 },
                            ]).map(opt => (
                              <button
                                key={opt.label}
                                onClick={() => setFormat({ mode: 'timed', timeLimit: opt.value })}
                                className={format.timeLimit === opt.value ? 'mono-btn-primary' : 'mono-btn'}
                                style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {format.mode === 'points' && (
                        <div className="mb-6">
                          <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                            First to
                          </span>
                          <div className="flex gap-2 flex-wrap">
                            {(sportConfig?.config?.pointPresets || [5, 10, 15, 20]).map(pts => (
                              <button
                                key={pts}
                                onClick={() => setFormat({ mode: 'points', target: pts })}
                                className={format.target === pts ? 'mono-btn-primary' : 'mono-btn'}
                                style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                              >
                                {pts} {sportConfig?.config?.scoringUnit || 'point'}s
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Next button */}
              <button
                onClick={() => setSetupStep(hasRulesStep ? 3 : 2)}
                className="mono-btn-primary w-full"
                style={{ padding: '12px', fontSize: '0.9375rem' }}
              >
                Next: Teams
              </button>
            </>
          )}

          {/* ──────── FINAL STEP: TEAMS ──────── */}
          {setupStep === totalSteps && (
            <>
              {/* Format summary */}
              <section className="mono-soft-panel mb-6" style={{ padding: '16px' }} aria-labelledby="quick-match-rules-heading">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-2xl">{sportConfig?.icon || '\u{1F3D0}'}</span>
                    <div>
                      <h2 id="quick-match-rules-heading" className="text-sm font-semibold" style={{ color: 'var(--se-color-ink)' }}>
                        Match rules
                      </h2>
                      <p className="text-sm mt-1" style={{ color: '#333' }}>
                        {isCricket && selectedCricketFormat ? selectedCricketFormat.name : sportConfig?.name}
                      </p>
                      <p className="text-xs font-mono mt-1" style={{ color: 'var(--se-color-ink-muted)' }}>
                        {ruleSummary}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSetupStep(1)}
                    className="text-xs bg-transparent cursor-pointer w-full sm:w-auto"
                    style={{
                      minHeight: 44,
                      border: '1.5px solid var(--primary)',
                      color: 'var(--primary)',
                      padding: '0 12px',
                    }}
                  >
                    Edit Rules
                  </button>
                </div>
              </section>

              {/* Team names */}
              <fieldset className="mb-8 border-0 p-0">
                <legend className="text-xs uppercase tracking-widest font-normal mb-4 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                  Teams
                </legend>

                {/* Team 1 */}
                <div ref={team1Ref} className="relative mb-5">
                  <label htmlFor="quick-team-1" className="text-xs font-semibold mb-2 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                    Team A name
                  </label>
                  <input
                    id="quick-team-1"
                    type="text"
                    className="mono-input mb-1"
                    placeholder="Team A"
                    value={team1Name}
                    onChange={e => { setTeam1Name(e.target.value); setShowTeam1Suggestions(e.target.value.length >= 2); }}
                    onFocus={() => setShowTeam1Suggestions(true)}
                    maxLength={50}
                  />
                  {showTeam1Suggestions && (team1Loading || team1Empty || sortedTeam1.length > 0) && (
                    <div
                      className="absolute left-0 right-0"
                      style={{
                        background: '#fff', border: '1px solid #eee',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', zIndex: 10,
                        maxHeight: 180, overflowY: 'auto',
                      }}
                    >
                      {team1Loading && (
                        <p role="status" className="text-sm" style={{ padding: '8px 12px', color: 'var(--se-color-ink-muted)' }}>Searching teams…</p>
                      )}
                      {team1Empty && (
                        <p role="status" className="text-sm" style={{ padding: '8px 12px', color: 'var(--se-color-ink-muted)' }}>No saved teams match “{debouncedTeam1}”.</p>
                      )}
                      {sortedTeam1.map(t => (
                        <button
                          key={t._id}
                          onClick={() => { setTeam1Name(t.name); setShowTeam1Suggestions(false); }}
                          onMouseDown={e => e.preventDefault()}
                          className="w-full text-left bg-transparent border-none cursor-pointer flex items-center justify-between"
                          style={{ padding: '8px 12px', borderBottom: '1px solid #f5f5f5' }}
                        >
                          <span className="text-sm" style={{ color: 'var(--se-color-ink)' }}>{t.name}</span>
                          <span className="text-xs font-mono" style={{ color: 'var(--se-color-ink-faint)' }}>
                            {t.matchCount} match{t.matchCount !== 1 ? 'es' : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Team 2 */}
                <div ref={team2Ref} className="relative">
                  <label htmlFor="quick-team-2" className="text-xs font-semibold mb-2 block" style={{ color: 'var(--se-color-ink-muted)' }}>
                    Team B name
                  </label>
                  <input
                    id="quick-team-2"
                    type="text"
                    className="mono-input mb-1"
                    placeholder="Team B"
                    value={team2Name}
                    onChange={e => { setTeam2Name(e.target.value); setShowTeam2Suggestions(e.target.value.length >= 2); }}
                    onFocus={() => setShowTeam2Suggestions(true)}
                    maxLength={50}
                  />
                  {showTeam2Suggestions && (team2Loading || team2Empty || sortedTeam2.length > 0) && (
                    <div
                      className="absolute left-0 right-0"
                      style={{
                        background: '#fff', border: '1px solid #eee',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', zIndex: 10,
                        maxHeight: 180, overflowY: 'auto',
                      }}
                    >
                      {team2Loading && (
                        <p role="status" className="text-sm" style={{ padding: '8px 12px', color: 'var(--se-color-ink-muted)' }}>Searching teams…</p>
                      )}
                      {team2Empty && (
                        <p role="status" className="text-sm" style={{ padding: '8px 12px', color: 'var(--se-color-ink-muted)' }}>No saved teams match “{debouncedTeam2}”.</p>
                      )}
                      {sortedTeam2.map(t => (
                        <button
                          key={t._id}
                          onClick={() => { setTeam2Name(t.name); setShowTeam2Suggestions(false); }}
                          onMouseDown={e => e.preventDefault()}
                          className="w-full text-left bg-transparent border-none cursor-pointer flex items-center justify-between"
                          style={{ padding: '8px 12px', borderBottom: '1px solid #f5f5f5' }}
                        >
                          <span className="text-sm" style={{ color: 'var(--se-color-ink)' }}>{t.name}</span>
                          <span className="text-xs font-mono" style={{ color: 'var(--se-color-ink-faint)' }}>
                            {t.matchCount} match{t.matchCount !== 1 ? 'es' : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={toggleRosterSetup}
                  className="text-xs bg-transparent cursor-pointer font-swiss mt-4 mb-3"
                  style={{
                    alignItems: 'center',
                    border: '1.5px solid #dbeafe',
                    color: 'var(--primary)',
                    display: 'inline-flex',
                    minHeight: 44,
                    padding: '0 12px',
                  }}
                >
                  {showRosterSetup ? 'Hide players' : 'Add players'}
                  {playerCount > 0 && !showRosterSetup && (
                    <span style={{ color: 'var(--se-color-ink-muted)', marginLeft: 4 }}>({playerCount})</span>
                  )}
                </button>

                {showRosterSetup && (
                  <div className="mb-4 grid gap-4" style={{ paddingLeft: 8, borderLeft: '2px solid #eee' }}>
                    <div>
                      <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--se-color-ink-muted)' }}>
                        Team A players
                      </h3>
                      <PlayerSearchInput
                        players={team1Players}
                        onAdd={p => setTeam1Players(prev => [...prev, p])}
                        onRemove={i => setTeam1Players(prev => prev.filter((_, idx) => idx !== i))}
                        placeholder="Search @username or type name"
                      />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--se-color-ink-muted)' }}>
                        Team B players
                      </h3>
                      <PlayerSearchInput
                        players={team2Players}
                        onAdd={p => setTeam2Players(prev => [...prev, p])}
                        onRemove={i => setTeam2Players(prev => prev.filter((_, idx) => idx !== i))}
                        placeholder="Search @username or type name"
                      />
                    </div>
                  </div>
                )}
              </fieldset>

              {/* Referee checkbox */}
              {showRefereeOption && (
                <label
                  className="flex items-center gap-3 mb-6 cursor-pointer"
                  style={{ padding: '12px 0' }}
                >
                  <input
                    type="checkbox"
                    checked={isRefereeing}
                    onChange={e => setIsRefereeing(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                  />
                  <span className="text-sm" style={{ color: 'var(--se-color-ink)' }}>
                    I'm refereeing this match
                  </span>
                </label>
              )}

              <button
                onClick={startMatch}
                className="mono-btn-primary w-full"
                style={{
                  minHeight: 52,
                  padding: '12px',
                  fontSize: '0.9375rem',
                }}
                aria-disabled={!teamNamesReady}
                aria-describedby={!teamNamesReady ? 'start-match-hint' : undefined}
              >
                {startButtonLabel}
              </button>
              {!teamNamesReady && (
                <p id="start-match-hint" role="status" className="text-xs text-center mt-3" style={{ color: 'var(--se-color-ink-muted)' }}>
                  Add both team names to start the match.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // === SCORING PHASE ===
  const timerDisplay = isTimedMode
    ? formatCountdown(remainingSeconds)
    : timer.formatted;
  const timerColor = isTimeUp ? 'var(--destructive)' : 'var(--se-color-ink-muted)';

  const quickButtons = sportConfig?.config?.quickButtons;
  const hasQuickButtons = quickButtons && quickButtons.length > 0;

  // Cricket scoring helpers
  const showOvers = !isCricket || format.trackOvers !== false;
  const formatPreset = isCricket && format?.preset ? getCricketFormat(format.preset) : null;
  const presetLabel = formatPreset?.name || '';
  const endMatchDialog = showEndConfirm ? (
    <ConfirmDialog onCancel={cancelEndMatch} onConfirm={confirmEndMatch} />
  ) : null;

  const discardDialog = showDiscardConfirm ? (
    <ConfirmDialog
      idPrefix="discard-match"
      title="Discard match?"
      message="This will delete this in-progress match. This can't be undone."
      confirmLabel="Discard"
      cancelLabel="Keep scoring"
      onCancel={cancelDiscardQuickMatch}
      onConfirm={confirmDiscardQuickMatch}
    />
  ) : null;

  if (phase === 'scoring') {
    if (isCricket) {
      const currentKey = battingTeam === 1 ? 'team1' : 'team2';
      const currentScore = scores[currentKey];
      const currentName = battingTeam === 1 ? team1Name : team2Name;
      const otherScore = battingTeam === 1 ? scores.team2 : scores.team1;
      const otherName = battingTeam === 1 ? team2Name : team1Name;
      const target = innings === 2
        ? (battingTeam === 2 ? scores.team1.runs : scores.team2.runs)
        : null;

      // Innings break: summarise innings 1 and the chase target before innings 2
      // scoring. Not persisted to the draft, so a reload simply resumes scoring.
      if (showInningsBreak) {
        return (
          <div className="mono-scorer-screen mono-arena-screen">
            <div className="mono-scorer-shell mono-cricket-shell">
              <h1 className="sr-only">{quickMatchScoringHeading}</h1>
              <section
                className="mono-card"
                role="dialog"
                aria-modal="true"
                aria-label="Innings break"
                style={{ margin: 'auto', maxWidth: 420, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}
              >
                <p className="font-swiss" style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--se-color-ink-muted)' }}>
                  Innings break
                </p>
                <div>
                  <p className="text-sm" style={{ color: 'var(--se-color-ink-muted)' }}>{otherName} scored</p>
                  <p className="mono-score" style={{ fontSize: '2rem', fontWeight: 800 }}>{otherScore.runs}/{otherScore.wickets}</p>
                  <p className="text-xs" style={{ color: 'var(--se-color-ink-faint)' }}>({ballsToOvers(otherScore.balls)} overs)</p>
                </div>
                <p className="text-sm" style={{ color: 'var(--se-color-ink)' }}>
                  {currentName} need <strong>{(target ?? 0) + 1}</strong> to win
                  {showOvers && format.overs ? ` from ${format.overs} overs` : ''}.
                </p>
                <button type="button" className="mono-btn-primary w-full" style={{ minHeight: 52 }} onClick={() => setShowInningsBreak(false)}>
                  Start innings 2
                </button>
              </section>
            </div>
          </div>
        );
      }

      // CrickHeroes-style derived context (no new storage)
      const overPips = cricketOverPips(cricketHistory, innings, battingTeam);
      const crr = currentScore.balls > 0 ? calculateRunRate(currentScore.runs, currentScore.balls) : 0;
      const projectedScore = (showOvers && format.overs && currentScore.balls > 0) ? Math.round(crr * format.overs) : null;

      // Powerplay
      const currentOver = Math.floor(currentScore.balls / 6) + 1;
      const powerplay = showOvers ? getPowerplayPhase(format, currentOver) : null;

      // Gully indicators
      const isLastMan = format.lastManStands && currentScore.wickets >= maxWickets - 1 && currentScore.wickets < maxWickets;
      const showTrialBall = format.trialBall && !trialBallUsed && innings === 1 && currentScore.balls === 0;

      // Overs/balls display
      const oversDisplay = showOvers
        ? `${ballsToOvers(currentScore.balls)} ov${format.overs ? ' / ' + format.overs : ''}`
        : `${currentScore.balls} balls${format.maxBalls ? ' / ' + format.maxBalls : ''}`;
      const otherOversDisplay = showOvers
        ? `${ballsToOvers(otherScore.balls)} ov`
        : `${otherScore.balls} balls`;

      return (
        <div className="mono-scorer-screen mono-arena-screen">
          <div className="mono-scorer-shell mono-cricket-shell">
            <h1 className="sr-only">{quickMatchScoringHeading}</h1>
            {endMatchDialog}
            {discardDialog}
            <ScoringNotice message={saveWarning} />
            <ScoringStatusStrip lastAction={lastAction} />
            {/* Top bar */}
            <div className="mono-scorer-topbar">
              <span className="text-sm font-swiss" style={{ color: 'var(--se-color-ink-muted)' }}>{sportConfig?.name || 'Cricket'}</span>
              <div className="mono-scorer-topbar-actions">
                {presetLabel && <span className="mono-badge">{presetLabel}</span>}
                <span className="text-xs font-mono" style={{ color: 'var(--se-color-ink-muted)' }}>{timer.formatted}</span>
                {isRefereeing && <span className="text-xs" style={{ color: 'var(--se-color-ink-muted)' }}>Referee&nbsp;&middot;</span>}
                <span className="mono-badge mono-badge-live">Innings {innings}</span>
                <EndMatchButton onEnd={requestEndMatch} />
              </div>
            </div>

            {/* Live broadcast control, held in a fixed-height slot so the score
                doesn't jump when the bar hydrates from null -> control. Gated on
                cloudAuthAvailable so offline builds (bar always null) don't reserve
                a permanent empty gap. */}
            {cloudAuthAvailable && (
              <div className="mono-live-slot">
                <LiveBroadcastBar
                  broadcast={live}
                  descriptor={liveDescriptor}
                  enabled={liveEnabled}
                  onEnableChange={setLiveEnabled}
                />
              </div>
            )}

            {/* Gully rule indicators */}
            {format.oneTipOneHand && (
              <p className="text-xs text-center mb-2" style={{ color: 'var(--se-color-ink-muted)' }}>One tip one hand active</p>
            )}

            {/* Trial ball banner */}
            {showTrialBall && (
              <div className="mono-alert mono-alert-info text-center mb-4" style={{ padding: '12px 16px' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--primary)' }}>Trial Ball — first delivery doesn't count</p>
                <button
                  onClick={() => setTrialBallUsed(true)}
                  className="mono-btn mt-2"
                  style={{ padding: '6px 16px', fontSize: '0.75rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                >
                  Skip (Trial)
                </button>
              </div>
            )}

            {/* Batting team — hero */}
            <div className="mono-scorer-main-score mono-quick-cricket-score">
              <p className="text-xs uppercase font-mono" style={{ color: 'var(--se-color-ink-muted)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>
                {currentName} batting
              </p>
              <p className="mono-scorer-score-value font-bold font-mono mono-score" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.06em', color: 'var(--se-color-ink)', margin: 0, lineHeight: 0.95, fontSize: 'clamp(3.5rem, 17vw, 6rem)', fontVariantNumeric: 'tabular-nums' }}>
                <span>{currentScore.runs}</span>
                <span style={{ color: 'var(--se-color-ink-faint)', fontSize: '0.42em', fontWeight: 700 }}>/{currentScore.wickets}</span>
                <span style={{ color: 'var(--se-color-ink-muted)', fontSize: '0.2em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>({oversDisplay})</span>
              </p>
              <p className="text-sm font-mono" style={{ color: 'var(--se-color-ink-muted)', marginTop: 6 }}>
                CRR {crr.toFixed(2)}
                {projectedScore !== null ? ` · Proj ${projectedScore}` : ''}
                {target !== null ? ` · Need ${Math.max(0, target + 1 - currentScore.runs)}${totalBalls !== Infinity ? ` (${totalBalls - currentScore.balls} b)` : ''}` : ''}
              </p>

              {/* This over */}
              {overPips.length > 0 && (
                <div className="mono-over-strip" aria-label="This over">
                  <span className="mono-over-label">Over</span>
                  {overPips.map((p, i) => (
                    <span key={`${i}-${p.label}`} className={`mono-over-pip mono-over-pip-${p.kind}`}>{p.label}</span>
                  ))}
                </div>
              )}

              {/* Status chips (compact, not stacked banners) */}
              {(powerplay || isLastMan || freeHit) && (
                <div className="mono-cricket-chips">
                  {powerplay && <span className="mono-cricket-chip mono-cricket-chip-accent">{powerplay.label}</span>}
                  {isLastMan && <span className="mono-cricket-chip mono-cricket-chip-warn">Last man</span>}
                  {freeHit && <span className="mono-cricket-chip mono-cricket-chip-warn">Free hit · run out only</span>}
                </div>
              )}
            </div>

            {/* Other team */}
            <div className="mono-quick-other-score" style={{ textAlign: 'center', padding: '6px 12px' }}>
              <p className="text-xs font-mono" style={{ color: 'var(--se-color-ink-muted)', margin: 0 }}>
                {otherName} {otherScore.runs}/{otherScore.wickets} ({otherOversDisplay})
              </p>
            </div>

            {/* Line-divided keypad — flat cells separated by hairlines, common runs largest. */}
            <div className="mono-cricket-keypad">
              <div className="mono-cricket-keys">
                {CRICKET_RUN_VALUES.filter((v) => v !== 5).map((r) => (
                  <button
                    key={r}
                    onClick={() => addRuns(r)}
                    className={`mono-cricket-key${r === 4 ? ' mono-cricket-key-four' : r === 6 ? ' mono-cricket-key-six' : ''}`}
                    style={{ touchAction: 'manipulation' }}
                    aria-label={r === 4 ? 'Four runs' : r === 6 ? 'Six runs' : `${r} run${r === 1 ? '' : 's'}`}
                  >
                    <span>{r}</span>
                    {(r === 4 || r === 6) && <small>{r === 4 ? 'FOUR' : 'SIX'}</small>}
                  </button>
                ))}
              </div>

              <div className="mono-cricket-keys mono-cricket-keys-sec">
                {CRICKET_RUN_VALUES.filter((v) => v === 5).map((r) => (
                  <button key={`run-${r}`} onClick={() => addRuns(r)} className="mono-cricket-key mono-cricket-key-sec" style={{ touchAction: 'manipulation' }} aria-label={`${r} runs`}>{r}</button>
                ))}
                {[
                  { type: 'wide', label: 'WD' },
                  { type: 'noBall', label: 'NB' },
                  { type: 'bye', label: 'BYE' },
                  { type: 'legBye', label: 'LB' },
                ].map((ex) => (
                  <button key={ex.type} onClick={() => addExtra(ex.type)} className="mono-cricket-key mono-cricket-key-sec" style={{ touchAction: 'manipulation' }}>
                    {ex.label}
                  </button>
                ))}
              </div>

              <div className="mono-cricket-out-line-row">
                <button onClick={addWicket} className="mono-cricket-out-line" style={{ touchAction: 'manipulation' }}>
                  {freeHit ? 'Run Out Only' : 'OUT'}
                </button>
                <button
                  type="button"
                  onClick={undoCricketAction}
                  disabled={cricketHistory.length === 0}
                  className="mono-cricket-undo-line"
                  aria-label="Undo last action"
                  title="Undo last action"
                  style={{ touchAction: 'manipulation' }}
                >
                  <UndoIcon />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Side swap helpers — visual left/right, data stays the same
    const leftTeam = sidesSwapped ? 2 : 1;
    const rightTeam = sidesSwapped ? 1 : 2;
    const leftName = sidesSwapped ? team2Name : team1Name;
    const rightName = sidesSwapped ? team1Name : team2Name;
    // Accent by state: the team ahead is green; a tie shows both teams brown;
    // a trailing team is plain ink (black).
    const teamAccent = (mine, other) =>
      mine > other ? 'var(--primary)' : mine === other ? 'var(--se-color-warning)' : 'var(--se-color-ink)';

    // Goals-based scoring
    if (isGoals) {
      const leftScore = sidesSwapped ? gScore2 : gScore1;
      const rightScore = sidesSwapped ? gScore1 : gScore2;

      const goalHalves = [
        { side: 'left', name: leftName, score: leftScore, team: leftTeam, accent: teamAccent(leftScore, rightScore), leading: leftScore > rightScore },
        { side: 'right', name: rightName, score: rightScore, team: rightTeam, accent: teamAccent(rightScore, leftScore), leading: rightScore > leftScore },
      ];
      return (
        <div className="mono-scorer-screen mono-arena-screen">
          <div className="mono-scorer-shell">
            <h1 className="sr-only">{quickMatchScoringHeading}</h1>
            {endMatchDialog}
            {discardDialog}
            <ScoringNotice message={saveWarning} />
            <ScoringStatusStrip lastAction={lastAction} />
            {/* Top spine */}
            <div className="mono-scorer-topbar">
              <span className="text-sm font-swiss" style={{ color: 'var(--se-color-ink-muted)' }}>{sportConfig?.name || 'Match'}</span>
              <span className="text-sm font-mono" style={{ color: timerColor, fontWeight: 700 }}>
                {isTimeUp ? "Time's up!" : timerDisplay}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className="mono-badge mono-badge-live">{isPointsMode ? `First to ${format.target}` : 'Live'}</span>
              </span>
            </div>

            {/* Live broadcast control, held in a fixed-height slot so the score
                doesn't jump when the bar hydrates from null -> control. Gated on
                cloudAuthAvailable so offline builds (bar always null) don't reserve
                a permanent empty gap. */}
            {cloudAuthAvailable && (
              <div className="mono-live-slot">
                <LiveBroadcastBar
                  broadcast={live}
                  descriptor={liveDescriptor}
                  enabled={liveEnabled}
                  onEnableChange={setLiveEnabled}
                />
              </div>
            )}

            {/* Arena: two full-bleed halves; whole half = +1 */}
            <div className="mono-arena-grid">
              {goalHalves.map((h) => (
                <div className="mono-arena-col" key={h.side}>
                  {hasQuickButtons ? (
                    // Quick buttons below own scoring; the half is a pure score
                    // display. Render a non-interactive element (NOT a disabled
                    // button, which drops out of the a11y tree) so screen readers
                    // still announce the team + score.
                    <div
                      className="mono-arena-half mono-arena-half-display"
                      data-leading={h.leading ? 'true' : 'false'}
                      style={{ '--score-accent': h.accent }}
                      aria-label={`${h.name}: ${h.score}`}
                    >
                      <span className="mono-arena-overline" style={{ color: h.accent }}>{h.name}</span>
                      <span className="mono-arena-num mono-score" style={{ color: h.accent }}>{h.score}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="mono-arena-half"
                      data-leading={h.leading ? 'true' : 'false'}
                      onClick={() => addGoal(h.team)}
                      disabled={scoringLocked}
                      style={{ '--score-accent': h.accent, touchAction: 'manipulation' }}
                      aria-label={`Add 1 to ${h.name}`}
                    >
                      <span className="mono-arena-overline" style={{ color: h.accent }}>{h.name}</span>
                      <span className="mono-arena-num mono-score" style={{ color: h.accent }}>{h.score}</span>
                      <span className="mono-arena-hint">Tap +1</span>
                    </button>
                  )}
                  {hasQuickButtons && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                      {quickButtons.map((btn) => (
                        <button key={`${h.side}-${btn.label}`} onClick={() => addGoal(h.team, btn.value)} disabled={scoringLocked} className="mono-btn font-mono" style={{ padding: '10px 14px', fontSize: '0.8125rem', fontWeight: 800, touchAction: 'manipulation' }}>
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
                    <CorrectionControls teamName={h.name} onMinus={() => adjustGoalScore(h.team, -1)} />
                  </div>
                </div>
              ))}
            </div>

            <ThumbActionBar
              canUndo={gScoreHistory.length > 0}
              onUndo={undoGoal}
              onSwap={handleSideSwap}
              onDiscard={requestDiscardQuickMatch}
              onEnd={requestEndMatch}
            />
          </div>
        </div>
      );
    }

    // Sets scoring (volleyball, badminton, etc.)
    const leftSetsWon = sets.filter(s => s.completed && (sidesSwapped ? s.score2 > s.score1 : s.score1 > s.score2)).length;
    const rightSetsWon = sets.filter(s => s.completed && (sidesSwapped ? s.score1 > s.score2 : s.score2 > s.score1)).length;
    const rawLeftSetScore = format.type === 'best-of'
      ? (sidesSwapped ? sets[currentSet]?.score2 || 0 : sets[currentSet]?.score1 || 0)
      : (sidesSwapped ? vScore2 : vScore1);
    const rawRightSetScore = format.type === 'best-of'
      ? (sidesSwapped ? sets[currentSet]?.score1 || 0 : sets[currentSet]?.score2 || 0)
      : (sidesSwapped ? vScore1 : vScore2);
    const leftSetScore = rawLeftSetScore;
    const rightSetScore = rawRightSetScore;
    const setHalves = [
      { side: 'left', name: leftName, score: leftSetScore, team: leftTeam, accent: teamAccent(leftSetScore, rightSetScore), leading: leftSetScore > rightSetScore, serving: tracksPointWinnerServe && servingTeam === leftTeam },
      { side: 'right', name: rightName, score: rightSetScore, team: rightTeam, accent: teamAccent(rightSetScore, leftSetScore), leading: rightSetScore > leftSetScore, serving: tracksPointWinnerServe && servingTeam === rightTeam },
    ];
    // Derive the win-by margin from the sport config / customization (the same
    // source completeSetIfNeeded uses) instead of hardcoding "2", so the displayed
    // rule matches the actual completion rule for sports that win by 1.
    const { winBy: setsWinBy } = getSetWinRule({ format, sportConfig, currentSet });
    const setsRule = format.type === 'best-of'
      ? `${format.points || 25} pts · win by ${setsWinBy}`
      : `${format.target} pts · win by ${setsWinBy}`;

    return (
      <div className="mono-scorer-screen mono-arena-screen">
        <div className="mono-scorer-shell">
          <h1 className="sr-only">{quickMatchScoringHeading}</h1>
          {endMatchDialog}
          {discardDialog}
          <ScoringNotice message={saveWarning} />
          <ScoringStatusStrip lastAction={lastAction} />
          {/* Top spine */}
          <div className="mono-scorer-topbar">
            <span className="text-sm font-swiss" style={{ color: 'var(--se-color-ink-muted)' }}>{sportConfig?.name || 'Match'}</span>
            <span className="text-sm font-mono" style={{ color: 'var(--se-color-ink-muted)', fontWeight: 700 }}>{timer.formatted}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className="mono-badge mono-badge-live">
                {format.type === 'best-of' ? `Set ${currentSet + 1} of ${format.sets}` : `First to ${format.target}`}
              </span>
            </span>
          </div>

          {/* Live broadcast control, held in a fixed-height slot so the score
              doesn't jump when the bar hydrates from null -> control. Gated on
              cloudAuthAvailable so offline builds don't reserve a permanent gap. */}
          {cloudAuthAvailable && (
            <div className="mono-live-slot">
              <LiveBroadcastBar
                broadcast={live}
                descriptor={liveDescriptor}
                enabled={liveEnabled}
                onEnableChange={setLiveEnabled}
              />
            </div>
          )}

          {/* Seam: sets-won tally + rule */}
          <div className="mono-arena-seam">
            {format.type === 'best-of' && (
              <span><b>{leftSetsWon}</b> &ndash; <b>{rightSetsWon}</b> sets</span>
            )}
            <span className="mono-arena-seam-rule">{setsRule}</span>
          </div>

          {/* Arena: two full-bleed halves; whole half = +1 point */}
          <div className="mono-arena-grid">
            {setHalves.map((h) => (
              <div className="mono-arena-col" key={h.side}>
                <button
                  type="button"
                  className="mono-arena-half"
                  data-leading={h.leading ? 'true' : 'false'}
                  onClick={() => addPoint(h.team)}
                  style={{ '--score-accent': h.accent, touchAction: 'manipulation' }}
                  aria-label={`Add point for ${h.name}`}
                >
                  <span className="mono-arena-overline" style={{ color: h.accent }}>
                    {h.serving ? '● ' : ''}{h.name}
                  </span>
                  <span className="mono-arena-num mono-score" style={{ color: h.accent }}>{h.score}</span>
                  <span className="mono-arena-hint">Tap +1</span>
                </button>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
                  <CorrectionControls teamName={h.name} onMinus={() => adjustSetScore(h.team, -1)} />
                </div>
              </div>
            ))}
          </div>

          <ThumbActionBar
            canUndo={vScoreHistory.length > 0}
            onUndo={undoPoint}
            onSwap={handleSideSwap}
            onDiscard={requestDiscardQuickMatch}
            onEnd={requestEndMatch}
          />
        </div>
      </div>
    );
  }

  // === RESULT PHASE ===
  const isDraw = result?.winner === 'Draw';
  const isTie = result?.winner === 'Tie';
  const isNoWinner = isDraw || isTie;
  const resultSetSummary = getResultSetSummary(result);

  const formatElapsed = (secs) => {
    if (!secs) return null;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`min-h-screen px-6 py-10 mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>
      <div className="max-w-2xl mx-auto">
        {saveWarning && (
          <div className="mono-alert mono-alert-danger mb-4">
            {saveWarning}
          </div>
        )}
        {result && !saveWarning && (
          <div className="mono-alert mono-alert-success mb-4">
            Match saved to History on this device.
          </div>
        )}
        {isAuthenticated && syncState !== 'idle' && (
          <div
            className={`mono-alert mb-4 ${syncState === 'failed' ? 'mono-alert-danger' : syncState === 'synced' ? 'mono-alert-success' : 'mono-alert-info'}`}
            style={{
              borderColor: syncState === 'failed' ? 'var(--destructive)' : syncState === 'synced' ? 'var(--primary)' : 'var(--primary)',
              color: syncState === 'failed' ? 'var(--destructive)' : syncState === 'synced' ? 'var(--se-color-action-strong)' : 'var(--primary)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm" style={{ margin: 0 }}>
                {syncState === 'syncing' && 'Syncing this match to your profile...'}
                {syncState === 'synced' && 'Synced to your profile.'}
                {syncState === 'failed' && (syncError || 'Could not sync this match to your profile.')}
              </p>
              {syncState === 'failed' && (
                <button
                  onClick={retryResultSync}
                  className="mono-btn"
                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}
        <div className="text-center mb-10" style={{ paddingTop: '40px' }}>
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--se-color-ink-muted)' }}>
            Match Result
          </p>

          {isNoWinner ? (
            <h1 className="text-2xl font-bold" style={{ color: 'var(--se-color-ink)' }}>
              {isDraw ? 'Match Drawn' : 'Match Tied'}
            </h1>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--se-color-ink)' }}>
                {result.winner} Won
              </h1>
              {isCricket && result.team1Score && result.team2Score && (
                <p className="text-sm" style={{ color: 'var(--se-color-ink-muted)' }}>
                  by {Math.abs(result.team1Score.runs - result.team2Score.runs)} runs
                </p>
              )}
            </>
          )}

          {result?.elapsedSeconds > 0 && (
            <p className="text-xs font-mono mt-3" style={{ color: 'var(--se-color-ink-muted)' }}>
              Duration: {formatElapsed(result.elapsedSeconds)}
            </p>
          )}
        </div>

        {shareStatus && (
          <div className="mono-alert mono-alert-info mb-4">
            {shareStatus}
          </div>
        )}

        {/* Scorecard */}
        <div className="mono-brutal-panel mb-8" style={{ padding: '20px 24px' }}>
          {isCricket && result.team1Score ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: result.winner === result.team1 ? 'var(--se-color-ink)' : 'var(--se-color-ink-muted)' }}>
                  {result.team1}
                </span>
                <span className="font-mono font-bold" style={{ color: result.winner === result.team1 ? 'var(--se-color-ink)' : 'var(--se-color-ink-muted)' }}>
                  {result.team1Score.runs}/{result.team1Score.wickets} ({ballsToOvers(result.team1Score.balls)} ov)
                </span>
              </div>
              <hr className="mono-divider" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: result.winner === result.team2 ? 'var(--se-color-ink)' : 'var(--se-color-ink-muted)' }}>
                  {result.team2}
                </span>
                <span className="font-mono font-bold" style={{ color: result.winner === result.team2 ? 'var(--se-color-ink)' : 'var(--se-color-ink-muted)' }}>
                  {result.team2Score.runs}/{result.team2Score.wickets} ({ballsToOvers(result.team2Score.balls)} ov)
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: !isNoWinner && result.winner === result.team1 ? 'var(--se-color-ink)' : 'var(--se-color-ink-muted)' }}>
                {result.team1}
              </span>
              <span className="text-2xl font-bold font-mono mono-score" style={{ color: 'var(--se-color-ink)' }}>
                {result.score1} - {result.score2}
              </span>
              <span className="text-sm font-medium" style={{ color: !isNoWinner && result.winner === result.team2 ? 'var(--se-color-ink)' : 'var(--se-color-ink-muted)' }}>
                {result.team2}
              </span>
            </div>
          )}
        </div>

        {resultSetSummary && (
          <div className="mono-soft-panel mb-8" style={{ padding: '18px 20px' }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--se-color-ink-muted)', margin: 0 }}>
                Set breakdown
              </p>
              <span className="text-xs font-mono" style={{ color: 'var(--se-color-ink)' }}>
                {resultSetSummary.text}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {resultSetSummary.rows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3"
                  style={{ minHeight: 32 }}
                >
                  <span className="text-xs" style={{ color: '#666' }}>{row.label}</span>
                  <span className="font-mono font-semibold" style={{ color: 'var(--se-color-ink)' }}>
                    {row.score1} - {row.score2}
                  </span>
                  <span className="text-xs text-right" style={{ color: '#666', minWidth: 88 }}>
                    {row.winner || 'Level'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))' }}
        >
          <button onClick={() => resetMatchState('scoring')} className="mono-btn-primary" style={{ minHeight: 48, padding: '12px' }}>
            Rematch
          </button>
          <button onClick={shareResult} className="mono-btn" style={{ minHeight: 48, padding: '12px' }}>
            Share
          </button>
          <button onClick={() => navigate('/history')} className="mono-btn" style={{ minHeight: 48, padding: '12px' }}>
            View History
          </button>
          <button onClick={() => navigate('/statistics')} className="mono-btn" style={{ minHeight: 48, padding: '12px' }}>
            See Stats
          </button>
          <button
            onClick={() => resetMatchState('setup', { resetTeams: true })}
            className="mono-btn"
            style={{ minHeight: 48, padding: '12px' }}
          >
            New Match
          </button>
          <button onClick={() => navigate('/app')} className="mono-btn" style={{ minHeight: 48, padding: '12px' }}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
}















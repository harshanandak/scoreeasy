import { useScoringProgress } from './scoring/scoringProgressContext';
import { isCompletedMatch, useMatchCompletion } from '../../hooks/useMatchCompletion';
import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { OVERS_PRESETS, CRICKET_FORMATS, buildCricketFormat, ballsToOvers, calculateRunRate, getPowerplayPhase, getCricketFormat } from '../../utils/cricketCalculations';
import BackArrow from './components/BackArrow';
import { validateSingleSetScore } from '../../utils/volleyballCalculations';
import { clearData, saveData, loadData, loadQuickMatch, saveQuickMatch, isStaleQuickMatchDraft } from '../../utils/storage';
import { getSportById, isTeamColourSport } from '../../models/sportRegistry';
import { DEFAULT_TEAM_COLOURS, normaliseHex } from '../../lib/teamColour';
import TeamColourPicker from './TeamColourPicker';
import { useTeamColours } from './scoring/useTeamColours';
import TeamSetsBoard from './scoring/TeamSetsBoard';
import TeamGoalsBoard from './scoring/TeamGoalsBoard';
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
import { buildResultShareText, getShareStatusText } from '../../utils/quickMatchResult';
import KitFinish from './kit/KitFinish';
import { finishFromQuickResult, formatDuration } from './kit/finishModel';
import { getSetupStartLabel } from '../../utils/startActions';
import { KitWash, GoArrow } from './kit/KitParts';
import { KitSegmented, KitStepper, MatchupPreview } from './kit/KitSetupParts';
import {
  applyFormatChoice,
  applyGoalsDetail,
  formatChoices,
  goalsDetail,
  selectedFormatChoice,
  setPointPresets,
  setupRulesLine,
} from './kit/setupFormats';
import { sportIdentity, sportIdentityVars } from '../../lib/sportIdentity';
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
  // 'danger' when confirming destroys data (Discard): the confirm button takes the danger fill.
  tone = 'primary',
  // Optional: a board-specific skin on the backdrop, and the score the action applies to.
  className = '',
  summary = null,
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
      className={className ? `app-confirm-backdrop ${className}` : 'app-confirm-backdrop'}
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
        {summary}
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
            className={`app-confirm-primary${tone === 'danger' ? ' app-confirm-danger' : ''}`}
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

export default function MonoQuickMatch() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sport } = useParams();
  const [searchParams] = useSearchParams();
  const preselectedFormat = searchParams.get('format');
  const resultMatchId = searchParams.get('result');
  const sportConfig = getSportById(sport);
  const engine = sportConfig?.engine || 'goals';
  const isCricket = engine === 'custom-cricket';
  const isTennis = sport === 'tennis';
  const isGoals = engine === 'goals';

  const timer = useTimer();
  const startedAtRef = useRef(null);

  const [phase, setPhase] = useState('setup'); // setup | scoring | result
  const [restoredScoringStarted, setRestoredScoringStarted] = useState(false);
  const visible = true; // always visible; no fade-in needed for quick match
  // Setup is one screen; the rules editor (cricket Gully/Custom, sets points) opens over it.
  const [rulesOpen, setRulesOpen] = useState(false);
  const [sidesSwapped, setSidesSwapped] = useState(false); // flip left/right teams for referee scoring
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
  // Direction E: each team's colour owns its half of the board, for sports that opt in.
  // A Home Rematch hands over the saved pair; only plain hex survives, else the default pair.
  const wizardColours = Array.isArray(location.state?.colours) ? location.state.colours : null;
  const [team1Color, setTeam1Color] = useState(() => normaliseHex(wizardColours?.[0]) ?? DEFAULT_TEAM_COLOURS.a);
  const [team2Color, setTeam2Color] = useState(() => normaliseHex(wizardColours?.[1]) ?? DEFAULT_TEAM_COLOURS.b);
  const teamColourOn = isTeamColourSport(sport);
  const teamColourStyle = useTeamColours(team1Color, team2Color, sport);
  const [saveWarning, setSaveWarning] = useState('');
  const completion = useMatchCompletion();
  const cricketScoresRef = useRef(null);

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

  const hasRecordedScore = vScore1 !== 0 || vScore2 !== 0 || gScore1 !== 0 || gScore2 !== 0 ||
    sets.some(set => set.score1 > 0 || set.score2 > 0) ||
    Object.values(scores).some(score => score.balls > 0 || score.runs > 0 || score.wickets > 0);
  const { scoringStarted, resetScoringStarted } = useScoringProgress(
    phase !== 'setup' && hasRecordedScore, phase === 'setup', restoredScoringStarted, sport,
  );

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
    const hydrationKey = `${sport}:${resultMatchId || ''}`;
    if (draftHydratedSportRef.current === hydrationKey) return;
    const previousSport = draftHydratedSportRef.current;
    draftHydratedSportRef.current = hydrationKey;
    restoredDraftRef.current = false;
    scoringSportRef.current = null;
    setRestoredScoringStarted(false);

    if (resultMatchId) {
      const saved = loadQuickMatch(resultMatchId);
      if (!isCompletedMatch(saved) || saved.sport !== sport) {
        navigate('/history', { replace: true });
        return;
      }
      completion.hydrate(saved, `${sport}:quick:${resultMatchId}`);
      restoredDraftRef.current = true;
      setTeam1Name(saved.team1Name || saved.team1 || 'Team A');
      setTeam2Name(saved.team2Name || saved.team2 || 'Team B');
      setTeam1Color(normaliseHex(saved.team1Color) ?? DEFAULT_TEAM_COLOURS.a);
      setTeam2Color(normaliseHex(saved.team2Color) ?? DEFAULT_TEAM_COLOURS.b);
      if (saved.format) setFormat(saved.format);
      if (isCricket) {
        const preset = CRICKET_FORMATS.find(f => f.id === saved.format?.preset)
          || CRICKET_FORMATS.find(f => f.id === (saved.format?.totalInnings === 4 ? 'test' : 'custom'));
        setCricketPreset(preset.id);
        setFormatMode(preset.customizable ? 'custom' : 'standard');
      }
      setResult(saved);
      setPhase('result');
      return;
    }

    const draft = loadData(quickMatchDraftKey, null);
    const saved = draft?.quickMatchId ? loadQuickMatch(draft.quickMatchId) : null;
    if (completion.hydrate(isCompletedMatch(saved) ? saved : draft, `${sport}:quick:${draft?.quickMatchId || 'setup'}`, () => {
      clearData(quickMatchDraftKey);
      navigate('/history', { replace: true });
    })) return;
    if (isStaleQuickMatchDraft(draft)) {
      clearData(quickMatchDraftKey);
    }

    if (!draft || isStaleQuickMatchDraft(draft) || draft.sport !== sport || draft.phase !== 'scoring') {
      if (previousSport && phase !== 'setup') {
        setPhase('setup');
        setResult(null);
        timer.pause();
        setSaveWarning('');
      }
      return;
    }

    restoredDraftRef.current = true;
    setRestoredScoringStarted(draft.scoringStarted === true);
    scoringSportRef.current = sport;
    setTeam1Name(draft.team1Name || '');
    setTeam2Name(draft.team2Name || '');
    // Drafts from before team colours (or with a tampered value) fall back to red v blue.
    setTeam1Color(normaliseHex(draft.team1Color) ?? DEFAULT_TEAM_COLOURS.a);
    setTeam2Color(normaliseHex(draft.team2Color) ?? DEFAULT_TEAM_COLOURS.b);
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
  }, [quickMatchDraftKey, sport, resultMatchId]);

  useEffect(() => {
    // A staged winner is still a draft until its terminal save succeeds.
    if (completion.committed || phase !== 'scoring') return;
    if (scoringSportRef.current !== sport) return;

    saveData(quickMatchDraftKey, {
      phase,
      sport,
      scoringStarted,
      team1Name,
      team2Name,
      team1Color,
      team2Color,
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
  }, [battingTeam, cricketHistory, currentSet, format, freeHit, gScore1, gScore2, gScoreHistory, innings, lastAction, phase, quickMatchDraftKey, scores, scoringStarted, servingTeam, sets, sport, team1Color, team1Name, team2Color, team2Name, trialBallUsed, vScore1, vScore2, vScoreHistory]);

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
    setRulesOpen(false);
  }, [isCricket, preselectedFormat, sport]);

  // Reset defaults when leaving cricket on the same mounted quick-match route.
  useEffect(() => {
    if (restoredDraftRef.current) return;
    if (isCricket || !sport) return;

    setFormatMode('standard');
    setRulesOpen(false);
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
    teamA: teamColourOn ? { name: team1Name, color: team1Color } : { name: team1Name },
    teamB: teamColourOn ? { name: team2Name, color: team2Color } : { name: team2Name },
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

  const finalizeMatch = (entry) => completion.complete(() => {
    void endMatchImpact();

    const matchId = liveMatchIdRef.current || entry.id;
    const clientMatchId = entry.clientMatchId || buildQuickMatchClientId(sport, matchId);
    const nextResult = {
      ...entry,
      id: matchId,
      status: 'completed',
      clientMatchId,
      sync: createSyncMeta(isAuthenticated && user ? 'syncing' : 'idle'),
      // The picked team colours stay with the local record so Home can show the last match in
      // them. Local only: normalizeMatchForConvex does not send them.
      ...(teamColourOn ? { team1Color, team2Color } : {}),
    };

    if (!persistQuickMatch(nextResult)) return false;
    setShowEndConfirm(false);
    setResult(nextResult);
    clearData(quickMatchDraftKey);
    setPhase('result');
    syncCompletedMatch(nextResult);
    return true;
  });

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
    // Tear down any in-flight live broadcast so a discarded match doesn't leave an
    // orphaned live session streaming to spectators.
    liveRef.current?.reset?.();
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
        team1Color, team2Color,
        format,
        status: 'in-progress',
        innings: [],
        score1: 0,
        score2: 0,
        date: nowIso,
        createdAt: nowIso,
      };
      if (!persistQuickMatch(match)) return;
      setResult(null);
      resetSync();
      navigate(`/${sport}/quick/test-match/${matchId}`);
      return true;
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
      draft.team1Color = team1Color;
      draft.team2Color = team2Color;
      if (!saveData(getTennisQuickDraftKey(matchId), draft)) {
        setSaveWarning('Save failed - storage may be full. Export your data.');
        return;
      }
      setResult(null);
      resetSync();
      navigate(`/${sport}/quick/live/${matchId}`);
      return true;
    }

    // Mint the stable live-broadcast match id (R2) right before scoring begins —
    // tennis/test-cricket branches above navigate away and never reach this line.
    setResult(null);
    resetSync();
    liveMatchIdRef.current = Date.now();
    setPhase('scoring');
  };

  cricketScoresRef.current = scores;
  const getCricketTransition = (candidate) => {
    const key = battingTeam === 1 ? 'team1' : 'team2';
    const team = candidate[key];
    if (!team) return null;
    const inningsOver = team.balls >= totalBalls || team.wickets >= maxWickets;
    const chaseTarget = battingTeam === 2 ? candidate.team1.runs : candidate.team2.runs;
    if (innings === 1 && inningsOver) return 'break';
    if (innings === 2 && (inningsOver || team.runs > chaseTarget)) return 'complete';
    return null;
  };

  const commitCricketScores = (update) => {
    if (completion.locked) return;
    // Same-turn actions must share the latest score before React renders it.
    const next = update(cricketScoresRef.current);
    cricketScoresRef.current = next;
    if (getCricketTransition(next) === 'complete') completion.lock();
    setScores(next);
  };

  // Cricket: Add runs
  const addRuns = (runs) => {
    if (completion.locked) return;
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

    commitCricketScores(prev => ({
      ...prev,
      [key]: { ...prev[key], runs: prev[key].runs + runs, balls: prev[key].balls + 1 },
    }));
  };

  const addWicket = () => {
    if (completion.locked) return;
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

    commitCricketScores(prev => {
      const team = { ...prev[key], wickets: prev[key].wickets + 1, balls: prev[key].balls + 1 };
      if (team.wickets >= maxWickets) team.allOut = true;
      return { ...prev, [key]: team };
    });
  };

  const addExtra = (type) => {
    if (completion.locked) return;
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
    commitCricketScores(prev => ({
      ...prev,
      [key]: { ...prev[key], runs: prev[key].runs + 1, balls: prev[key].balls + (countsAsBall ? 1 : 0) },
    }));

    // No ball triggers free hit if format supports it
    if (type === 'noBall' && format.freeHit) {
      setFreeHit(true);
    }
  };

  const undoCricketAction = () => {
    if (completion.locked) return;
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

    commitCricketScores(prev => {
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
    const transition = getCricketTransition(scores);
    if (transition === 'break') {
      setShowInningsBreak(true);
      setInnings(2);
      setBattingTeam(battingTeam === 1 ? 2 : 1);
    } else if (transition === 'complete') {
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
    if (completion.locked) return;
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
    if (completion.locked) return;
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
    if (completion.locked) return;
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
  const addGoal = (team, value = 1, actionLabel) => {
    if (completion.locked) return;
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
    setLastAction(teamColourOn && actionLabel
      ? `${getTeamLabel(team)} · ${actionLabel}`
      : `${getTeamLabel(team)} +${value} ${scoringUnit}${value === 1 ? '' : 's'}`);

    // Auto-end in points mode
    if (isPointsMode && format.target) {
      if (newS1 >= format.target || newS2 >= format.target) {
        finalizeGoalScore(newS1, newS2);
      }
    }
  };

  const undoGoal = () => {
    if (completion.locked) return;
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
    if (completion.locked) return;
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
    if (completion.locked) return;
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
    resetScoringStarted();
    setRestoredScoringStarted(false);
    completion.reset();
    if (resultMatchId) {
      // Leave the saved-result address before creating any fresh scoring draft.
      draftHydratedSportRef.current = `${sport}:`;
      navigate(`/${sport}/quick`, { replace: true });
    }
    restoredDraftRef.current = false;
    setSaveWarning('');
    setPhase(nextPhase);
    if (options.resetTeams) {
      setTeam1Name('Team A');
      setTeam2Name('Team B');
      setTeam1Color(DEFAULT_TEAM_COLOURS.a);
      setTeam2Color(DEFAULT_TEAM_COLOURS.b);
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
  // Kit S2 (plan 2026-10-22 §9 S2): one compact screen. The matchup preview, both teams (name +
  // colour), the format as one segmented control and its rules line, then the one Go. Cricket's
  // Gully/Custom and the sets sports' points live one tap away in the rules editor.
  const cricketHasRules = isCricket && (cricketPreset === 'gully' || cricketPreset === 'custom');
  const setPoints = engine === 'sets' && !isTennis ? setPointPresets(sportConfig) : [];
  const hasRulesEditor = cricketHasRules || setPoints.length > 0;
  const selectedCricketFormat = isCricket
    ? CRICKET_FORMATS.find(f => f.id === cricketPreset)
    : null;
  const rulesLine = setupRulesLine(sportConfig, format);
  const { kind: formatKind, choices: formatOptions } = formatChoices(sportConfig);
  const selectedFormat = selectedFormatChoice(sportConfig, format, cricketPreset);
  const goalsRow = goalsDetail(sportConfig, format);
  const teamNamesReady = Boolean(team1Name.trim() && team2Name.trim());
  const showRosterSetup = showTeam1Roster || showTeam2Roster;
  const playerCount = team1Players.length + team2Players.length;
  const startButtonLabel = getSetupStartLabel(sportConfig);
  const sportName = sportConfig?.name || 'Quick match';
  const sportVars = sportIdentityVars(sport);
  const sportTint = sportIdentity(sport)?.tint;
  const toggleRosterSetup = () => {
    const nextState = !showRosterSetup;
    setShowTeam1Roster(nextState);
    setShowTeam2Roster(nextState);
  };
  const quickMatchScoringHeading = `${sportConfig?.name || sport || 'Sport'} quick match`;
  const chooseCricketFormat = (presetId) => {
    const preset = CRICKET_FORMATS.find(f => f.id === presetId);
    if (!preset) return;
    setCricketPreset(preset.id);
    setFormatMode(preset.customizable ? 'custom' : 'standard');
    setFormat(buildCricketFormat(preset.id));
    setShowCustomOvers(false);
    setCustomOvers('');
  };
  const chooseFormat = (choiceId) => {
    if (formatKind === 'cricket') {
      chooseCricketFormat(choiceId);
      return;
    }
    setFormat(prev => applyFormatChoice(sportConfig, choiceId, prev));
  };
  const handleSetupBack = () => {
    if (rulesOpen) {
      setRulesOpen(false);
      return;
    }
    const browserHistoryIndex = globalThis.history?.state?.idx;
    const hasPriorRoute = typeof browserHistoryIndex === 'number'
      ? browserHistoryIndex > 0
      : location.key !== 'default';
    if (hasPriorRoute) {
      navigate(-1);
      return;
    }
    navigate(`/play?sport=${sport}`, { replace: true });
  };

  const setupHeader = (title, subtitle, backLabel, aside = null) => (
    <div className="kit-setup-top">
      <button type="button" className="se-ctl kit-setup-back" onClick={handleSetupBack} aria-label={backLabel}>
        <BackArrow size={20} />
      </button>
      <span className="kit-setup-badge" aria-hidden="true" />
      <div className="kit-setup-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {aside}
    </div>
  );

  if (phase === 'setup' && rulesOpen && hasRulesEditor) {
    const players = format.players || 6;
    const maxPlayers = format.solo ? 10 : 11;
    const oversValue = showCustomOvers ? 'custom' : (format.overs === null ? 'none' : `ov-${format.overs}`);
    const chooseOvers = (id) => {
      if (id === 'custom') {
        setShowCustomOvers(true);
        setCustomOvers('');
        return;
      }
      setFormat(prev => ({ ...prev, overs: id === 'none' ? null : Number(id.slice(3)) }));
      setCustomOvers('');
      setShowCustomOvers(false);
    };
    const houseRules = [
      { key: 'lastManStands', label: 'Last man bats' },
      { key: 'trialBall', label: 'Trial ball' },
      { key: 'oneTipOneHand', label: 'One tip one hand' },
    ];
    const setsSingle = format.type !== 'best-of';
    return (
      <div className="kit-screen kit-setup" data-screen="setup-rules" style={sportVars}>
        <KitWash from={sportTint} to={sportTint} />
        {setupHeader('Match rules', isCricket ? selectedCricketFormat?.name : sportName, 'Return to match setup')}

        {isCricket && (
          <>
            {cricketPreset === 'custom' && (
              <div className="kit-rules-group">
                <p id="rules-scoring-label" className="kit-setup-label">Scoring format</p>
                <KitSegmented
                  labelledBy="rules-scoring-label"
                  options={[{ id: 'overs', label: 'By overs' }, { id: 'balls', label: 'By balls' }]}
                  value={format.trackOvers === false ? 'balls' : 'overs'}
                  onChange={(id) => setFormat(prev => (id === 'balls'
                    ? { ...prev, trackOvers: false, overs: null, powerplay: [] }
                    : { ...prev, trackOvers: true, maxBalls: null }))}
                />
              </div>
            )}

            {format.trackOvers !== false && (
              <div className="kit-rules-group">
                <p id="rules-overs-label" className="kit-setup-label">Overs</p>
                <KitSegmented
                  labelledBy="rules-overs-label"
                  options={[
                    { id: 'none', label: 'No limit' },
                    ...OVERS_PRESETS.map(p => ({ id: `ov-${p.value}`, label: String(p.value) })),
                    { id: 'custom', label: 'Custom' },
                  ]}
                  value={oversValue}
                  onChange={chooseOvers}
                />
                {showCustomOvers && (
                  <div className="kit-rules-custom">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      inputMode="numeric"
                      className="kit-setup-input"
                      aria-label="Custom overs (1 to 50)"
                      placeholder="1-50"
                      value={customOvers}
                      onChange={(e) => {
                        const v = Number.parseInt(e.target.value, 10);
                        setCustomOvers(e.target.value);
                        if (v >= 1 && v <= 50) setFormat(prev => ({ ...prev, overs: v }));
                      }}
                    />
                    <span className="kit-setup-hint">overs a side</span>
                  </div>
                )}
              </div>
            )}

            {cricketPreset === 'custom' && format.trackOvers === false && (
              <div className="kit-rules-group">
                <p id="rules-balls-label" className="kit-setup-label">Ball limit</p>
                <div className="kit-rules-custom">
                  <KitStepper
                    label="balls"
                    labelledBy="rules-balls-label"
                    value={format.maxBalls || '∞'}
                    onDecrease={() => setFormat(prev => ({ ...prev, maxBalls: Math.max(6, (prev.maxBalls || 30) - 6) }))}
                    onIncrease={() => setFormat(prev => ({ ...prev, maxBalls: (prev.maxBalls || 24) + 6 }))}
                  />
                  <button
                    type="button"
                    className="se-ctl"
                    aria-pressed={!format.maxBalls ? 'true' : 'false'}
                    onClick={() => setFormat(prev => ({ ...prev, maxBalls: null }))}
                  >
                    No limit
                  </button>
                </div>
                <p className="kit-setup-hint">No overs: just runs and balls</p>
              </div>
            )}

            <div className="kit-rules-group">
              <p id="rules-players-label" className="kit-setup-label">Players per side</p>
              <KitStepper
                label="players"
                labelledBy="rules-players-label"
                value={players}
                canDecrease={players > 2}
                canIncrease={players < maxPlayers}
                onDecrease={() => setFormat(prev => ({ ...prev, players: Math.max(2, (prev.players || 6) - 1) }))}
                onIncrease={() => setFormat(prev => ({ ...prev, players: Math.min(prev.solo ? 10 : 11, (prev.players || 6) + 1) }))}
              />
              <p className="kit-setup-hint">{players - 1} wickets to bowl a team out</p>
            </div>

            <div className="kit-rules-group">
              <p id="rules-type-label" className="kit-setup-label">Match type</p>
              <KitSegmented
                labelledBy="rules-type-label"
                options={[{ id: 'solo', label: 'Bat only' }, { id: 'both', label: 'Bat and bowl' }]}
                value={format.solo ? 'solo' : (format.solo === false ? 'both' : null)}
                onChange={(id) => setFormat(prev => (id === 'solo'
                  ? { ...prev, solo: true, players: Math.min(prev.players || 6, 10) }
                  : { ...prev, solo: false }))}
              />
              <p className="kit-setup-hint">{format.solo ? 'One team bats, the other bowls' : 'Both teams bat and bowl'}</p>
            </div>

            <div className="kit-rules-group">
              <p id="rules-innings-label" className="kit-setup-label">Innings</p>
              <KitSegmented
                labelledBy="rules-innings-label"
                options={[{ id: '1', label: '1 per side' }, { id: '2', label: '2 per side (Test)' }]}
                value={(format.totalInnings || 2) === 4 ? '2' : '1'}
                onChange={(id) => setFormat(prev => (id === '2'
                  ? { ...prev, totalInnings: 4, declaration: true, followOn: true }
                  : { ...prev, totalInnings: 2, declaration: false, followOn: false }))}
              />
            </div>

            {cricketPreset === 'gully' && (
              <div className="kit-rules-group">
                <p id="rules-house-label" className="kit-setup-label">House rules</p>
                <div className="kit-seg" role="group" aria-labelledby="rules-house-label" style={{ '--kit-seg-cols': 3 }}>
                  {houseRules.map(rule => (
                    <button
                      key={rule.key}
                      type="button"
                      aria-pressed={format[rule.key] ? 'true' : 'false'}
                      onClick={() => setFormat(prev => ({ ...prev, [rule.key]: !prev[rule.key] }))}
                    >
                      {rule.label}
                    </button>
                  ))}
                </div>
                <p className="kit-setup-hint">
                  {[
                    format.lastManStands && 'Last batter plays alone',
                    format.trialBall && 'First ball doesn’t count',
                    format.oneTipOneHand && 'One-bounce catch is out',
                  ].filter(Boolean).join(' · ') || 'Tap a rule to turn it on'}
                </p>
              </div>
            )}
          </>
        )}

        {!isCricket && setPoints.length > 0 && (
          <div className="kit-rules-group">
            <p id="rules-points-label" className="kit-setup-label">{setsSingle ? 'Points to win' : 'Points per set'}</p>
            <KitSegmented
              labelledBy="rules-points-label"
              options={setPoints.map(n => ({ id: `p-${n}`, label: String(n) }))}
              value={setsSingle ? `p-${format.target}` : `p-${format.points}`}
              onChange={(id) => {
                const n = Number(id.slice(2));
                setFormat(prev => (setsSingle ? { ...prev, target: n } : { ...prev, points: n }));
              }}
            />
          </div>
        )}

        <p className="kit-setup-rules">{rulesLine}</p>
        <button type="button" className="se-ctl kit-rules-done" onClick={() => setRulesOpen(false)}>
          Done
        </button>
      </div>
    );
  }

  if (phase === 'setup') {
    const teamFields = [
      {
        n: 1, letter: 'A', ref: team1Ref, name: team1Name, setName: setTeam1Name,
        show: showTeam1Suggestions, setShow: setShowTeam1Suggestions, loading: team1Loading,
        empty: team1Empty, results: sortedTeam1, query: debouncedTeam1, colour: team1Color, setColour: setTeam1Color,
      },
      {
        n: 2, letter: 'B', ref: team2Ref, name: team2Name, setName: setTeam2Name,
        show: showTeam2Suggestions, setShow: setShowTeam2Suggestions, loading: team2Loading,
        empty: team2Empty, results: sortedTeam2, query: debouncedTeam2, colour: team2Color, setColour: setTeam2Color,
      },
    ];
    return (
      <div className="kit-screen kit-setup" data-screen="setup" style={sportVars}>
        <KitWash from={sportTint} to={sportTint} />
        {setupHeader(sportName, 'Quick match', 'Go back', (
          <button
            type="button"
            className="kit-setup-link"
            onClick={() => navigate(`/${sport}/tournament`)}
            aria-label="Switch to tournament setup"
          >
            Tournament
          </button>
        ))}
        {saveWarning && (
          <div className="mono-alert mono-alert-danger mb-4" role="alert">
            {saveWarning}
          </div>
        )}

        <MatchupPreview nameA={team1Name} nameB={team2Name} coloured={teamColourOn} colourStyle={teamColourStyle} />

        {teamFields.map(t => (
          <div key={t.n} ref={t.ref} className="kit-setup-field">
            <label htmlFor={`quick-team-${t.n}`} className="kit-setup-label">
              Team {t.letter} name
            </label>
            <input
              id={`quick-team-${t.n}`}
              type="text"
              className="kit-setup-input"
              placeholder={`Team ${t.letter}`}
              value={t.name}
              onChange={e => { t.setName(e.target.value); t.setShow(e.target.value.length >= 2); }}
              onFocus={() => t.setShow(true)}
              maxLength={50}
              autoComplete="off"
            />
            {t.show && (t.loading || t.empty || t.results.length > 0) && (
              <div className="kit-setup-suggest">
                {t.loading && <p role="status">Searching teams…</p>}
                {t.empty && <p role="status">No saved teams match “{t.query}”.</p>}
                {t.results.map(r => (
                  <button
                    key={r._id}
                    type="button"
                    onClick={() => { t.setName(r.name); t.setShow(false); }}
                    onMouseDown={e => e.preventDefault()}
                  >
                    <span>{r.name}</span>
                    <small>{r.matchCount} match{r.matchCount !== 1 ? 'es' : ''}</small>
                  </button>
                ))}
              </div>
            )}
            {teamColourOn && (
              <TeamColourPicker label={`Team ${t.letter} colour`} value={t.colour} onChange={t.setColour} />
            )}
          </div>
        ))}

        <section className="kit-setup-field" aria-labelledby="setup-format-label">
          <h2 id="setup-format-label" className="kit-setup-label">Format</h2>
          <KitSegmented labelledBy="setup-format-label" options={formatOptions} value={selectedFormat} onChange={chooseFormat} />
          {goalsRow && (
            <div className="kit-rules-group" style={{ marginTop: 12 }}>
              <p id="setup-detail-label" className="kit-setup-label">{goalsRow.label}</p>
              <KitSegmented
                labelledBy="setup-detail-label"
                options={goalsRow.options}
                value={goalsRow.selected}
                onChange={(id) => setFormat(prev => applyGoalsDetail(prev, id))}
              />
            </div>
          )}
          <div className="kit-setup-rules-row">
            <p className="kit-setup-rules">{rulesLine}</p>
            {hasRulesEditor && (
              <button type="button" className="kit-setup-link" onClick={() => setRulesOpen(true)}>
                Edit rules
              </button>
            )}
          </div>
        </section>

        <div className="kit-setup-field">
          <button type="button" onClick={toggleRosterSetup} className="kit-setup-link" aria-expanded={showRosterSetup}>
            {showRosterSetup ? 'Hide players' : 'Add players'}
            {playerCount > 0 && !showRosterSetup && <span>&nbsp;({playerCount})</span>}
          </button>
          {showRosterSetup && (
            <div className="kit-setup-roster">
              {teamFields.map(t => (
                <div key={t.n}>
                  <h3>Team {t.letter} players</h3>
                  <PlayerSearchInput
                    players={t.n === 1 ? team1Players : team2Players}
                    onAdd={p => (t.n === 1 ? setTeam1Players : setTeam2Players)(prev => [...prev, p])}
                    onRemove={i => (t.n === 1 ? setTeam1Players : setTeam2Players)(prev => prev.filter((_, idx) => idx !== i))}
                    placeholder="Search @username or type name"
                  />
                </div>
              ))}
            </div>
          )}
          {showRefereeOption && (
            <label className="kit-setup-check">
              <input
                type="checkbox"
                checked={isRefereeing}
                onChange={e => setIsRefereeing(e.target.checked)}
              />
              <span>I&apos;m refereeing this match</span>
            </label>
          )}
        </div>

        <div className="kit-setup-cta">
          <button
            type="button"
            onClick={startMatch}
            className="se-go"
            aria-disabled={!teamNamesReady}
            aria-describedby={!teamNamesReady ? 'start-match-hint' : undefined}
          >
            {startButtonLabel}
            <GoArrow />
          </button>
          {!teamNamesReady && (
            <p id="start-match-hint" role="status" className="kit-setup-hint">
              Add both team names to start the match.
            </p>
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
  // `skin` lets a board restyle the dialogs (and show the score they act on) without forking them.
  const renderEndMatchDialog = (skin = {}) => (showEndConfirm ? (
    <ConfirmDialog {...skin} onCancel={cancelEndMatch} onConfirm={confirmEndMatch} />
  ) : null);
  const endMatchDialog = renderEndMatchDialog();

  const renderDiscardDialog = (skin = {}) => (showDiscardConfirm ? (
    <ConfirmDialog
      {...skin}
      idPrefix="discard-match"
      tone="danger"
      title="Discard match?"
      message="This will delete this in-progress match. This can't be undone."
      confirmLabel="Discard"
      cancelLabel="Keep scoring"
      onCancel={cancelDiscardQuickMatch}
      onConfirm={confirmDiscardQuickMatch}
    />
  ) : null);
  const discardDialog = renderDiscardDialog();

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
            {/* Cricket ends via EndMatchButton + keypad (no ThumbActionBar), so it
                has no Discard trigger — no discardDialog rendered here. */}
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

      if (teamColourOn) {
        const halves = [leftTeam, rightTeam].map((team) => ({
          key: team === 1 ? 'a' : 'b', team, name: getTeamLabel(team), score: team === 1 ? gScore1 : gScore2,
        }));
        const last = gScoreHistory.at(-1);
        const undoHint = last ? `back to ${halves.map(h => Math.max(0, h.score - (last.team === h.team ? last.value : 0))).join('–')}` : '';
        const boardScore = halves.map(h => h.score).join('–');
        const status = isTimeUp ? 'Full Time' : isPointsMode ? `First to ${format.target}` : '';
        const summary = <div className="sb-confirm-summary"><span>{sportConfig.name}{status ? ` · ${status}` : ''}</span><strong>{boardScore}</strong></div>;
        return <>
          <h1 className="sr-only">{quickMatchScoringHeading}</h1>
          {renderEndMatchDialog({ className: 'sb-confirm', summary })}
          {renderDiscardDialog({ className: 'sb-confirm', summary })}
          <TeamGoalsBoard
            sportConfig={sportConfig}
            title={`${team1Name} v ${team2Name}`}
            subtitle={`${isTimedMode ? `${timeLimit / 60} min match · ` : ''}${goalsDrawAllowed ? 'Draws allowed' : 'No draws'}`}
            colourStyle={teamColourStyle} halves={halves}
            clock={timerDisplay} clockLabel={isTimedMode ? 'Time remaining' : 'Time elapsed'}
            status={status} isTimeUp={isTimeUp} scoringLocked={scoringLocked}
            lastLine={lastAction ? `${lastAction} · ${boardScore}` : 'Choose a scoring action for either team'}
            momentTeam={last && lastAction === `${getTeamLabel(last.team)} · All Out (+2)` ? last.team : undefined}
            actionCount={gScoreHistory.length} canUndo={gScoreHistory.length > 0} undoHint={undoHint}
            isLive={Boolean(live?.isLive)} onScore={addGoal} onUndo={undoGoal}
            onSwap={handleSideSwap} onCorrect={(team) => adjustGoalScore(team, -1)}
            onFinish={requestEndMatch} onDiscard={requestDiscardQuickMatch}
            notice={<ScoringNotice message={saveWarning} />}
            live={cloudAuthAvailable ? <LiveBroadcastBar broadcast={live} descriptor={liveDescriptor} enabled={liveEnabled} onEnableChange={setLiveEnabled} /> : null}
          />
        </>;
      }

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
    // The target comes from the same rule too, so a deciding set reads e.g. "15 pts", not "25".
    const { target: setsTarget, winBy: setsWinBy } = getSetWinRule({ format, sportConfig, currentSet });
    const setsRule = format.type === 'best-of'
      ? `${setsTarget} pts · win by ${setsWinBy}`
      : `${format.target} pts · win by ${setsWinBy}`;

    if (teamColourOn) {
      // Direction E board (team colour). Same state and handlers as the classic screen below;
      // the board only renders them. Keys and band follow the team, not the side.
      const boardHalves = setHalves.map((h) => ({
        key: h.team === 1 ? 'a' : 'b',
        team: h.team,
        name: h.name,
        score: h.score,
        serving: Boolean(h.serving),
      }));
      // Every history entry snapshots the score BEFORE its action, so undo can say exactly
      // where it goes back to (true for points and corrections alike).
      const lastEntry = vScoreHistory[vScoreHistory.length - 1];
      const undoScores = lastEntry && (format.type === 'best-of' && Array.isArray(lastEntry.sets)
        ? lastEntry.sets[lastEntry.currentSet || 0] || { score1: 0, score2: 0 }
        : { score1: lastEntry.vScore1 ?? 0, score2: lastEntry.vScore2 ?? 0 });
      const undoHint = undoScores
        ? `back to ${boardHalves.map((h) => (h.team === 1 ? undoScores.score1 : undoScores.score2)).join('\u2013')}`
        : '';
      const setHistory = format.type === 'best-of'
        ? sets.filter((s) => s.completed).map((s, i) => {
          const winnerTeam = s.score1 > s.score2 ? 1 : 2;
          const scoreOf = (team) => (team === 1 ? s.score1 : s.score2);
          return {
            label: `Set ${i + 1}`,
            left: scoreOf(boardHalves[0].team),
            right: scoreOf(boardHalves[1].team),
            winnerKey: winnerTeam === 1 ? 'a' : 'b',
            winnerName: getTeamLabel(winnerTeam),
          };
        })
        : [];
      const boardStatus = format.type === 'best-of'
        ? [`Set ${currentSet + 1}`, `Sets ${leftSetsWon}–${rightSetsWon}`]
        : [`First to ${format.target}`];
      const boardScore = boardHalves.map((h) => h.score).join('–');
      // The dialogs say exactly which score they act on, in the board's order.
      const dialogSummary = (
        <div className="sb-confirm-summary">
          <span>{boardStatus.join(' · ')}</span>
          <strong>{boardScore}</strong>
        </div>
      );
      return (
        <>
          <h1 className="sr-only">{quickMatchScoringHeading}</h1>
          {renderEndMatchDialog({ className: 'sb-confirm', summary: dialogSummary })}
          {renderDiscardDialog({ className: 'sb-confirm', summary: dialogSummary })}
          <TeamSetsBoard
            title={`${team1Name} v ${team2Name}`}
            subtitle={`${sportConfig?.name || 'Match'} \u00b7 ${setsRule}`}
            isLive={Boolean(live?.isLive)}
            colourStyle={teamColourStyle}
            halves={boardHalves}
            meta={[...boardStatus, timer.formatted]}
            setHistory={setHistory}
            // One plain line, e.g. "Last: point Reds · 22–19" (serving shows once, on the key).
            lastLine={lastEntry && lastAction === `${getTeamLabel(lastEntry.team)} +1 ${scoringUnit}`
              ? `Last: point ${getTeamLabel(lastEntry.team)} \u00b7 ${boardScore}`
              : lastAction || 'Tap a team to score a point'}
            canUndo={vScoreHistory.length > 0}
            undoHint={undoHint}
            onUndo={undoPoint}
            onPoint={addPoint}
            onSwap={handleSideSwap}
            onCorrect={(team) => adjustSetScore(team, -1)}
            onDiscard={requestDiscardQuickMatch}
            onFinish={requestEndMatch}
            notice={<ScoringNotice message={saveWarning} />}
            live={cloudAuthAvailable ? (
              <LiveBroadcastBar
                broadcast={live}
                descriptor={liveDescriptor}
                enabled={liveEnabled}
                onEnableChange={setLiveEnabled}
              />
            ) : null}
          />
        </>
      );
    }

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

  // === RESULT PHASE: the Kit Finish (plan 2026-10-22 §9 S3) ===
  // The saved result becomes one display model (finishModel.js); winner and margins come from the
  // persisted scores. Rematch keeps the teams and their colours (PR #180); Done goes Home (/app).
  const finishModel = finishFromQuickResult(result, {
    kind: isCricket ? 'cricket' : isGoals ? 'goals' : 'sets',
    unit: scoringUnit,
    maxWickets,
  });
  const resultFormat = result?.format || format;
  const finishMeta = [
    isCricket && resultFormat?.overs ? `${resultFormat.overs} overs` : null,
    !isCricket && !isGoals && resultFormat?.type === 'best-of' ? `Best of ${resultFormat.sets || 3}` : null,
    formatDuration(result?.elapsedSeconds),
  ].filter(Boolean).join(' · ');
  const syncTone = syncState === 'failed' ? 'mono-alert-danger' : syncState === 'synced' ? 'mono-alert-success' : 'mono-alert-info';

  return (
    <KitFinish
      model={finishModel}
      sportId={sport}
      sportName={sportConfig?.name}
      meta={finishMeta || undefined}
      team1Colour={result?.team1Color}
      team2Colour={result?.team2Color}
      onDone={() => navigate('/app')}
      primary={{ label: 'Rematch', onClick: () => {
        if (isTennis || (isCricket && format.totalInnings === 4)) {
          if (startMatch()) {
            completion.reset();
            resetScoringStarted();
          }
        } else {
          resetMatchState('scoring');
        }
      } }}
      secondary={[
        { label: 'Share', onClick: shareResult },
        { label: 'History', onClick: () => navigate('/history') },
        { label: 'New Match', onClick: () => resetMatchState('setup', { resetTeams: true }) },
      ]}
      notices={(
        <>
          {saveWarning && <div className="mono-alert mono-alert-danger">{saveWarning}</div>}
          {result && !saveWarning && <p className="kit-fin-note" role="status">Match saved to History on this device.</p>}
          {shareStatus && <p className="kit-fin-note" role="status">{shareStatus}</p>}
          {isAuthenticated && syncState !== 'idle' && (
            <div className={`mono-alert ${syncTone}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm" style={{ margin: 0 }}>
                  {syncState === 'syncing' && 'Syncing this match to your profile...'}
                  {syncState === 'synced' && 'Synced to your profile.'}
                  {syncState === 'failed' && (syncError || 'Could not sync this match to your profile.')}
                </p>
                {syncState === 'failed' && (
                  <button type="button" onClick={retryResultSync} className="se-ctl">Retry</button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    />
  );
}















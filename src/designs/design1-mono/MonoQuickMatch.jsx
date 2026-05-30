import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { OVERS_PRESETS, CRICKET_FORMATS, buildCricketFormat, ballsToOvers, calculateRunRate, getPowerplayPhase, getCricketFormat } from '../../utils/cricketCalculations';
import BackArrow from './components/BackArrow';
import { POINTS_PRESETS, validateSingleSetScore } from '../../utils/volleyballCalculations';
import { clearData, saveData, loadData } from '../../utils/storage';
import { getSportById } from '../../models/sportRegistry';
import { useTimer } from '../../hooks/useTimer';
import { getSportDefaults, applyStandardDefaults } from '../../utils/sportDefaults';
import { useAuth } from '../../hooks/useAuth';
import { useMatchSync, buildQuickMatchClientId } from '../../hooks/useMatchSync';
import { useDebounce } from '../../hooks/useDebounce';
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

function saveQuickMatch(match) {
  const all = loadData('se_quickmatches', []);
  const idx = all.findIndex((m) => m.id === match.id);
  if (idx >= 0) all[idx] = match;
  else all.unshift(match);
  return saveData('se_quickmatches', all);
}

// Swap button — defined outside component to avoid S6478 (component defined inside render)
function SwapButton({ onSwap }) {
  return (
    <button
      onClick={onSwap}
      className="mono-btn"
      style={{ padding: '6px 10px', fontSize: '0.75rem' }}
      title="Swap sides"
      aria-label="Swap team sides"
    >
      ⇄ Swap
    </button>
  );
}

function EndMatchDialog({ onCancel, onConfirm }) {
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
        aria-labelledby="end-match-title"
        aria-describedby="end-match-message"
      >
        <p className="app-confirm-eyebrow">Match control</p>
        <h2 id="end-match-title" className="app-confirm-title">End match?</h2>
        <p id="end-match-message" className="app-confirm-message">
          This will finish the current match and save the result.
        </p>
        <div className="app-confirm-actions">
          <button
            type="button"
            ref={cancelButtonRef}
            onClick={onCancel}
            className="app-confirm-secondary"
          >
            Keep scoring
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="app-confirm-primary"
          >
            End match
          </button>
        </div>
      </section>
    </div>
  );
}

function ScoringStatusStrip({ label, value, lastAction }) {
  if (!label && !lastAction) return null;

  return (
    <div
      className="mono-score-mini mb-4 flex items-center justify-between gap-3"
      style={{ padding: '10px 12px' }}
      aria-live="polite"
    >
      {label ? (
        <div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: '#888' }}>{label}</p>
          <p className="text-sm font-medium" style={{ color: '#111' }}>{value}</p>
        </div>
      ) : <span />}
      {lastAction && (
        <p className="text-xs text-right" style={{ color: '#555' }}>
          Last: {lastAction}
        </p>
      )}
    </div>
  );
}

function CorrectionControls({ teamName, onMinus, onPlus }) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      <button
        type="button"
        onClick={onMinus}
        className="mono-btn"
        style={{ minHeight: '44px', padding: '8px 10px' }}
        aria-label={`Subtract one from ${teamName}`}
      >
        -1
      </button>
      <button
        type="button"
        onClick={onPlus}
        className="mono-btn"
        style={{ minHeight: '44px', padding: '8px 10px' }}
        aria-label={`Add one to ${teamName}`}
      >
        +1
      </button>
    </div>
  );
}

function ThumbActionBar({ canUndo, onUndo, onSwap, onEnd }) {
  return (
    <div className="grid grid-cols-3 gap-2 mt-4">
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        className="mono-btn"
        style={{ minHeight: '46px', padding: '10px', opacity: canUndo ? 1 : 0.42 }}
      >
        Undo
      </button>
      {onSwap ? (
        <button
          type="button"
          onClick={onSwap}
          className="mono-btn"
          style={{ minHeight: '46px', padding: '10px' }}
        >
          Swap
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onEnd}
        className="mono-btn"
        style={{ minHeight: '46px', padding: '10px', borderColor: '#dc2626', color: '#dc2626' }}
      >
        End
      </button>
    </div>
  );
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

  // Auth + Convex integration for match saving
  const { isAuthenticated, user } = useAuth();

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
    if (!draft || draft.sport !== sport || draft.phase !== 'scoring') {
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
      timerElapsed: timer.elapsed,
      startedAt: startedAtRef.current,
      updatedAt: new Date().toISOString(),
    });
  }, [battingTeam, cricketHistory, currentSet, format, freeHit, gScore1, gScore2, gScoreHistory, innings, lastAction, phase, quickMatchDraftKey, scores, servingTeam, sets, sport, team1Name, team2Name, timer.elapsed, trialBallUsed, vScore1, vScore2, vScoreHistory]);

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
  const tracksPointWinnerServe = sport === 'volleyball' || sport === 'badminton';

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
    setCricketHistory(prev => [...prev, { type: 'runs', key, value: runs, freeHit, innings, battingTeam }]);

    setScores(prev => {
      const team = { ...prev[key] };
      team.runs += runs;
      team.balls += 1;

      // Check if innings over
      if (team.balls >= totalBalls) {
        if (innings === 1) {
          setInnings(2);
          setBattingTeam(battingTeam === 1 ? 2 : 1);
        } else {
          finishCricketMatch({ ...prev, [key]: team });
        }
      }

      // Check if team 2 chased
      if (innings === 2) {
        const target = battingTeam === 2 ? prev.team1.runs : prev.team2.runs;
        if (team.runs > target) {
          finishCricketMatch({ ...prev, [key]: team });
        }
      }

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
    setCricketHistory(prev => [...prev, { type: 'wicket', key, freeHit, innings, battingTeam }]);

    setScores(prev => {
      const team = { ...prev[key] };
      team.wickets += 1;
      team.balls += 1;

      // All out when wickets >= players-1, or overs done
      if (team.wickets >= maxWickets || team.balls >= totalBalls) {
        team.allOut = team.wickets >= maxWickets;
        if (innings === 1) {
          setInnings(2);
          setBattingTeam(battingTeam === 1 ? 2 : 1);
        } else {
          finishCricketMatch({ ...prev, [key]: team });
        }
      }

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
    setLastAction(`${battingName} ${type === 'noBall' ? 'no ball' : 'wide'} +1`);
    setCricketHistory(prev => [...prev, { type: 'extra', key, extraType: type, freeHit, innings, battingTeam }]);
    setScores(prev => ({
      ...prev,
      [key]: { ...prev[key], runs: prev[key].runs + 1 },
    }));

    // No ball triggers free hit if format supports it
    if (type === 'noBall' && format.freeHit) {
      setFreeHit(true);
    }
  };

  const undoCricketAction = () => {
    if (cricketHistory.length === 0) return;
    void correctionImpact();

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
      const updater = (prev) => prev + 1;
      if (team === 1) {
        setVScore1(updater);
      } else {
        setVScore2(updater);
      }

      const newS1 = team === 1 ? vScore1 + 1 : vScore1;
      const newS2 = team === 2 ? vScore2 + 1 : vScore2;

      if (validateSingleSetScore(newS1, newS2, target)) {
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

    if (delta > 0 && validateSingleSetScore(newS1, newS2, format.target)) {
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
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;
    void scoreImpact();

    const newS1 = team === 1 ? gScore1 + value : gScore1;
    const newS2 = team === 2 ? gScore2 + value : gScore2;

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

  const resetMatchState = (nextPhase = 'setup') => {
    restoredDraftRef.current = false;
    setSaveWarning('');
    setPhase(nextPhase);
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
    clearData(quickMatchDraftKey);
    timer.reset();
    startedAtRef.current = null;
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
  const handleSetupBack = () => {
    if (isTeamSetupStep) {
      navigate(-1);
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
              style={{ color: '#888' }}
              aria-label={isTeamSetupStep ? 'Go back' : 'Return to match setup'}
            >
              <BackArrow />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#111' }}>
                {sportConfig?.icon || '\u{1F3D0}'} Quick Match
              </h1>
              <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                {isTeamSetupStep ? 'Setup match' : `Edit ${currentStepLabel.toLowerCase()}`}
              </p>
            </div>
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
                    background: i < setupStep ? '#0066ff' : '#eee',
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
                  <label className="text-xs uppercase tracking-widest font-normal mb-4 block" style={{ color: '#888' }}>
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
                          <p className="text-sm font-semibold mb-1" style={{ color: '#111' }}>
                            {cf.name}
                          </p>
                          <p className="text-xs" style={{ color: '#888' }}>{cf.desc}</p>
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
                  <label className="text-xs uppercase tracking-widest font-normal mb-4 block" style={{ color: '#888' }}>
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
                      <p className="text-sm font-semibold mb-1" style={{ color: '#111' }}>Standard</p>
                      <p className="text-xs" style={{ color: '#888' }}>Official rules for {sportConfig?.name || 'this sport'}</p>
                    </button>
                    <button
                      onClick={() => setFormatMode('custom')}
                      className={`mono-setup-option flex-1 text-left ${formatMode === 'custom' ? 'mono-setup-option-selected' : ''}`}
                      style={{
                        padding: '16px',
                        cursor: 'pointer',
                      }}
                    >
                      <p className="text-sm font-semibold mb-1" style={{ color: '#111' }}>Custom</p>
                      <p className="text-xs" style={{ color: '#888' }}>Set your own rules</p>
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
                    <p className="text-sm font-semibold" style={{ color: '#111' }}>{selectedCricketFormat.name}</p>
                    <p className="text-xs" style={{ color: '#888' }}>{selectedCricketFormat.desc}</p>
                  </div>
                  <button
                    onClick={() => setSetupStep(1)}
                    className="ml-auto text-xs bg-transparent border-none cursor-pointer"
                    style={{ color: '#0066ff' }}
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
                      <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
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
                      <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
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
                            autoFocus
                          />
                          <span className="text-xs" style={{ color: '#888' }}>overs</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ball limit (when tracking balls only, Custom) */}
                  {cricketPreset === 'custom' && format.trackOvers === false && (
                    <div className="mb-6">
                      <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
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
                        <span className="text-2xl font-bold font-mono" style={{ color: '#111', minWidth: '36px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
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
                      <p className="text-xs mt-2" style={{ color: '#bbb' }}>No over structure — just track runs and balls</p>
                    </div>
                  )}

                  <hr className="mono-divider mb-6" />

                  {/* Players */}
                  <div className="mb-6">
                    <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
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
                      <span className="text-2xl font-bold font-mono" style={{ color: '#111', minWidth: '36px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
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
                    <p className="text-xs mt-2" style={{ color: '#bbb' }}>
                      {(format.players || 6) - 1} wickets to bowl a team out
                    </p>
                  </div>

                  {/* Match type */}
                  <div className="mb-6">
                    <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
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
                    <p className="text-xs mt-2" style={{ color: '#bbb' }}>
                      {format.solo
                        ? 'One team bats, other bowls'
                        : 'Both teams bat and bowl'
                      }
                    </p>
                  </div>

                  {/* Innings Format (Gully and Custom) */}
                  <div className="mb-6">
                    <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
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
                        style={{ color: '#0066ff', padding: '8px 0', marginBottom: showAdvanced ? 8 : 0 }}
                      >
                        {showAdvanced ? '- Hide advanced options' : '+ Advanced options'}
                      </button>
                      {showAdvanced && (
                        <div>
                          <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
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
                          <p className="text-xs mt-2" style={{ color: '#bbb' }}>
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
                        <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
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
                            <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
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
                            <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
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
                          <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
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
                        <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
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
                          <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
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
                          <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
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
                      <h2 id="quick-match-rules-heading" className="text-sm font-semibold" style={{ color: '#111' }}>
                        Match rules
                      </h2>
                      <p className="text-sm mt-1" style={{ color: '#333' }}>
                        {isCricket && selectedCricketFormat ? selectedCricketFormat.name : sportConfig?.name}
                      </p>
                      <p className="text-xs font-mono mt-1" style={{ color: '#888' }}>
                        {ruleSummary}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSetupStep(1)}
                    className="text-xs bg-transparent cursor-pointer w-full sm:w-auto"
                    style={{
                      minHeight: 44,
                      border: '1.5px solid #0066ff',
                      color: '#0066ff',
                      padding: '0 12px',
                    }}
                  >
                    Edit Rules
                  </button>
                </div>
              </section>

              {/* Team names */}
              <fieldset className="mb-8 border-0 p-0">
                <legend className="text-xs uppercase tracking-widest font-normal mb-4 block" style={{ color: '#888' }}>
                  Teams
                </legend>

                {/* Team 1 */}
                <div ref={team1Ref} className="relative mb-5">
                  <label htmlFor="quick-team-1" className="text-xs font-semibold mb-2 block" style={{ color: '#555' }}>
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
                    autoFocus
                  />
                  {showTeam1Suggestions && sortedTeam1.length > 0 && (
                    <div
                      className="absolute left-0 right-0"
                      style={{
                        background: '#fff', border: '1px solid #eee',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', zIndex: 10,
                        maxHeight: 180, overflowY: 'auto',
                      }}
                    >
                      {sortedTeam1.map(t => (
                        <button
                          key={t._id}
                          onClick={() => { setTeam1Name(t.name); setShowTeam1Suggestions(false); }}
                          onMouseDown={e => e.preventDefault()}
                          className="w-full text-left bg-transparent border-none cursor-pointer flex items-center justify-between"
                          style={{ padding: '8px 12px', borderBottom: '1px solid #f5f5f5' }}
                        >
                          <span className="text-sm" style={{ color: '#111' }}>{t.name}</span>
                          <span className="text-xs font-mono" style={{ color: '#bbb' }}>
                            {t.matchCount} match{t.matchCount !== 1 ? 'es' : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Team 2 */}
                <div ref={team2Ref} className="relative">
                  <label htmlFor="quick-team-2" className="text-xs font-semibold mb-2 block" style={{ color: '#555' }}>
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
                  {showTeam2Suggestions && sortedTeam2.length > 0 && (
                    <div
                      className="absolute left-0 right-0"
                      style={{
                        background: '#fff', border: '1px solid #eee',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', zIndex: 10,
                        maxHeight: 180, overflowY: 'auto',
                      }}
                    >
                      {sortedTeam2.map(t => (
                        <button
                          key={t._id}
                          onClick={() => { setTeam2Name(t.name); setShowTeam2Suggestions(false); }}
                          onMouseDown={e => e.preventDefault()}
                          className="w-full text-left bg-transparent border-none cursor-pointer flex items-center justify-between"
                          style={{ padding: '8px 12px', borderBottom: '1px solid #f5f5f5' }}
                        >
                          <span className="text-sm" style={{ color: '#111' }}>{t.name}</span>
                          <span className="text-xs font-mono" style={{ color: '#bbb' }}>
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
                    color: '#0066ff',
                    display: 'inline-flex',
                    minHeight: 44,
                    padding: '0 12px',
                  }}
                >
                  {showRosterSetup ? 'Hide players' : 'Add players'}
                  {playerCount > 0 && !showRosterSetup && (
                    <span style={{ color: '#888', marginLeft: 4 }}>({playerCount})</span>
                  )}
                </button>

                {showRosterSetup && (
                  <div className="mb-4 grid gap-4" style={{ paddingLeft: 8, borderLeft: '2px solid #eee' }}>
                    <div>
                      <h3 className="text-xs font-semibold mb-2" style={{ color: '#555' }}>
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
                      <h3 className="text-xs font-semibold mb-2" style={{ color: '#555' }}>
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
                    style={{ width: 16, height: 16, accentColor: '#0066ff' }}
                  />
                  <span className="text-sm" style={{ color: '#111' }}>
                    I'm refereeing this match
                  </span>
                </label>
              )}

              <button
                onClick={startMatch}
                className="mono-btn-primary w-full"
                style={{ minHeight: 52, padding: '12px', fontSize: '0.9375rem', opacity: teamNamesReady ? 1 : 0.4 }}
                disabled={!teamNamesReady}
              >
                {startButtonLabel}
              </button>
              {!teamNamesReady && (
                <p className="text-xs text-center mt-3" style={{ color: '#dc2626' }}>
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
  const timerColor = isTimeUp ? '#dc2626' : '#888';

  const quickButtons = sportConfig?.config?.quickButtons;
  const hasQuickButtons = quickButtons && quickButtons.length > 0;

  // Cricket scoring helpers
  const showOvers = !isCricket || format.trackOvers !== false;
  const formatPreset = isCricket && format?.preset ? getCricketFormat(format.preset) : null;
  const presetLabel = formatPreset?.name || '';
  const endMatchDialog = showEndConfirm ? (
    <EndMatchDialog onCancel={cancelEndMatch} onConfirm={confirmEndMatch} />
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
        <div className="min-h-screen px-6 py-10">
          <div className="max-w-2xl mx-auto">
            {endMatchDialog}
            {saveWarning && (
              <div className="mono-alert mono-alert-danger mb-4">
                {saveWarning}
              </div>
            )}
            {/* Top bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
              <button onClick={requestEndMatch} className="mono-btn" style={{ padding: '8px 12px', fontSize: '0.8125rem', borderColor: '#dc2626', color: '#dc2626' }}>
                End Match
              </button>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-sm font-mono" style={{ color: '#888' }}>{timer.formatted}</span>
                {presetLabel && <span className="mono-badge">{presetLabel}</span>}
                {isRefereeing && <span className="text-xs" style={{ color: '#888' }}>Referee&nbsp;&middot;</span>}
                <span className="mono-badge mono-badge-live">Innings {innings}</span>
              </div>
            </div>

            <ScoringStatusStrip label="Batting" value={currentName} lastAction={lastAction} />

            {/* Gully rule indicators */}
            {format.oneTipOneHand && (
              <p className="text-xs text-center mb-2" style={{ color: '#888' }}>One tip one hand active</p>
            )}

            {/* Trial ball banner */}
            {showTrialBall && (
              <div className="mono-alert mono-alert-info text-center mb-4" style={{ padding: '12px 16px' }}>
                <p className="text-sm font-medium" style={{ color: '#0066ff' }}>Trial Ball — first delivery doesn't count</p>
                <button
                  onClick={() => setTrialBallUsed(true)}
                  className="mono-btn mt-2"
                  style={{ padding: '6px 16px', fontSize: '0.75rem', borderColor: '#0066ff', color: '#0066ff' }}
                >
                  Skip (Trial)
                </button>
              </div>
            )}

            {/* Batting team */}
            <div className="text-center mb-8">
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#888' }}>
                {currentName} batting
              </p>
              <p className="text-6xl font-bold font-mono mono-score mb-2" style={{ color: '#111' }}>
                {currentScore.runs}<span style={{ color: '#bbb', fontSize: '0.5em' }}>/{currentScore.wickets}</span>
              </p>
              <p className="text-sm font-mono" style={{ color: '#888' }}>
                {oversDisplay} &middot; RR {currentScore.balls > 0 ? calculateRunRate(currentScore.runs, currentScore.balls).toFixed(2) : '0.00'}
              </p>

              {/* Powerplay indicator */}
              {powerplay && (
                <p className="text-xs mt-1" style={{ color: '#0066ff' }}>
                  {powerplay.label} (Overs {powerplay.start}-{powerplay.end})
                </p>
              )}

              {/* Last Man Stands */}
              {isLastMan && (
                <p className="text-xs mt-1 font-medium" style={{ color: '#ff6b00' }}>Last Man Batting</p>
              )}

              {/* Free Hit banner */}
              {freeHit && (
                <div className="mono-row-panel mt-3 mb-1" style={{ padding: '8px 16px', borderColor: '#ff6b00', backgroundColor: '#fff8f0' }}>
                  <p className="text-sm font-bold" style={{ color: '#ff6b00' }}>FREE HIT</p>
                  <p className="text-xs" style={{ color: '#888' }}>Run Out Only</p>
                </div>
              )}

              {target !== null && (
                <p className="text-sm mt-2" style={{ color: '#0066ff' }}>
                  Target: {target + 1} &middot; Need {Math.max(0, target + 1 - currentScore.runs)}
                  {totalBalls !== Infinity ? ` from ${totalBalls - currentScore.balls} balls` : ''}
                </p>
              )}
            </div>

            {/* Other team score */}
            <div className="mono-score-mini text-center mb-8" style={{ padding: '12px 16px' }}>
              <p className="text-xs" style={{ color: '#888' }}>
                {otherName}: {otherScore.runs}/{otherScore.wickets} ({otherOversDisplay})
              </p>
            </div>

            {/* Run buttons */}
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {CRICKET_RUN_VALUES.map(r => (
                <button
                  key={r}
                  onClick={() => addRuns(r)}
                  className={r === 4 || r === 6 ? 'mono-btn-primary' : 'mono-btn'}
                  style={{ width: '56px', height: '56px', fontSize: '1.25rem', fontWeight: 700, padding: 0, touchAction: 'manipulation' }}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="flex gap-2 justify-center mb-4">
              <button onClick={() => addExtra('wide')} className="mono-btn" style={{ padding: '10px 16px', fontSize: '0.8125rem', touchAction: 'manipulation' }}>
                Wide (+1)
              </button>
              <button onClick={() => addExtra('noBall')} className="mono-btn" style={{ padding: '10px 16px', fontSize: '0.8125rem', touchAction: 'manipulation' }}>
                No Ball (+1)
              </button>
            </div>

            <button
              onClick={addWicket}
              className="mono-btn w-full"
              style={{ padding: '14px', fontSize: '0.9375rem', borderColor: '#f59e0b', color: '#92400e', background: '#fffbeb', touchAction: 'manipulation' }}
            >
              {freeHit ? 'Run Out Only' : 'Wicket'}
            </button>

            <ThumbActionBar
              canUndo={cricketHistory.length > 0}
              onUndo={undoCricketAction}
              onEnd={requestEndMatch}
            />
          </div>
        </div>
      );
    }

    // Side swap helpers — visual left/right, data stays the same
    const leftTeam = sidesSwapped ? 2 : 1;
    const rightTeam = sidesSwapped ? 1 : 2;
    const leftName = sidesSwapped ? team2Name : team1Name;
    const rightName = sidesSwapped ? team1Name : team2Name;
    const leftAccent = leftTeam === 1 ? '#0066ff' : '#16a34a';
    const rightAccent = rightTeam === 1 ? '#0066ff' : '#16a34a';

    // Goals-based scoring
    if (isGoals) {
      const leftScore = sidesSwapped ? gScore2 : gScore1;
      const rightScore = sidesSwapped ? gScore1 : gScore2;

      return (
        <div className="min-h-screen px-6 py-10">
          <div className="max-w-2xl mx-auto">
            {endMatchDialog}
            {saveWarning && (
              <div className="mono-alert mono-alert-danger mb-4">
                {saveWarning}
              </div>
            )}
            {/* Top bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
              <button onClick={requestEndMatch} className="mono-btn" style={{ padding: '8px 12px', fontSize: '0.8125rem', borderColor: '#dc2626', color: '#dc2626' }}>
                End Match
              </button>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-sm font-mono" style={{ color: timerColor }}>
                  {isTimeUp ? "Time's up!" : timerDisplay}
                </span>
                <SwapButton onSwap={handleSideSwap} />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {isRefereeing && <span className="text-xs" style={{ color: '#888' }}>Referee&nbsp;&middot;</span>}
                <span className="mono-badge mono-badge-live">
                  {isPointsMode ? `First to ${format.target}` : 'Live'}
                </span>
              </div>
            </div>

            <ScoringStatusStrip label="Scoring" value={`${leftName} vs ${rightName}`} lastAction={lastAction} />

            {/* Score panels */}
            <div className="mono-score-grid items-start mb-6">
              {/* Left team */}
              <div className="flex-1">
                <button
                  type="button"
                  className="w-full h-full flex flex-col items-center justify-center mono-score-pad"
                  onClick={!hasQuickButtons ? () => addGoal(leftTeam) : undefined}
                  disabled={hasQuickButtons}
                  style={{ padding: '24px 16px', touchAction: 'manipulation', '--score-accent': leftAccent, '--score-pad-height': hasQuickButtons ? '180px' : '250px', opacity: 1 }}
                  aria-label={hasQuickButtons ? `${leftName} score` : `Add score for ${leftName}`}
                >
                  <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: leftAccent }}>
                    Left side
                  </p>
                  <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#555' }}>
                    {leftName}
                  </p>
                  <p className="text-6xl font-bold font-mono mono-score" style={{ color: '#111' }}>
                    {leftScore}
                  </p>
                  {!hasQuickButtons && (
                    <p className="text-xs mt-3" style={{ color: '#555' }}>Tap +1</p>
                  )}
                </button>
                <CorrectionControls
                  teamName={leftName}
                  onMinus={() => adjustGoalScore(leftTeam, -1)}
                  onPlus={() => adjustGoalScore(leftTeam, 1)}
                />
              </div>

              {/* Right team */}
              <div className="flex-1">
                <button
                  type="button"
                  className="w-full h-full flex flex-col items-center justify-center mono-score-pad"
                  onClick={!hasQuickButtons ? () => addGoal(rightTeam) : undefined}
                  disabled={hasQuickButtons}
                  style={{ padding: '24px 16px', touchAction: 'manipulation', '--score-accent': rightAccent, '--score-pad-height': hasQuickButtons ? '180px' : '250px', opacity: 1 }}
                  aria-label={hasQuickButtons ? `${rightName} score` : `Add score for ${rightName}`}
                >
                  <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: rightAccent }}>
                    Right side
                  </p>
                  <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#555' }}>
                    {rightName}
                  </p>
                  <p className="text-6xl font-bold font-mono mono-score" style={{ color: '#111' }}>
                    {rightScore}
                  </p>
                  {!hasQuickButtons && (
                    <p className="text-xs mt-3" style={{ color: '#555' }}>Tap +1</p>
                  )}
                </button>
                <CorrectionControls
                  teamName={rightName}
                  onMinus={() => adjustGoalScore(rightTeam, -1)}
                  onPlus={() => adjustGoalScore(rightTeam, 1)}
                />
              </div>
            </div>

            {/* Quick buttons per team (for button sports) */}
            {hasQuickButtons && (
              <div className="flex gap-4 mb-6">
                <div className="flex-1 flex flex-wrap gap-2 justify-center">
                  {quickButtons.map(btn => (
                    <button
                      key={`left-${btn.label}`}
                      onClick={() => addGoal(leftTeam, btn.value)}
                      className="mono-btn"
                      style={{ padding: '8px 10px', fontSize: '0.75rem', touchAction: 'manipulation' }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 flex flex-wrap gap-2 justify-center">
                  {quickButtons.map(btn => (
                    <button
                      key={`right-${btn.label}`}
                      onClick={() => addGoal(rightTeam, btn.value)}
                      className="mono-btn"
                      style={{ padding: '8px 10px', fontSize: '0.75rem', touchAction: 'manipulation' }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <ThumbActionBar
              canUndo={gScoreHistory.length > 0}
              onUndo={undoGoal}
              onSwap={handleSideSwap}
              onEnd={requestEndMatch}
            />

            <p className="text-xs text-center mt-4" style={{ color: '#bbb' }}>
              {!hasQuickButtons ? `Tap a team to add 1 ${scoringUnit}` : null}
              {isPointsMode && format.target ? ` · First to ${format.target}` : null}
            </p>
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

    return (
      <div className="min-h-screen px-6 py-10">
        <div className="max-w-2xl mx-auto">
          {endMatchDialog}
          {saveWarning && (
            <div className="mono-alert mono-alert-danger mb-4">
              {saveWarning}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
            <button onClick={requestEndMatch} className="mono-btn" style={{ padding: '8px 12px', fontSize: '0.8125rem', borderColor: '#dc2626', color: '#dc2626' }}>
              End Match
            </button>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-sm font-mono" style={{ color: '#888' }}>{timer.formatted}</span>
              <SwapButton onSwap={handleSideSwap} />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {isRefereeing && <span className="text-xs" style={{ color: '#888' }}>Referee&nbsp;&middot;</span>}
              <span className="mono-badge mono-badge-live">
                {format.type === 'best-of' ? `Set ${currentSet + 1} of ${format.sets}` : `First to ${format.target}`}
              </span>
            </div>
          </div>

          <ScoringStatusStrip
            label={tracksPointWinnerServe ? 'Serving' : 'Scoring'}
            value={tracksPointWinnerServe ? (servingTeam === leftTeam ? leftName : rightName) : `${leftName} vs ${rightName}`}
            lastAction={lastAction}
          />

          {/* Sets won (best-of only) */}
          {format.type === 'best-of' && (
            <div className="flex justify-center gap-4 mb-4">
              <div className="text-center">
                <p className="text-xs uppercase tracking-widest" style={{ color: '#888' }}>{leftName}</p>
                <p className="text-2xl font-bold font-mono" style={{ color: '#111' }}>
                  {leftSetsWon}
                </p>
                <p className="text-xs" style={{ color: '#bbb' }}>sets</p>
              </div>
              <div className="text-center">
                <p className="text-xs uppercase tracking-widest" style={{ color: '#888' }}>{rightName}</p>
                <p className="text-2xl font-bold font-mono" style={{ color: '#111' }}>
                  {rightSetsWon}
                </p>
                <p className="text-xs" style={{ color: '#bbb' }}>sets</p>
              </div>
            </div>
          )}

          <div className="mono-score-grid items-start mb-8">
            {/* Left team */}
            <div className="flex-1">
              <button
                type="button"
                className="w-full h-full flex flex-col items-center justify-center cursor-pointer mono-score-pad"
                onClick={() => addPoint(leftTeam)}
                style={{ padding: '24px 16px', touchAction: 'manipulation', '--score-accent': leftAccent, '--score-pad-height': '250px' }}
                aria-label={`Add point for ${leftName}`}
              >
                <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: leftAccent }}>
                  Left side
                </p>
                <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#555' }}>
                  {leftName}
                </p>
                <p className="text-6xl font-bold font-mono mono-score" style={{ color: '#111' }}>
                  {leftSetScore}
                </p>
                <p className="text-xs mt-4" style={{ color: '#555' }}>Tap +1</p>
              </button>
              <CorrectionControls
                teamName={leftName}
                onMinus={() => adjustSetScore(leftTeam, -1)}
                onPlus={() => adjustSetScore(leftTeam, 1)}
              />
            </div>

            {/* Right team */}
            <div className="flex-1">
              <button
                type="button"
                className="w-full h-full flex flex-col items-center justify-center cursor-pointer mono-score-pad"
                onClick={() => addPoint(rightTeam)}
                style={{ padding: '24px 16px', touchAction: 'manipulation', '--score-accent': rightAccent, '--score-pad-height': '250px' }}
                aria-label={`Add point for ${rightName}`}
              >
                <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: rightAccent }}>
                  Right side
                </p>
                <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#555' }}>
                  {rightName}
                </p>
                <p className="text-6xl font-bold font-mono mono-score" style={{ color: '#111' }}>
                  {rightSetScore}
                </p>
                <p className="text-xs mt-4" style={{ color: '#555' }}>Tap +1</p>
              </button>
              <CorrectionControls
                teamName={rightName}
                onMinus={() => adjustSetScore(rightTeam, -1)}
                onPlus={() => adjustSetScore(rightTeam, 1)}
              />
            </div>
          </div>

          <ThumbActionBar
            canUndo={vScoreHistory.length > 0}
            onUndo={undoPoint}
            onSwap={handleSideSwap}
            onEnd={requestEndMatch}
          />

          <p className="text-xs text-center" style={{ color: '#bbb' }}>
            {format.type === 'best-of'
              ? `${format.points || 25} points · Win by 2 at deuce`
              : `${format.target} points to win · Win by 2 at deuce`}
          </p>
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
              borderColor: syncState === 'failed' ? '#dc2626' : syncState === 'synced' ? '#16a34a' : '#0066ff',
              color: syncState === 'failed' ? '#dc2626' : syncState === 'synced' ? '#166534' : '#0066ff',
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
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#888' }}>
            Match Result
          </p>

          {isNoWinner ? (
            <h1 className="text-2xl font-bold" style={{ color: '#111' }}>
              {isDraw ? 'Match Drawn' : 'Match Tied'}
            </h1>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-2" style={{ color: '#111' }}>
                {result.winner} Won
              </h1>
              {isCricket && result.team1Score && result.team2Score && (
                <p className="text-sm" style={{ color: '#888' }}>
                  by {Math.abs(result.team1Score.runs - result.team2Score.runs)} runs
                </p>
              )}
            </>
          )}

          {result?.elapsedSeconds > 0 && (
            <p className="text-xs font-mono mt-3" style={{ color: '#888' }}>
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
                <span className="text-sm font-medium" style={{ color: result.winner === result.team1 ? '#111' : '#888' }}>
                  {result.team1}
                </span>
                <span className="font-mono font-bold" style={{ color: result.winner === result.team1 ? '#111' : '#888' }}>
                  {result.team1Score.runs}/{result.team1Score.wickets} ({ballsToOvers(result.team1Score.balls)} ov)
                </span>
              </div>
              <hr className="mono-divider" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: result.winner === result.team2 ? '#111' : '#888' }}>
                  {result.team2}
                </span>
                <span className="font-mono font-bold" style={{ color: result.winner === result.team2 ? '#111' : '#888' }}>
                  {result.team2Score.runs}/{result.team2Score.wickets} ({ballsToOvers(result.team2Score.balls)} ov)
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: !isNoWinner && result.winner === result.team1 ? '#111' : '#888' }}>
                {result.team1}
              </span>
              <span className="text-2xl font-bold font-mono mono-score" style={{ color: '#111' }}>
                {result.score1} - {result.score2}
              </span>
              <span className="text-sm font-medium" style={{ color: !isNoWinner && result.winner === result.team2 ? '#111' : '#888' }}>
                {result.team2}
              </span>
            </div>
          )}
        </div>

        {resultSetSummary && (
          <div className="mono-soft-panel mb-8" style={{ padding: '18px 20px' }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="text-xs uppercase tracking-widest" style={{ color: '#888', margin: 0 }}>
                Set breakdown
              </p>
              <span className="text-xs font-mono" style={{ color: '#111' }}>
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
                  <span className="font-mono font-semibold" style={{ color: '#111' }}>
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
            onClick={() => resetMatchState('setup')}
            className="mono-btn"
            style={{ minHeight: 48, padding: '12px' }}
          >
            New Match
          </button>
          <button onClick={() => navigate('/')} className="mono-btn" style={{ minHeight: 48, padding: '12px' }}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
}















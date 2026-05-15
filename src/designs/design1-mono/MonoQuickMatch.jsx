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
import { formatTennisPointScore } from '../../utils/tennisScoring';

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

function getWinnerName(score1, score2, team1Name, team2Name, tiedName = 'Tie') {
  if (score1 > score2) return team1Name;
  if (score2 > score1) return team2Name;
  return tiedName;
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
  const isGoals = engine === 'goals';

  const timer = useTimer();
  const startedAtRef = useRef(null);

  const [phase, setPhase] = useState('setup'); // setup | scoring | result
  const visible = true; // always visible; no fade-in needed for quick match
  const [setupStep, setSetupStep] = useState(1); // 1: Format, 2: Rules (cricket only), 3: Teams
  const [sidesSwapped, setSidesSwapped] = useState(false); // flip left/right teams for referee scoring
  const [showAdvanced, setShowAdvanced] = useState(false);

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
  const [team1Name, setTeam1Name] = useState(wizardTeams?.[0] || '');
  const [team2Name, setTeam2Name] = useState(wizardTeams?.[1] || '');
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
    isAuthenticated && debouncedTeam1.length >= 2
      ? { sport, prefix: debouncedTeam1 }
      : 'skip'
  );
  const team2Results = useQuery(
    api.teams.search,
    isAuthenticated && debouncedTeam2.length >= 2
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
  const quickMatchDraftKey = `se_quickmatch_draft_${sport}`;

  // Result state
  const [result, setResult] = useState(null);

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
      startedAtRef.current = new Date().toISOString();
      timer.start();
    } else if (phase === 'result') {
      timer.pause();
    }
  }, [phase]);

  useEffect(() => {
    if (draftHydratedSportRef.current === sport) return;
    draftHydratedSportRef.current = sport;

    const draft = loadData(quickMatchDraftKey, null);
    if (!draft || draft.sport !== sport || draft.phase !== 'scoring') return;

    restoredDraftRef.current = true;
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
    if (typeof draft.innings === 'number') setInnings(draft.innings);
    if (typeof draft.battingTeam === 'number') setBattingTeam(draft.battingTeam);
    setSaveWarning('Resumed your in-progress quick match on this device.');
    setPhase('scoring');
  }, [quickMatchDraftKey, sport]);

  useEffect(() => {
    if (phase !== 'scoring') return;

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
      innings,
      battingTeam,
      updatedAt: new Date().toISOString(),
    });
  }, [battingTeam, currentSet, format, gScore1, gScore2, innings, phase, quickMatchDraftKey, scores, sets, sport, team1Name, team2Name, vScore1, vScore2]);

  // Apply standard defaults when format mode is 'standard'
  useEffect(() => {
    if (restoredDraftRef.current) return;
    if (formatMode === 'standard' && sport) {
      const defaults = getSportDefaults(sport);
      if (defaults && Object.keys(defaults).length > 0) {
        setFormat(applyStandardDefaults(sport, {}));
      }
    }
  }, [formatMode, sport]);

  // Goals mode helpers
  const isTimedMode = isGoals && format.mode === 'timed';
  const isPointsMode = isGoals && format.mode === 'points';
  const timeLimit = isTimedMode ? format.timeLimit : null;
  const remainingSeconds = isTimedMode ? Math.max(0, timeLimit - timer.elapsed) : null;
  const isTimeUp = isTimedMode && remainingSeconds === 0;

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
    const clientMatchId = entry.clientMatchId || buildQuickMatchClientId(sport, entry.id);
    const nextResult = {
      ...entry,
      clientMatchId,
      sync: createSyncMeta(isAuthenticated && user ? 'syncing' : 'idle'),
    };

    setResult(nextResult);
    persistQuickMatch(nextResult);
    clearData(quickMatchDraftKey);
    setPhase('result');
    syncCompletedMatch(nextResult);
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
    timer.reset();
    startedAtRef.current = null;

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
      navigate(`/${sport}/quick/test/${matchId}`);
      return;
    }

    setPhase('scoring');
  };

  // Cricket: Add runs
  const addRuns = (runs) => {
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;

    if (freeHit) setFreeHit(false);

    const key = battingTeam === 1 ? 'team1' : 'team2';
    setCricketHistory(prev => [...prev, { type: 'runs', key, value: runs, freeHit }]);

    setScores(prev => {
      const team = { ...prev[key] };
      team.runs += runs;
      team.balls += 1;

      // Check if innings over
      if (team.balls >= totalBalls) {
        if (innings === 1) {
          setInnings(2);
          setBattingTeam(battingTeam === 1 ? 2 : 1);
          setCricketHistory([]);
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

    if (freeHit) setFreeHit(false);

    const key = battingTeam === 1 ? 'team1' : 'team2';
    setCricketHistory(prev => [...prev, { type: 'wicket', key, freeHit }]);

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
          setCricketHistory([]);
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

    const key = battingTeam === 1 ? 'team1' : 'team2';
    setCricketHistory(prev => [...prev, { type: 'extra', key, extraType: type, freeHit }]);
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
    const last = cricketHistory[cricketHistory.length - 1];
    setCricketHistory(prev => prev.slice(0, -1));

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

  // Volleyball: Add point
  const addPoint = (team) => {
    // Debounce rapid clicks
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;

    setVScoreHistory(prev => [...prev, {
      team,
      vScore1,
      vScore2,
      sets: cloneSetsSnapshot(sets),
      currentSet,
    }].slice(-100));

    // Best-of format (multi-set)
    if (format.type === 'best-of' && sportConfig?.config) {
      setSets(prevSets => {
        const newSets = applySetPoint(prevSets, currentSet, team);

        // Check if current set is complete
        const s1 = newSets[currentSet].score1;
        const s2 = newSets[currentSet].score2;
        const completionRule = getSetWinRule({ format, sportConfig, currentSet });

        if (isSetComplete({ score1: s1, score2: s2 }, completionRule)) {
          newSets[currentSet].completed = true;

          // Count sets won
          const resultScore = getBestOfResultScore(newSets);
          const t1SetsWon = resultScore.setsWon1;
          const t2SetsWon = resultScore.setsWon2;
          const setsToWin = Math.ceil(format.sets / 2);

          // Check if match complete
          if (t1SetsWon >= setsToWin || t2SetsWon >= setsToWin) {
            const winner = t1SetsWon > t2SetsWon ? team1Name : team2Name;
            const r = {
              id: Date.now(), sport,
              team1: team1Name, team2: team2Name,
              sets: newSets,
              score1: resultScore.score1,
              score2: resultScore.score2,
              setsWon1: t1SetsWon,
              setsWon2: t2SetsWon,
              winner, format,
              date: new Date().toISOString(),
              ...makeTimerFields(),
            };
            finalizeMatch(r);
          } else {
            // Start next set
            newSets.push({ score1: 0, score2: 0, completed: false });
            setCurrentSet(prev => prev + 1);
          }
        }

        return newSets;
      });
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
    const last = vScoreHistory[vScoreHistory.length - 1];
    setVScoreHistory(prev => prev.slice(0, -1));

    if (Array.isArray(last.sets)) {
      setSets(last.sets);
      setCurrentSet(last.currentSet || 0);
    }

    if (typeof last.vScore1 === 'number' && typeof last.vScore2 === 'number') {
      setVScore1(last.vScore1);
      setVScore2(last.vScore2);
      return;
    }

    if (last.team === 1) setVScore1(prev => Math.max(0, prev - 1));
    else setVScore2(prev => Math.max(0, prev - 1));
  };

  // Goals: Add score for a team
  const addGoal = (team, value = 1) => {
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;

    const newS1 = team === 1 ? gScore1 + value : gScore1;
    const newS2 = team === 2 ? gScore2 + value : gScore2;

    if (team === 1) setGScore1(newS1);
    else setGScore2(newS2);
    setGScoreHistory(prev => [...prev, { team, value }]);

    // Auto-end in points mode
    if (isPointsMode && format.target) {
      if (newS1 >= format.target || newS2 >= format.target) {
        const drawAllowed = sportConfig?.config?.drawAllowed ?? true;
        let winner;
        if (newS1 > newS2) winner = team1Name;
        else if (newS2 > newS1) winner = team2Name;
        else winner = drawAllowed ? 'Draw' : 'Tie';
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

  const undoGoal = () => {
    if (gScoreHistory.length === 0) return;
    const last = gScoreHistory[gScoreHistory.length - 1];
    if (last.team === 1) setGScore1(prev => Math.max(0, prev - last.value));
    else setGScore2(prev => Math.max(0, prev - last.value));
    setGScoreHistory(prev => prev.slice(0, -1));
  };

  const endMatchGoals = () => {
    const drawAllowed = sportConfig?.config?.drawAllowed ?? true;
    if (!drawAllowed && gScore1 === gScore2) {
      setSaveWarning(`${sportConfig.name} cannot end tied. Add the deciding score before ending.`);
      return;
    }
    let winner;
    if (gScore1 > gScore2) winner = team1Name;
    else if (gScore2 > gScore1) winner = team2Name;
    else winner = drawAllowed ? 'Draw' : 'Tie';
    const r = {
      id: Date.now(), sport,
      team1: team1Name, team2: team2Name,
      score1: gScore1, score2: gScore2,
      winner, format,
      date: new Date().toISOString(),
      ...makeTimerFields(),
    };
            finalizeMatch(r);
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

  const shareResult = () => {
    if (!result) return;
    let text;
    const w = result.winner;
    const outcome = w === 'Tie' ? 'Match Tied' : w === 'Draw' ? 'Match Drawn' : `${w} won`;
    if (isCricket && result.team1Score) {
      const t1 = `${result.team1Score.runs}/${result.team1Score.wickets} (${ballsToOvers(result.team1Score.balls)} ov)`;
      const t2 = `${result.team2Score.runs}/${result.team2Score.wickets} (${ballsToOvers(result.team2Score.balls)} ov)`;
      text = `${result.team1} ${t1} vs ${result.team2} ${t2} \u2014 ${outcome}`;
    } else {
      text = `${result.team1} ${result.score1} - ${result.score2} ${result.team2} \u2014 ${outcome}`;
    }
    navigator.clipboard?.writeText(text);
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

  if (phase === 'setup') {
    return (
      <div className={`min-h-screen px-6 py-10 mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>
        <div className="max-w-2xl mx-auto">
          {saveWarning && (
            <div className="mono-card mb-4" style={{ padding: '10px 12px', borderColor: '#dc2626', color: '#dc2626' }}>
              {saveWarning}
            </div>
          )}
          {/* Header */}
          <nav className="flex items-center gap-4 mb-6">
            <button
              onClick={() => {
                if (setupStep > 1) { setSetupStep(setupStep - 1); }
                else { navigate(-1); }
              }}
              className="text-sm bg-transparent border-none cursor-pointer font-swiss"
              style={{ color: '#888' }}
              aria-label={setupStep > 1 ? 'Go back to previous step' : 'Go back'}
            >
              <BackArrow />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#111' }}>
                {sportConfig?.icon || '\u{1F3D0}'} Quick Match
              </h1>
              <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                Step {setupStep} of {totalSteps} &middot; {currentStepLabel}
              </p>
            </div>
          </nav>

          {/* Step progress bar */}
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
                          className="mono-card text-left"
                          style={{
                            padding: '16px',
                            cursor: 'pointer',
                            border: isSelected ? '2px solid #0066ff' : '1px solid #eee',
                            background: isSelected ? '#f0f6ff' : '#fff',
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
                      className="mono-card flex-1 text-left"
                      style={{
                        padding: '16px',
                        cursor: 'pointer',
                        border: formatMode === 'standard' ? '2px solid #0066ff' : '1px solid #eee',
                        background: formatMode === 'standard' ? '#f0f6ff' : '#fff',
                      }}
                    >
                      <p className="text-sm font-semibold mb-1" style={{ color: '#111' }}>Standard</p>
                      <p className="text-xs" style={{ color: '#888' }}>Official rules for {sportConfig?.name || 'this sport'}</p>
                    </button>
                    <button
                      onClick={() => setFormatMode('custom')}
                      className="mono-card flex-1 text-left"
                      style={{
                        padding: '16px',
                        cursor: 'pointer',
                        border: formatMode === 'custom' ? '2px solid #0066ff' : '1px solid #eee',
                        background: formatMode === 'custom' ? '#f0f6ff' : '#fff',
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
                onClick={() => setSetupStep(hasRulesStep ? 2 : 2)}
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
                <div className="mono-card mb-6 flex items-center gap-3" style={{ padding: '12px 16px', background: '#f8f9fa' }}>
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
              <div className="mono-card mb-6" style={{ padding: '12px 16px', background: '#f8f9fa' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{sportConfig?.icon || '\u{1F3D0}'}</span>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#111' }}>
                        {isCricket && selectedCricketFormat ? selectedCricketFormat.name : sportConfig?.name}
                      </p>
                      <p className="text-xs font-mono" style={{ color: '#888' }}>
                        {isCricket ? (
                          <>
                            {format.overs ? `${format.overs} ov` : format.trackOvers === false ? `${format.maxBalls || '\u221E'} balls` : 'Unlimited'}
                            {' \u00B7 '}
                            {format.players || 6}p
                            {' \u00B7 '}
                            {(format.totalInnings || 2) === 4 ? '2 inn/side' : '1 inn/side'}
                          </>
                        ) : (
                          formatMode === 'standard' ? 'Standard rules' : 'Custom rules'
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSetupStep(1)}
                    className="text-xs bg-transparent border-none cursor-pointer"
                    style={{ color: '#0066ff' }}
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Team names */}
              <div className="mb-8">
                <label className="text-xs uppercase tracking-widest font-normal mb-4 block" style={{ color: '#888' }}>
                  Team Names
                </label>

                {/* Team 1 */}
                <div ref={team1Ref} className="relative">
                  <input
                    type="text"
                    className="mono-input mb-1"
                    placeholder="Team 1 name"
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
                <button
                  type="button"
                  onClick={() => setShowTeam1Roster(v => !v)}
                  className="text-xs bg-transparent border-none cursor-pointer font-swiss mb-3 block"
                  style={{ color: '#0066ff', padding: 0 }}
                >
                  {showTeam1Roster ? '− Hide players' : '+ Add players'}
                  {team1Players.length > 0 && !showTeam1Roster && (
                    <span style={{ color: '#888', marginLeft: 4 }}>({team1Players.length})</span>
                  )}
                </button>
                {showTeam1Roster && (
                  <div className="mb-4" style={{ paddingLeft: 8, borderLeft: '2px solid #eee' }}>
                    <PlayerSearchInput
                      players={team1Players}
                      onAdd={p => setTeam1Players(prev => [...prev, p])}
                      onRemove={i => setTeam1Players(prev => prev.filter((_, idx) => idx !== i))}
                      placeholder="Search @username or type name"
                    />
                  </div>
                )}

                {/* Team 2 */}
                <div ref={team2Ref} className="relative">
                  <input
                    type="text"
                    className="mono-input mb-1"
                    placeholder="Team 2 name"
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
                  onClick={() => setShowTeam2Roster(v => !v)}
                  className="text-xs bg-transparent border-none cursor-pointer font-swiss mb-3 block"
                  style={{ color: '#0066ff', padding: 0 }}
                >
                  {showTeam2Roster ? '− Hide players' : '+ Add players'}
                  {team2Players.length > 0 && !showTeam2Roster && (
                    <span style={{ color: '#888', marginLeft: 4 }}>({team2Players.length})</span>
                  )}
                </button>
                {showTeam2Roster && (
                  <div className="mb-4" style={{ paddingLeft: 8, borderLeft: '2px solid #eee' }}>
                    <PlayerSearchInput
                      players={team2Players}
                      onAdd={p => setTeam2Players(prev => [...prev, p])}
                      onRemove={i => setTeam2Players(prev => prev.filter((_, idx) => idx !== i))}
                      placeholder="Search @username or type name"
                    />
                  </div>
                )}
              </div>

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
                style={{ padding: '12px', fontSize: '0.9375rem', opacity: team1Name.trim() && team2Name.trim() ? 1 : 0.4 }}
                disabled={!team1Name.trim() || !team2Name.trim()}
              >
                Start Match
              </button>
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
  const scoringUnit = sportConfig?.config?.scoringUnit || 'point';

  // Cricket scoring helpers
  const showOvers = !isCricket || format.trackOvers !== false;
  const formatPreset = isCricket && format?.preset ? getCricketFormat(format.preset) : null;
  const presetLabel = formatPreset?.name || '';

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
            {saveWarning && (
              <div className="mono-card mb-4" style={{ padding: '10px 12px', borderColor: '#dc2626', color: '#dc2626' }}>
                {saveWarning}
              </div>
            )}
            {/* Top bar */}
            <div className="flex items-center justify-between mb-6">
              <button onClick={endMatchManually} className="text-sm bg-transparent border-none cursor-pointer font-swiss" style={{ color: '#dc2626' }}>
                End Match
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono" style={{ color: '#888' }}>{timer.formatted}</span>
                {presetLabel && <span className="mono-badge">{presetLabel}</span>}
                {isRefereeing && <span className="text-xs" style={{ color: '#888' }}>Referee&nbsp;&middot;</span>}
                <span className="mono-badge mono-badge-live">Innings {innings}</span>
              </div>
            </div>

            {/* Gully rule indicators */}
            {format.oneTipOneHand && (
              <p className="text-xs text-center mb-2" style={{ color: '#888' }}>One tip one hand active</p>
            )}

            {/* Trial ball banner */}
            {showTrialBall && (
              <div className="mono-card text-center mb-4" style={{ padding: '12px 16px', borderColor: '#0066ff' }}>
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
                <div className="mono-card mt-3 mb-1" style={{ padding: '8px 16px', borderColor: '#ff6b00', backgroundColor: '#fff8f0' }}>
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
            <div className="mono-card text-center mb-8" style={{ padding: '12px 16px' }}>
              <p className="text-xs" style={{ color: '#888' }}>
                {otherName}: {otherScore.runs}/{otherScore.wickets} ({otherOversDisplay})
              </p>
            </div>

            {/* Run buttons */}
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {[0, 1, 2, 3, 4, 5, 6].map(r => (
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
              style={{ padding: '14px', fontSize: '0.9375rem', borderColor: '#dc2626', color: '#dc2626', touchAction: 'manipulation' }}
            >
              {freeHit ? 'Run Out Only' : 'Wicket'}
            </button>

            {/* Undo */}
            {cricketHistory.length > 0 && (
              <button
                onClick={undoCricketAction}
                className="mono-btn w-full mt-3"
                style={{ padding: '10px', fontSize: '0.8125rem' }}
              >
                Undo last
              </button>
            )}
          </div>
        </div>
      );
    }

    // Side swap helpers — visual left/right, data stays the same
    const leftTeam = sidesSwapped ? 2 : 1;
    const rightTeam = sidesSwapped ? 1 : 2;
    const leftName = sidesSwapped ? team2Name : team1Name;
    const rightName = sidesSwapped ? team1Name : team2Name;

    const handleSwap = () => setSidesSwapped(prev => !prev);

    // Goals-based scoring
    if (isGoals) {
      const leftScore = sidesSwapped ? gScore2 : gScore1;
      const rightScore = sidesSwapped ? gScore1 : gScore2;

      return (
        <div className="min-h-screen px-6 py-10">
          <div className="max-w-2xl mx-auto">
            {saveWarning && (
              <div className="mono-card mb-4" style={{ padding: '10px 12px', borderColor: '#dc2626', color: '#dc2626' }}>
                {saveWarning}
              </div>
            )}
            {/* Top bar */}
            <div className="flex items-center justify-between mb-6">
              <button onClick={endMatchManually} className="text-sm bg-transparent border-none cursor-pointer font-swiss" style={{ color: '#dc2626' }}>
                End Match
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono" style={{ color: timerColor }}>
                  {isTimeUp ? "Time's up!" : timerDisplay}
                </span>
                <SwapButton onSwap={handleSwap} />
              </div>
              <div className="flex items-center gap-2">
                {isRefereeing && <span className="text-xs" style={{ color: '#888' }}>Referee&nbsp;&middot;</span>}
                <span className="mono-badge mono-badge-live">
                  {isPointsMode ? `First to ${format.target}` : 'Live'}
                </span>
              </div>
            </div>

            {/* Score panels */}
            <div className="flex items-stretch gap-4 mb-6" style={{ minHeight: hasQuickButtons ? '180px' : '250px' }}>
              {/* Left team */}
              <div
                className={`flex-1 flex flex-col items-center justify-center mono-card ${!hasQuickButtons ? 'cursor-pointer' : ''}`}
                onClick={!hasQuickButtons ? () => addGoal(leftTeam) : undefined}
                style={{ padding: '24px 16px', touchAction: 'manipulation' }}
              >
                <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#888' }}>
                  {leftName}
                </p>
                <p className="text-6xl font-bold font-mono mono-score" style={{ color: '#111' }}>
                  {leftScore}
                </p>
                {!hasQuickButtons && (
                  <p className="text-xs mt-3" style={{ color: '#bbb' }}>Tap to score</p>
                )}
              </div>

              {/* Right team */}
              <div
                className={`flex-1 flex flex-col items-center justify-center mono-card ${!hasQuickButtons ? 'cursor-pointer' : ''}`}
                onClick={!hasQuickButtons ? () => addGoal(rightTeam) : undefined}
                style={{ padding: '24px 16px', touchAction: 'manipulation' }}
              >
                <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#888' }}>
                  {rightName}
                </p>
                <p className="text-6xl font-bold font-mono mono-score" style={{ color: '#111' }}>
                  {rightScore}
                </p>
                {!hasQuickButtons && (
                  <p className="text-xs mt-3" style={{ color: '#bbb' }}>Tap to score</p>
                )}
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

            {/* Undo */}
            {gScoreHistory.length > 0 && (
              <button
                onClick={undoGoal}
                className="mono-btn w-full"
                style={{ padding: '10px', fontSize: '0.8125rem' }}
              >
                Undo last
              </button>
            )}

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
    const leftSetScore = sport === 'tennis'
      ? formatTennisPointScore(rawLeftSetScore, rawRightSetScore)
      : rawLeftSetScore;
    const rightSetScore = sport === 'tennis'
      ? formatTennisPointScore(rawRightSetScore, rawLeftSetScore)
      : rawRightSetScore;

    return (
      <div className="min-h-screen px-6 py-10">
        <div className="max-w-2xl mx-auto">
          {saveWarning && (
            <div className="mono-card mb-4" style={{ padding: '10px 12px', borderColor: '#dc2626', color: '#dc2626' }}>
              {saveWarning}
            </div>
          )}
          <div className="flex items-center justify-between mb-6">
            <button onClick={endMatchManually} className="text-sm bg-transparent border-none cursor-pointer font-swiss" style={{ color: '#dc2626' }}>
              End Match
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono" style={{ color: '#888' }}>{timer.formatted}</span>
              <SwapButton onSwap={() => setSidesSwapped(prev => !prev)} />
            </div>
            <div className="flex items-center gap-2">
              {isRefereeing && <span className="text-xs" style={{ color: '#888' }}>Referee&nbsp;&middot;</span>}
              <span className="mono-badge mono-badge-live">
                {format.type === 'best-of' ? `Set ${currentSet + 1} of ${format.sets}` : `First to ${format.target}`}
              </span>
            </div>
          </div>

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

          <div className="flex items-stretch gap-4 mb-8" style={{ minHeight: '250px' }}>
            {/* Left team */}
            <div
              className="flex-1 flex flex-col items-center justify-center cursor-pointer mono-card"
              onClick={() => addPoint(leftTeam)}
              style={{ padding: '24px 16px', touchAction: 'manipulation' }}
            >
              <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#888' }}>
                {leftName}
              </p>
              <p className="text-6xl font-bold font-mono mono-score" style={{ color: '#111' }}>
                {leftSetScore}
              </p>
              <p className="text-xs mt-4" style={{ color: '#bbb' }}>Tap to score</p>
            </div>

            {/* Right team */}
            <div
              className="flex-1 flex flex-col items-center justify-center cursor-pointer mono-card"
              onClick={() => addPoint(rightTeam)}
              style={{ padding: '24px 16px', touchAction: 'manipulation' }}
            >
              <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#888' }}>
                {rightName}
              </p>
              <p className="text-6xl font-bold font-mono mono-score" style={{ color: '#111' }}>
                {rightSetScore}
              </p>
              <p className="text-xs mt-4" style={{ color: '#bbb' }}>Tap to score</p>
            </div>
          </div>

          {/* Undo */}
          {vScoreHistory.length > 0 && (
            <button
              onClick={undoPoint}
              className="mono-btn w-full mb-4"
              style={{ padding: '10px', fontSize: '0.8125rem' }}
            >
              Undo last
            </button>
          )}

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
          <div className="mono-card mb-4" style={{ padding: '10px 12px', borderColor: '#dc2626', color: '#dc2626' }}>
            {saveWarning}
          </div>
        )}
        {isAuthenticated && syncState !== 'idle' && (
          <div
            className="mono-card mb-4"
            style={{
              padding: '10px 12px',
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

        {/* Scorecard */}
        <div className="mono-card mb-8" style={{ padding: '20px 24px' }}>
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

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={() => navigate('/')} className="mono-btn flex-1" style={{ padding: '12px' }}>
            Home
          </button>
          <button onClick={shareResult} className="mono-btn flex-1" style={{ padding: '12px' }}>
            Copy Result
          </button>
          <button
            onClick={() => {
              restoredDraftRef.current = false;
              setPhase('setup');
              setScores({ team1: { runs: 0, balls: 0, wickets: 0, allOut: false }, team2: { runs: 0, balls: 0, wickets: 0, allOut: false } });
              setVScore1(0);
              setVScore2(0);
              setGScore1(0);
              setGScore2(0);
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
              resetSync();
              clearData(quickMatchDraftKey);
              timer.reset();
              startedAtRef.current = null;
            }}
            className="mono-btn-primary flex-1"
            style={{ padding: '12px' }}
          >
            New Match
          </button>
        </div>
      </div>
    </div>
  );
}















import { BoardBar, BoardHeader, BoardOptionsSheet, BoardSheetGroup } from './BoardShell';
import { useTeamColours } from './useTeamColours';
import { sportIdentity } from '../../../lib/sportIdentity';
import './cricketBoard.css';
import { useScoringProgress } from './scoringProgressContext';
import { useMatchCompletion } from '../../../hooks/useMatchCompletion';
import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { loadSportTournaments, saveSportTournament, loadQuickMatch, saveQuickMatch, deleteQuickMatch } from '../../../utils/storage';
import { ballsToOvers, calculateRunRate, getMaxWickets, canEnforceFollowOn, getTestMatchCompletion, isTestInningsComplete } from '../../../utils/cricketCalculations';
import { migrateCricketFormat } from '../../../utils/formatMigration';
import { getSportById } from '../../../models/sportRegistry';
import { updateMatchInTournament } from '../../../utils/knockoutManager';
import { useAuth } from '../../../hooks/useAuth';
import { buildTournamentConvexPayload, normalizeNonTeamWinner } from '../../../utils/tournamentSync';
import { CRICKET_RUN_VALUES, isCricketRunKey } from '../../../utils/cricketRunControls';
import { useAppScoringPrompt } from '../components/AppScoringPrompt';
import { useLiveBroadcast } from '../../../hooks/useLiveBroadcast';
import { getConsent } from '../../../lib/live/liveSession';
import LiveBroadcastBar from '../live/LiveBroadcastBar';
import { useScoringCompletion } from './scoringCompletionContext';

const isTouchDevice = 'ontouchstart' in globalThis || navigator.maxTouchPoints > 0;

const triggerHaptic = (pattern) => {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
};

const ORDINALS = ['1st', '2nd', '3rd', '4th'];

export default function MonoCricketTestLiveScore({ storageMode }) {
  const navigate = useNavigate();
  const completeProtectedScoring = useScoringCompletion();
  const { sport, id, matchId } = useParams();
  const sportConfig = getSportById(sport || 'cricket');
  const isQuickMatch = storageMode === 'quick';
  const { isAuthenticated } = useAuth();
  const saveMatchMutation = useMutation(api.matches.save);

  // Core state
  const [tournament, setTournament] = useState(null);
  const [match, setMatch] = useState(null);
  const [format, setFormat] = useState(null);

  // Innings state — 4 innings for test
  const [innings, setInnings] = useState([
    { teamId: null, runs: 0, balls: 0, wickets: 0, allOut: false, declared: false },
    { teamId: null, runs: 0, balls: 0, wickets: 0, allOut: false, declared: false },
    { teamId: null, runs: 0, balls: 0, wickets: 0, allOut: false, declared: false },
    { teamId: null, runs: 0, balls: 0, wickets: 0, allOut: false, declared: false },
  ]);
  const [currentInningsIndex, setCurrentInningsIndex] = useState(0);
  const [followOnEnforced, setFollowOnEnforced] = useState(false);
  const [followOnPrompt, setFollowOnPrompt] = useState(false);
  const [terminalSnapshot, setTerminalSnapshot] = useState(null);
  const terminalSnapshotRef = useRef(null);
  const matchComplete = Boolean(terminalSnapshot);
  const matchResult = terminalSnapshot?.result;
  const [history, setHistory] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Live broadcast (dkt/b0z/6fj/87d): mirror each ball/undo to the public watch
  // page. Cricket maps to the generic snapshot as: each team's CUMULATIVE runs ->
  // pointsA/B, current innings -> currentUnit, batting line -> periodLabel.
  // Additive — localStorage authoritative; gated on consent, no-ops when off.
  const [liveEnabled, setLiveEnabled] = useState(() => getConsent() === 'accepted');
  const live = useLiveBroadcast({ enabled: liveEnabled });
  const liveRef = useRef(live);
  liveRef.current = live;
  const liveClientMatchId = isQuickMatch
    ? `${sport || 'cricket'}:quick:${matchId}`
    : `${sport || 'cricket'}:${id}:${matchId}`;
  const broadcastIntentRef = useRef(null);
  const [saveWarning, setSaveWarning] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const completion = useMatchCompletion();
  const scoringPrompt = useAppScoringPrompt(completion);

  const inningsRef = useRef(innings);
  inningsRef.current = innings;
  const stageCompletion = (next, result) => {
    // Result persistence and failed-save recovery own this same settled snapshot.
    const snapshot = structuredClone({ innings: next, currentInningsIndex, followOnEnforced, result, autoSave: true });
    completion.lock();
    terminalSnapshotRef.current = snapshot;
    setTerminalSnapshot(snapshot);
  };
  const commitInnings = (update, advance = false) => {
    if (completion.locked || terminalSnapshotRef.current) return;
    const next = typeof update === 'function' ? update(inningsRef.current) : update;
    const result = advance ? getTestMatchCompletion(next, currentInningsIndex, match?.team1Id, match?.team2Id, format) : null;
    if (result) stageCompletion(next, result);
    else if (advance && isTestInningsComplete(next[currentInningsIndex], format)) advanceInnings(next);
    inningsRef.current = next;
    setInnings(next);
  };

  const lastClickRef = useRef(0);
  const isKnockoutRef = useRef(false);

  const saveTournamentToConvex = (updatedTournament) => {
    if (!isAuthenticated || !updatedTournament) return;
    const savedMatch = [...(updatedTournament.matches || []), ...(updatedTournament.knockoutMatches || [])]
      .find((m) => m.id === matchId || m.id === Number(matchId));
    if (!savedMatch) return;
    try {
      const payload = buildTournamentConvexPayload({
        sportId: sport || 'cricket',
        tournament: updatedTournament,
        match: savedMatch,
      });
      saveMatchMutation(payload).catch(() => {});
    } catch {
      // Local save is primary; sync failures are non-blocking.
    }
  };

  // Load match data
  const { scoringStarted } = useScoringProgress(
    innings.some(innings => innings.balls > 0 || innings.runs > 0 || innings.wickets > 0),
    false, match?.draftState?.scoringStarted, `${sport}:${storageMode}:${id}:${matchId}`,
  );

  useEffect(() => {
    let loaded;
    let found = null;
    isKnockoutRef.current = false;
    if (isQuickMatch) {
      loaded = loadQuickMatch(matchId);
    } else {
      const storageKey = sportConfig?.storageKey || 'se_cricket';
      const tournaments = loadSportTournaments(storageKey);
      found = tournaments.find(t => t.id === Number(id) || t.id === id);
      if (!found) return;
      loaded = found.matches.find(m => m.id === matchId || m.id === Number(matchId));
      if (!loaded) {
        loaded = (found.knockoutMatches || []).find(m => m.id === matchId || m.id === Number(matchId));
        isKnockoutRef.current = Boolean(loaded);
      }
    }
    if (!loaded) return;

    const committed = completion.hydrate(loaded, `${sport}:${storageMode || 'tournament'}:${id}:${matchId}`);
    const draft = committed ? null : loaded.draftState;
    const initInnings = [loaded.team1Id, loaded.team2Id, loaded.team1Id, loaded.team2Id]
      .map(teamId => ({ teamId, runs: 0, balls: 0, wickets: 0, allOut: false, declared: false }));
    const restored = draft?.innings || (loaded.innings?.length === 4 ? loaded.innings : initInnings);
    const lastPlayed = restored.reduce((last, inn, index) =>
      inn.runs || inn.balls || inn.wickets || inn.allOut || inn.declared ? index : last, 0);
    const winner = isQuickMatch && loaded.winner && loaded.winner === (loaded.team1Name || loaded.team1) ? loaded.team1Id
      : isQuickMatch && loaded.winner && loaded.winner === (loaded.team2Name || loaded.team2) ? loaded.team2Id : loaded.winner;
    const restoredFormat = migrateCricketFormat(loaded.format || (isKnockoutRef.current && found?.knockoutConfig?.format) || found?.format);
    const restoredIndex = draft?.currentInningsIndex ?? loaded.currentInningsIndex ?? lastPlayed;
    const restoredFollowOn = draft?.followOnEnforced ?? loaded.followOnEnforced ?? false;
    const result = committed ? { winner, desc: loaded.winDesc || 'Match Complete' }
      : getTestMatchCompletion(restored, restoredIndex, loaded.team1Id, loaded.team2Id, restoredFormat, draft?.result);
    const snapshot = result ? structuredClone({ innings: restored, currentInningsIndex: restoredIndex,
      followOnEnforced: restoredFollowOn, result, autoSave: false }) : null;
    if (snapshot && !committed) completion.lock();
    terminalSnapshotRef.current = snapshot;
    setTerminalSnapshot(snapshot);
    setSaveWarning(snapshot && !committed ? 'Result not saved. Save & Return to retry.' : '');

    setTournament(found);
    setMatch(loaded);
    setFormat(restoredFormat);
    // Hydration publishes the stored snapshot; scoring updates remain lock-checked.
    inningsRef.current = restored;
    setInnings(restored);
    setCurrentInningsIndex(restoredIndex);
    setFollowOnEnforced(restoredFollowOn);
    setHistory(draft?.history || []);
    if (committed && isQuickMatch) completion.leave(finishScoring);
  }, [id, matchId, sport, storageMode]);

  // Derived values
  const maxWickets = format ? getMaxWickets(format) : 10;
  const currentInning = innings[currentInningsIndex];

  // Team name helper
  const getTeamName = (teamId) => {
    if (isQuickMatch && match) {
      if (teamId === match.team1Id) return match.team1Name;
      if (teamId === match.team2Id) return match.team2Name;
      return 'Unknown';
    }
    if (tournament) return tournament.teams.find(t => t.id === teamId)?.name || 'Unknown';
    return 'Unknown';
  };

  const team1Id = match?.team1Id;
  const team2Id = match?.team2Id;
  const colourStyle = useTeamColours(match?.team1Color || tournament?.teams?.find(t => t.id === team1Id)?.color, match?.team2Color || tournament?.teams?.find(t => t.id === team2Id)?.color, 'cricket');
  const team1Name = getTeamName(team1Id);
  const team2Name = getTeamName(team2Id);

  // Broadcast the latest ball/undo AFTER its state commits (§87d snapshot).
  // pointsA/pointsB are each team's CUMULATIVE runs across innings; currentUnit
  // is the current innings; periodLabel is the batting side's live line.
  useEffect(() => {
    const intent = broadcastIntentRef.current;
    if (!intent) return;
    broadcastIntentRef.current = null;

    const sumRuns = (teamId) =>
      innings.reduce((acc, inn) => acc + (inn.teamId === teamId ? inn.runs : 0), 0);
    const inn = innings[currentInningsIndex] || { runs: 0, wickets: 0, balls: 0, teamId: null };
    const battingName = inn.teamId === team2Id ? team2Name : team1Name;
    const snapshot = {
      pointsA: sumRuns(team1Id),
      pointsB: sumRuns(team2Id),
      setsA: 0,
      setsB: 0,
      setScores: [],
      servingTeam: undefined,
      currentUnit: currentInningsIndex + 1,
      periodLabel: `${(battingName || '').slice(0, 18)} ${inn.runs}/${inn.wickets} (${ballsToOvers(inn.balls)} ov)`,
    };
    if (intent.kind === 'undo') {
      liveRef.current.undo({ at: intent.at, snapshot });
    } else {
      liveRef.current.point({ team: intent.team, value: intent.value, at: intent.at, snapshot });
    }
  }, [innings, currentInningsIndex, team1Id, team2Id, team1Name, team2Name]);

  // Totals
  const getTeamTotal = (teamId) => innings.filter(i => i.teamId === teamId).reduce((s, i) => s + (i.runs || 0), 0);

  const t1Total = team1Id ? getTeamTotal(team1Id) : 0;
  const t2Total = team2Id ? getTeamTotal(team2Id) : 0;

  // Contextual info
  const getContextLine = () => {
    if (!currentInning || !team1Id) return '';
    const battingTeamId = currentInning.teamId;
    const battingTotal = getTeamTotal(battingTeamId);
    const bowlingTeamId = battingTeamId === team1Id ? team2Id : team1Id;
    const bowlingTotal = getTeamTotal(bowlingTeamId);

    if (currentInningsIndex === 0) return '';
    const diff = battingTotal - bowlingTotal;
    if (diff > 0) return `Lead by ${diff} runs`;
    if (diff < 0) return `Trail by ${Math.abs(diff)} runs`;
    return 'Scores level';
  };

  // Save snapshot
  const saveSnapshot = () => {
    setHistory(prev => [...prev, {
      innings: structuredClone(innings),
      currentInningsIndex,
      followOnEnforced,
    }].slice(-100));
    setHasChanges(true);
  };

  // Advance to next innings
  const advanceInnings = (updatedInnings) => {
    if (completion.locked) return;
    const nextIndex = currentInningsIndex + 1;

    // Check follow-on after innings 2
    if (currentInningsIndex === 1 && !followOnEnforced) {
      const t1Runs = updatedInnings[0].runs;
      const t2Runs = updatedInnings[1].runs;
      if (canEnforceFollowOn(t1Runs, t2Runs)) {
        setFollowOnPrompt(true);
        return;
      }
    }

    setCurrentInningsIndex(nextIndex);
  };

  // Handle follow-on decision
  const handleFollowOn = (enforce) => {
    setFollowOnPrompt(false);
    if (enforce) {
      setFollowOnEnforced(true);
      // Swap team assignments for innings 3 & 4
      commitInnings(prev => {
        const updated = [...prev];
        updated[2] = { ...updated[2], teamId: team2Id };
        updated[3] = { ...updated[3], teamId: team1Id };
        return updated;
      });
    }
    setCurrentInningsIndex(2);
  };

  // Add runs
  const addRuns = (runs) => {
    if (!format || matchComplete || scoringPrompt.isInteractionLocked) return;
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;

    if (runs === 4 || runs === 6) triggerHaptic([50, 50, 50]);
    else triggerHaptic(50);

    // Mirror this ball to the live broadcast; snapshot built post-commit.
    broadcastIntentRef.current = { kind: 'point', team: innings[currentInningsIndex]?.teamId === team2Id ? 'B' : 'A', value: runs, at: Date.now() };

    saveSnapshot();

    commitInnings(prev => {
      const updated = [...prev];
      const inn = { ...updated[currentInningsIndex] };
      inn.runs += runs;
      inn.balls += 1;
      updated[currentInningsIndex] = inn;

      return updated;
    }, true);
  };

  // Add wicket
  const addWicket = () => {
    if (!format || matchComplete || scoringPrompt.isInteractionLocked) return;
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;

    triggerHaptic([80, 80, 80]);
    // A wicket scores 0 runs on the ball.
    broadcastIntentRef.current = { kind: 'point', team: innings[currentInningsIndex]?.teamId === team2Id ? 'B' : 'A', value: 0, at: Date.now() };
    saveSnapshot();

    commitInnings(prev => {
      const updated = [...prev];
      const inn = { ...updated[currentInningsIndex] };
      inn.wickets += 1;
      inn.balls += 1;

      if (inn.wickets >= maxWickets) {
        inn.allOut = true;
      }
      updated[currentInningsIndex] = inn;
      return updated;
    }, true);
  };

  // Add extra
  const addExtra = (type) => {
    if (!format || matchComplete || scoringPrompt.isInteractionLocked) return;
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;

    triggerHaptic(30);
    // An extra adds 1 run on the ball.
    broadcastIntentRef.current = { kind: 'point', team: innings[currentInningsIndex]?.teamId === team2Id ? 'B' : 'A', value: 1, at: Date.now() };
    saveSnapshot();

    // Byes and leg byes are legal deliveries — they consume a ball;
    // wides and no balls do not.
    const countsAsBall = type === 'bye' || type === 'legBye';

    commitInnings(prev => {
      const updated = [...prev];
      const inn = { ...updated[currentInningsIndex] };
      inn.runs += 1;
      if (countsAsBall) inn.balls += 1;
      updated[currentInningsIndex] = inn;

      return updated;
    }, true);
  };

  // Declaration
  const handleDeclare = () => {
    if (matchComplete || scoringPrompt.isInteractionLocked) return;
    const inn = innings[currentInningsIndex];
    scoringPrompt.requestPrompt({
      cancelLabel: 'Keep batting',
      confirmLabel: 'Declare',
      message: `Declare at ${inn.runs}/${inn.wickets} (${ballsToOvers(inn.balls)} ov)?`,
      title: 'Declare innings?',
      type: 'declare',
    });
  };

  const confirmDeclare = () => {
    saveSnapshot();

    commitInnings(prev => {
      const updated = [...prev];
      updated[currentInningsIndex] = { ...updated[currentInningsIndex], declared: true };
      return updated;
    }, true);
  };

  // Draw
  const handleDraw = () => {
    if (scoringPrompt.isInteractionLocked) return;
    scoringPrompt.requestPrompt({
      cancelLabel: 'Keep scoring',
      confirmLabel: 'End as draw',
      message: 'No winner will be declared for this match.',
      title: 'End match as a draw?',
      type: 'draw',
    });
  };

  const confirmDraw = () => {
    stageCompletion(inningsRef.current, { winner: 'draw', desc: 'Match Drawn' });
  };

  // Undo
  const undo = () => {
    if (history.length === 0 || matchComplete || scoringPrompt.isInteractionLocked) return;
    broadcastIntentRef.current = { kind: 'undo', at: Date.now() };
    const last = history[history.length - 1];
    commitInnings(last.innings);
    setCurrentInningsIndex(last.currentInningsIndex);
    setFollowOnEnforced(last.followOnEnforced);
    setHistory(prev => prev.slice(0, -1));
  };

  // Save draft
  const saveDraft = () => {
    if (scoringPrompt.isInteractionLocked) return;

    const draftState = {
      scoringStarted,
      innings: structuredClone(innings),
      currentInningsIndex,
      followOnEnforced,
      history: structuredClone(history.slice(-50)),
      savedAt: new Date().toISOString(),
    };

    if (isQuickMatch) {
      const ok = saveQuickMatch({ ...match, draftState, status: 'in-progress' });
      if (!ok) {
        setSaveWarning('Save failed - storage may be full. Export your data.');
        return;
      }
    } else {
      const storageKey = sportConfig?.storageKey || 'se_cricket';
      const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
        ...m, draftState, status: 'in-progress',
      }));
      const ok = saveSportTournament(storageKey, updatedTournament);
      if (!ok) {
        setSaveWarning('Save failed - storage may be full. Export your data.');
        return;
      }
    }

    setSaveWarning('');
    setHasChanges(false);
    scoringPrompt.scheduleDraftRedirect(() => navigateBack());
  };

  // Persist the terminal state before finalizing its broadcast. In particular,
  // the winning ball must survive a refresh on the result screen.
  const persistCompleteMatch = (snapshot = terminalSnapshotRef.current) => {
    const { innings, currentInningsIndex, followOnEnforced, result } = snapshot;
    const winner = result.winner || null;
    const winDesc = result.desc || '';
    const completedAt = new Date().toISOString();
    const team1Total = innings.filter(i => i.teamId === team1Id).reduce((s, i) => s + (i.runs || 0), 0);
    const team2Total = innings.filter(i => i.teamId === team2Id).reduce((s, i) => s + (i.runs || 0), 0);
    const winnerLabel = winner === team1Id
      ? team1Name
      : winner === team2Id
        ? team2Name
        : normalizeNonTeamWinner(winner);

    if (isQuickMatch) {
      const ok = saveQuickMatch({
        ...match,
        team1: team1Name,
        team2: team2Name,
        innings,
        currentInningsIndex,
        score1: team1Total,
        score2: team2Total,
        winner: winnerLabel,
        winDesc,
        status: 'completed',
        followOnEnforced,
        draftState: undefined,
        date: completedAt,
        completedAt,
      });
      if (!ok) {
        setSaveWarning('Save failed - storage may be full. Export your data.');
        return false;
      }
    } else {
      const storageKey = sportConfig?.storageKey || 'se_cricket';
      const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
        ...m,
        innings,
        currentInningsIndex,
        winner,
        winDesc,
        status: 'completed',
        followOnEnforced,
        draftState: undefined,
        completedAt,
      }));
      const ok = saveSportTournament(storageKey, updatedTournament);
      if (!ok) {
        setSaveWarning('Save failed - storage may be full. Export your data.');
        return false;
      }
      saveTournamentToConvex(updatedTournament);
    }

    setSaveWarning('');
    liveRef.current.finalize();
    return true;
  };

  const saveCompleteMatch = () => {
    if (scoringPrompt.pendingPrompt) return;
    if (completion.committed) {
      completion.leave(finishScoring);
      return;
    }
    completion.complete(persistCompleteMatch, finishScoring);
  };

  useEffect(() => {
    if (terminalSnapshot?.autoSave) completion.complete(persistCompleteMatch);
  }, [terminalSnapshot]);

  const navigateBack = () => {
    if (isQuickMatch) {
      navigate(`/${sport || 'cricket'}/quick`);
    } else {
      navigate(`/${sport || 'cricket'}/tournament/${id}`);
    }
  };

  const discardAndExit = () => {
    if (completion.locked) return;
    if (isQuickMatch) {
      // Discarding a quick match throws it away — remove the record from
      // se_quickmatches entirely. Writing back a 'pending' shell would leave the
      // dashboard/app-entry treating the discarded scoreless draft as recent
      // activity and keep the user stuck in returning-player mode.
      deleteQuickMatch(match.id);
    } else if (tournament) {
      const storageKey = sportConfig?.storageKey || 'se_cricket';
      const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
        ...m,
        status: Array.isArray(m.innings) && m.innings.some((inn) =>
          inn.runs || inn.balls || inn.wickets || inn.allOut || inn.declared
        ) ? m.status : 'pending',
        draftState: undefined,
      }));
      saveSportTournament(storageKey, updatedTournament);
    }
    navigateBack();
  };

  const handleDiscard = () => {
    scoringPrompt.requestPrompt({
      cancelLabel: 'Keep scoring',
      confirmLabel: 'Discard',
      message: `Delete ${team1Name} v ${team2Name}, ${currentInning?.runs || 0}/${currentInning?.wickets || 0} in innings ${currentInningsIndex + 1}? This can't be undone.`,
      tone: 'danger',
      title: 'Discard match?',
      type: 'discard',
    });
  };

  const finishScoring = () => {
    const destination = isQuickMatch
      ? `/${sport || 'cricket'}/quick?result=${encodeURIComponent(matchId)}`
      : `/${sport || 'cricket'}/tournament/${id}`;
    if (completeProtectedScoring) {
      completeProtectedScoring(destination);
    } else {
      navigate(destination, { replace: true });
    }
  };

  const handleFinish = () => {
    if (scoringPrompt.isInteractionLocked) return;
    const snapshot = structuredClone({
      innings: inningsRef.current,
      currentInningsIndex,
      followOnEnforced,
      result: getTestMatchCompletion(inningsRef.current, currentInningsIndex, team1Id, team2Id, format)
        || { winner: 'draw', desc: 'Match Drawn' },
    });
    completion.complete(() => persistCompleteMatch(snapshot), finishScoring);
  };

  // Continuous auto-save
  useEffect(() => {
    // A failed terminal save still needs the settled winning innings as a draft.
    if (completion.committed || !match || !format) return;
    if (history.length === 0 && !terminalSnapshot && !scoringStarted) return;
    const settled = terminalSnapshot || { innings, currentInningsIndex, followOnEnforced };
    const draftState = {
      scoringStarted,
      innings: structuredClone(settled.innings),
      currentInningsIndex: settled.currentInningsIndex,
      followOnEnforced: settled.followOnEnforced,
      history: structuredClone(history.slice(-50)),
      result: terminalSnapshot?.result,
      savedAt: new Date().toISOString(),
    };
    if (isQuickMatch) {
      saveQuickMatch({ ...match, draftState, status: 'in-progress' });
    } else if (tournament) {
      const storageKey = sportConfig?.storageKey || 'se_cricket';
      const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
        ...m, draftState, status: 'in-progress',
      }));
      saveSportTournament(storageKey, updatedTournament);
    }
  }, [innings, currentInningsIndex, followOnEnforced, terminalSnapshot, scoringStarted]);

  const confirmPendingPrompt = () => {
    const promptType = scoringPrompt.pendingPrompt?.type;
    scoringPrompt.closePrompt();

    if (promptType === 'declare') {
      confirmDeclare();
      return;
    }

    if (promptType === 'draw') {
      confirmDraw();
      return;
    }

    if (promptType === 'discard') discardAndExit();
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!format || matchComplete || followOnPrompt) return;
    if (isTouchDevice) return;

    const handleKeyPress = (e) => {
      if (scoringPrompt.isInteractionLocked) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();
      if (isCricketRunKey(key)) addRuns(Number.parseInt(key, 10));
      else if (key === 'w') addWicket();
      else if (key === 'e') addExtra('wide');
      else if (key === 'u') undo();
    };

    globalThis.addEventListener('keydown', handleKeyPress);
    return () => globalThis.removeEventListener('keydown', handleKeyPress);
  }, [innings, currentInningsIndex, history, format, matchComplete, followOnPrompt, scoringPrompt.isInteractionLocked]);

  if (!match || !format) {
    return <div className="min-h-screen px-6 py-10 flex items-center justify-center">
      <p style={{ color: 'var(--se-color-ink-muted)' }}>Loading...</p>
    </div>;
  }

  // Show Declare button: not in the last innings
  const showDeclare = currentInningsIndex < 3;

  const isInningsOver = isTestInningsComplete(currentInning, format);

  // Follow-on prompt UI
  if (followOnPrompt) {
    const lead = innings[0].runs - innings[1].runs;
    return (
      <div className="mono-scorer-screen">
        <div className="mono-scorer-shell text-center" style={{ paddingTop: '80px' }}>
          {saveWarning && (
            <div className="mono-alert mono-alert-danger mb-4">
              {saveWarning}
            </div>
          )}
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--se-color-ink)' }}>Enforce Follow-on?</h2>
          <p className="text-sm mb-2" style={{ color: 'var(--se-color-ink-muted)' }}>
            {team1Name} leads by {lead} runs.
          </p>
          <p className="text-sm mb-8" style={{ color: 'var(--se-color-ink-muted)' }}>
            Force {team2Name} to bat again?
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => handleFollowOn(true)} className="mono-btn-primary" style={{ padding: '12px 24px' }}>
              Yes, enforce
            </button>
            <button onClick={() => handleFollowOn(false)} className="mono-btn" style={{ padding: '12px 24px' }}>
              No
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Match complete UI
  if (matchComplete && matchResult) {
    const winnerName = matchResult.winner === team1Id ? team1Name
      : matchResult.winner === team2Id ? team2Name
      : null;

    return (
      <div className="mono-scorer-screen">
        <div className="mono-scorer-shell text-center" style={{ paddingTop: '40px' }}>
          {saveWarning && (
            <div className="mono-alert mono-alert-danger mb-4">
              {saveWarning}
            </div>
          )}
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--se-color-ink-muted)' }}>Match Complete</p>

          {winnerName ? (
            <>
              <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--se-color-ink)' }}>{winnerName}</h1>
              <p className="text-sm mb-6" style={{ color: 'var(--primary)' }}>{matchResult.desc}</p>
            </>
          ) : (
            <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--se-color-ink)' }}>{matchResult.desc}</h1>
          )}

          {/* Innings summary table */}
          <div className="mono-soft-panel mb-8" style={{ padding: '16px 20px' }}>
            <div className="flex justify-between text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--se-color-ink-muted)' }}>
              <span>Team</span>
              <div className="flex gap-8">
                <span>1st Inn.</span>
                <span>2nd Inn.</span>
              </div>
            </div>
            {[team1Id, team2Id].map(teamId => {
              const teamInns = innings.filter(i => i.teamId === teamId);
              const name = getTeamName(teamId);
              const isWinner = matchResult.winner === teamId;
              return (
                <div key={teamId} className="flex justify-between items-center py-2" style={{ borderTop: '1px solid var(--se-color-line)' }}>
                  <span className="text-sm font-medium" style={{ color: isWinner ? 'var(--se-color-ink)' : 'var(--se-color-ink-muted)' }}>
                    {isWinner ? '\u2605 ' : ''}{name}
                  </span>
                  <div className="flex gap-8 font-mono text-sm" style={{ color: isWinner ? 'var(--se-color-ink)' : 'var(--se-color-ink-muted)' }}>
                    {teamInns.map((inn, i) => (
                      <span key={`inn-result-${i}-${inn.runs}-${inn.wickets}`}>
                        {inn.runs > 0 || inn.allOut || inn.declared
                          ? `${inn.runs}/${inn.allOut ? 'all' : inn.wickets}${inn.declared ? 'd' : ''}`
                          : '\u2014'
                        }
                      </span>
                    ))}
                    {teamInns.length < 2 && <span>&mdash;</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={saveCompleteMatch}
              disabled={Boolean(scoringPrompt.pendingPrompt)}
              className="mono-btn-primary"
              style={{ minHeight: 48, padding: '12px 24px', opacity: Boolean(scoringPrompt.pendingPrompt) ? 0.45 : 1 }}
            >
              Save &amp; Return
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active scoring UI
  const battingTeamName = getTeamName(currentInning?.teamId);
  const contextLine = getContextLine();

  return (
    <div className="mono-scorer-screen cricket-board" data-cricket-board="" data-batting={currentInning.teamId === team2Id ? 'b' : 'a'} style={colourStyle}>
      <div className="mono-scorer-shell sb crb">
        <h1 className="sr-only">{sportConfig?.name || 'Sport'} match scorer</h1>
        {saveWarning && (
          <div className="mono-alert mono-alert-danger mb-4">
            {saveWarning}
          </div>
        )}
        {scoringPrompt.renderPrompt(confirmPendingPrompt)}
        <BoardHeader title={`${ORDINALS[currentInningsIndex]} Innings`} sportColour={sportIdentity('cricket')?.core}
          subtitle={`Test cricket · Over ${ballsToOvers(currentInning.balls)}`}
          isLive={live.isLive} onFinish={handleFinish} />
        <BoardOptionsSheet id="cricket-test-options" open={showActions} onClose={() => setShowActions(false)} onDiscard={handleDiscard}>
          <LiveBroadcastBar broadcast={live} descriptor={{ clientMatchId: liveClientMatchId, sport: sport || 'cricket', scorecardKind: 'cricket', teamA: { name: team1Name }, teamB: { name: team2Name } }} enabled={liveEnabled} onEnableChange={setLiveEnabled} />
          <BoardSheetGroup>
            <div role="menu" aria-label="Test match actions">
            {showDeclare && !isInningsOver && <button role="menuitem" className="sb-row" disabled={scoringPrompt.isInteractionLocked} onClick={() => { setShowActions(false); handleDeclare(); }}>Declare innings</button>}
            <button role="menuitem" className="sb-row" disabled={scoringPrompt.isInteractionLocked} onClick={() => { setShowActions(false); handleDraw(); }}>End as draw</button>
            <button role="menuitem" className="sb-row" disabled={scoringPrompt.isInteractionLocked} onClick={() => { setShowActions(false); handleFinish(); }}>Finish &amp; save</button>
                      </div>
          </BoardSheetGroup>
        </BoardOptionsSheet>

        {/* Batting team — hero */}
        <div className="mono-scorer-main-score cricket-hero cricket-aggregate-hero">
          <span className="cricket-mark" aria-hidden="true" />
          <p className="text-xs uppercase font-mono" style={{ color: 'var(--se-color-ink-muted)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>
            {battingTeamName} batting
          </p>
          <p className="mono-scorer-score-value font-bold font-mono mono-score" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.06em', color: 'var(--se-color-ink)', margin: 0, lineHeight: 0.95, fontSize: 'clamp(3.5rem, 17vw, 6rem)', fontVariantNumeric: 'tabular-nums' }}>
            <span>{currentInning.runs}</span>
            <span style={{ color: 'var(--se-color-ink-faint)', fontSize: '0.42em', fontWeight: 700 }}>/{currentInning.wickets}</span>
            <span style={{ color: 'var(--se-color-ink-muted)', fontSize: '0.2em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>({ballsToOvers(currentInning.balls)} ov)</span>
          </p>
          <p className="text-sm font-mono" style={{ color: 'var(--se-color-ink-muted)', marginTop: 6 }}>
            RR {currentInning.balls > 0 ? calculateRunRate(currentInning.runs, currentInning.balls).toFixed(2) : '0.00'}
          </p>
          {contextLine && (
            <p className="text-sm" style={{ color: 'var(--primary)', marginTop: 2 }}>{contextLine}</p>
          )}
        </div>

        {/* Innings scorecard \u2014 collapsed by default so the keypad sits right
            under the live score. The current innings is already shown in the
            top bar and hero; tap to see the full innings breakdown. */}
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowCard(v => !v)}
            aria-expanded={showCard}
            className="mono-btn w-full"
            style={{ padding: '6px', fontSize: '0.75rem', color: 'var(--se-color-ink-muted)', letterSpacing: '0.06em' }}
          >
            {showCard ? 'Hide scorecard' : 'Scorecard'}
          </button>
          {showCard && (
            <div className="mono-score-mini mt-2" style={{ padding: '12px 16px' }}>
              {innings.map((inn, i) => {
                if (!inn.teamId) return null;
                const hasData = inn.runs > 0 || inn.allOut || inn.declared || inn.balls > 0;
                const isCurrent = i === currentInningsIndex;
                return (
                  <div key={`inn-summary-${i}-${inn.teamId}`} className="flex justify-between py-1 text-xs" style={{ color: isCurrent ? 'var(--se-color-ink)' : 'var(--se-color-ink-muted)' }}>
                    <span>{ORDINALS[i]}: {getTeamName(inn.teamId)}</span>
                    <span className="font-mono">
                      {hasData
                        ? `${inn.runs}/${inn.allOut ? 'all' : inn.wickets}${inn.declared ? 'd' : ''}${isCurrent ? '*' : ''} (${ballsToOvers(inn.balls)} ov)`
                        : '\u2014'
                      }
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Line-divided keypad — flat cells separated by hairlines, common runs largest. */}
        {!isInningsOver && (
          <div className="mono-cricket-keypad cricket-aggregate-pad">
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
                OUT
              </button>

            </div>
          </div>
        )}
        <BoardBar canUndo={history.length > 0 && !matchComplete && !scoringPrompt.isInteractionLocked}
          undoHint={(() => { const previous = history.at(-1); const score = previous?.innings?.[previous.currentInningsIndex]; return score ? `Back to ${ORDINALS[previous.currentInningsIndex]} · ${ballsToOvers(score.balls)} · ${score.runs}/${score.wickets}` : ''; })()}
          onUndo={undo} sheetId="cricket-test-options" sheetOpen={showActions} onMore={() => setShowActions(true)} />
      </div>
    </div>
  );
}

MonoCricketTestLiveScore.propTypes = {
  storageMode: PropTypes.string,
};

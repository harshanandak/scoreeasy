import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { loadSportTournaments, saveSportTournament, loadQuickMatch, saveQuickMatch, deleteQuickMatch } from '../../../utils/storage';
import { ballsToOvers, calculateRunRate, getMaxWickets, getTotalBalls, canEnforceFollowOn, getTestMatchResult } from '../../../utils/cricketCalculations';
import { migrateCricketFormat } from '../../../utils/formatMigration';
import { getSportById } from '../../../models/sportRegistry';
import { updateMatchInTournament } from '../../../utils/knockoutManager';
import { useAuth } from '../../../hooks/useAuth';
import { buildTournamentConvexPayload, normalizeNonTeamWinner } from '../../../utils/tournamentSync';
import { CRICKET_RUN_VALUES, isCricketRunKey } from '../../../utils/cricketRunControls';
import { useAppScoringPrompt } from '../components/AppScoringPrompt';

const isTouchDevice = 'ontouchstart' in globalThis || navigator.maxTouchPoints > 0;

const triggerHaptic = (pattern) => {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
};

const ORDINALS = ['1st', '2nd', '3rd', '4th'];

function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-2" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export default function MonoCricketTestLiveScore({ storageMode }) {
  const navigate = useNavigate();
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
  const [matchComplete, setMatchComplete] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveWarning, setSaveWarning] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const scoringPrompt = useAppScoringPrompt();

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
  useEffect(() => {
    if (isQuickMatch) {
      const qm = loadQuickMatch(matchId);
      if (!qm) return;
      setMatch(qm);
      const fmt = migrateCricketFormat(qm.format);
      setFormat(fmt);

      // Initialize innings team assignments
      const initInnings = [
        { teamId: qm.team1Id, runs: 0, balls: 0, wickets: 0, allOut: false, declared: false },
        { teamId: qm.team2Id, runs: 0, balls: 0, wickets: 0, allOut: false, declared: false },
        { teamId: qm.team1Id, runs: 0, balls: 0, wickets: 0, allOut: false, declared: false },
        { teamId: qm.team2Id, runs: 0, balls: 0, wickets: 0, allOut: false, declared: false },
      ];

      if (qm.draftState) {
        setInnings(qm.draftState.innings);
        setCurrentInningsIndex(qm.draftState.currentInningsIndex);
        setFollowOnEnforced(qm.draftState.followOnEnforced || false);
        setHistory(qm.draftState.history || []);
      } else if (qm.innings && qm.innings.length === 4) {
        setInnings(qm.innings);
      } else {
        setInnings(initInnings);
      }
    } else {
      const storageKey = sportConfig?.storageKey || 'se_cricket';
      const tournaments = loadSportTournaments(storageKey);
      const found = tournaments.find(t => t.id === Number(id) || t.id === id);
      if (!found) return;
      let foundMatch = found.matches.find(m => m.id === matchId || m.id === Number(matchId));
      if (!foundMatch) {
        foundMatch = (found.knockoutMatches || []).find(m => m.id === matchId || m.id === Number(matchId));
        if (foundMatch) isKnockoutRef.current = true;
      }
      if (!foundMatch) return;

      setTournament(found);
      setMatch(foundMatch);
      const fmt = migrateCricketFormat(foundMatch.format || (isKnockoutRef.current && found.knockoutConfig?.format) || found.format);
      setFormat(fmt);

      const initInnings = [
        { teamId: foundMatch.team1Id, runs: 0, balls: 0, wickets: 0, allOut: false, declared: false },
        { teamId: foundMatch.team2Id, runs: 0, balls: 0, wickets: 0, allOut: false, declared: false },
        { teamId: foundMatch.team1Id, runs: 0, balls: 0, wickets: 0, allOut: false, declared: false },
        { teamId: foundMatch.team2Id, runs: 0, balls: 0, wickets: 0, allOut: false, declared: false },
      ];

      if (foundMatch.draftState) {
        setInnings(foundMatch.draftState.innings);
        setCurrentInningsIndex(foundMatch.draftState.currentInningsIndex);
        setFollowOnEnforced(foundMatch.draftState.followOnEnforced || false);
        setHistory(foundMatch.draftState.history || []);
      } else if (foundMatch.innings && foundMatch.innings.length === 4) {
        setInnings(foundMatch.innings);
      } else {
        setInnings(initInnings);
      }
    }
  }, [id, matchId, sport, storageMode]);

  // Derived values
  const maxWickets = format ? getMaxWickets(format) : 10;
  const totalBalls = format ? getTotalBalls(format) : Infinity;
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
  const team1Name = getTeamName(team1Id);
  const team2Name = getTeamName(team2Id);

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

  // Check for early result after scoring.
  // Only the FINAL innings (index 3) ends the match the instant the batting side passes
  // the opponent's aggregate (a chase). In the 3rd innings the batting side is usually
  // already ahead on aggregate and is building a lead — it must NOT end the match there.
  const checkResult = (updatedInnings) => {
    if (currentInningsIndex < 3) return false;

    const battingTeamId = updatedInnings[currentInningsIndex].teamId;
    const bowlingTeamId = battingTeamId === team1Id ? team2Id : team1Id;
    const battingTotal = updatedInnings.filter(i => i.teamId === battingTeamId).reduce((s, i) => s + i.runs, 0);
    const bowlingTotal = updatedInnings.filter(i => i.teamId === bowlingTeamId).reduce((s, i) => s + i.runs, 0);

    if (battingTotal > bowlingTotal) {
      const result = getTestMatchResult(updatedInnings, team1Id, team2Id, maxWickets);
      setMatchResult(result);
      setMatchComplete(true);
      return true;
    }
    return false;
  };

  // Advance to next innings
  const advanceInnings = (updatedInnings) => {
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

    // End of the 3rd innings: if the side due to bat last already leads on aggregate
    // (its total exceeds the opponent's across the opponent's extra innings — e.g. a
    // follow-on win), it's an innings victory and the 4th innings is not played.
    if (currentInningsIndex === 2) {
      const lastBatTeamId = updatedInnings[3].teamId;
      const lastBatTotal = updatedInnings
        .filter(i => i.teamId === lastBatTeamId)
        .reduce((s, i) => s + i.runs, 0);
      const oppTotal = updatedInnings
        .filter(i => i.teamId !== lastBatTeamId)
        .reduce((s, i) => s + i.runs, 0);
      if (lastBatTotal > oppTotal) {
        const result = getTestMatchResult(updatedInnings, team1Id, team2Id, maxWickets);
        setMatchResult(result);
        setMatchComplete(true);
        return;
      }
    }

    if (nextIndex >= 4) {
      // All 4 innings done
      const result = getTestMatchResult(updatedInnings, team1Id, team2Id, maxWickets);
      setMatchResult(result);
      setMatchComplete(true);
      return;
    }

    setCurrentInningsIndex(nextIndex);
  };

  // Handle follow-on decision
  const handleFollowOn = (enforce) => {
    setFollowOnPrompt(false);
    if (enforce) {
      setFollowOnEnforced(true);
      // Swap team assignments for innings 3 & 4
      setInnings(prev => {
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

    saveSnapshot();

    setInnings(prev => {
      const updated = [...prev];
      const inn = { ...updated[currentInningsIndex] };
      inn.runs += runs;
      inn.balls += 1;
      updated[currentInningsIndex] = inn;

      // Check balls exhausted (for formats with over limits)
      if (inn.balls >= totalBalls) {
        if (!checkResult(updated)) {
          setTimeout(() => advanceInnings(updated), 300);
        }
      } else if (currentInningsIndex >= 2) {
        checkResult(updated);
      }

      return updated;
    });
  };

  // Add wicket
  const addWicket = () => {
    if (!format || matchComplete || scoringPrompt.isInteractionLocked) return;
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;

    triggerHaptic([80, 80, 80]);
    saveSnapshot();

    setInnings(prev => {
      const updated = [...prev];
      const inn = { ...updated[currentInningsIndex] };
      inn.wickets += 1;
      inn.balls += 1;

      if (inn.wickets >= maxWickets) {
        inn.allOut = true;
        updated[currentInningsIndex] = inn;
        if (!checkResult(updated)) {
          setTimeout(() => advanceInnings(updated), 300);
        }
      } else if (inn.balls >= totalBalls) {
        updated[currentInningsIndex] = inn;
        if (!checkResult(updated)) {
          setTimeout(() => advanceInnings(updated), 300);
        }
      } else {
        updated[currentInningsIndex] = inn;
        if (currentInningsIndex >= 2) checkResult(updated);
      }

      return updated;
    });
  };

  // Add extra
  const addExtra = (type) => {
    if (!format || matchComplete || scoringPrompt.isInteractionLocked) return;
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;

    triggerHaptic(30);
    saveSnapshot();

    // Byes and leg byes are legal deliveries — they consume a ball;
    // wides and no balls do not.
    const countsAsBall = type === 'bye' || type === 'legBye';

    setInnings(prev => {
      const updated = [...prev];
      const inn = { ...updated[currentInningsIndex] };
      inn.runs += 1;
      if (countsAsBall) inn.balls += 1;
      updated[currentInningsIndex] = inn;

      if (countsAsBall && inn.balls >= totalBalls) {
        if (!checkResult(updated)) {
          setTimeout(() => advanceInnings(updated), 300);
        }
      } else if (currentInningsIndex >= 2) {
        checkResult(updated);
      }
      return updated;
    });
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

    setInnings(prev => {
      const updated = [...prev];
      updated[currentInningsIndex] = { ...updated[currentInningsIndex], declared: true };
      if (!checkResult(updated)) {
        setTimeout(() => advanceInnings(updated), 300);
      }
      return updated;
    });
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
    setMatchResult({ winner: 'draw', desc: 'Match Drawn' });
    setMatchComplete(true);
  };

  // Undo
  const undo = () => {
    if (history.length === 0 || scoringPrompt.isInteractionLocked) return;
    const last = history[history.length - 1];
    setInnings(last.innings);
    setCurrentInningsIndex(last.currentInningsIndex);
    setFollowOnEnforced(last.followOnEnforced);
    setHistory(prev => prev.slice(0, -1));
  };

  // Save draft
  const saveDraft = () => {
    if (scoringPrompt.isInteractionLocked) return;

    const draftState = {
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

  // Save completed match
  const saveCompleteMatch = () => {
    if (scoringPrompt.isInteractionLocked) return;

    const winner = matchResult?.winner || null;
    const winDesc = matchResult?.desc || '';
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
        return;
      }
    } else {
      const storageKey = sportConfig?.storageKey || 'se_cricket';
      const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
        ...m,
        innings,
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
        return;
      }
      saveTournamentToConvex(updatedTournament);
    }

    setSaveWarning('');
    navigateBack();
  };

  const navigateBack = () => {
    if (isQuickMatch) {
      navigate(`/${sport || 'cricket'}/quick`);
    } else {
      navigate(`/${sport || 'cricket'}/tournament/${id}`);
    }
  };

  const discardAndExit = () => {
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
      message: 'Your progress will be lost.',
      title: 'Discard match?',
      type: 'discard',
    });
  };

  const handleFinish = () => navigateBack();

  // Continuous auto-save
  useEffect(() => {
    if (!match || !format || matchComplete) return;
    if (history.length === 0) return;
    const draftState = {
      innings: structuredClone(innings),
      currentInningsIndex,
      followOnEnforced,
      history: structuredClone(history.slice(-50)),
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
  }, [innings, currentInningsIndex, followOnEnforced]);

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

  const isInningsOver = currentInning &&
    (currentInning.allOut || currentInning.declared || currentInning.balls >= totalBalls);

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
              disabled={scoringPrompt.isInteractionLocked}
              className="mono-btn-primary"
              style={{ padding: '12px 24px', opacity: scoringPrompt.isInteractionLocked ? 0.45 : 1 }}
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
    <div className="mono-scorer-screen mono-arena-screen">
      <div className="mono-scorer-shell">
        <h1 className="sr-only">{sportConfig?.name || 'Sport'} match scorer</h1>
        {saveWarning && (
          <div className="mono-alert mono-alert-danger mb-4">
            {saveWarning}
          </div>
        )}
        {scoringPrompt.renderPrompt(confirmPendingPrompt)}
        {/* Top bar — match/ending options live in the hamburger menu so the
            scoring keypad stays low and easy to reach by thumb. */}
        <div className="mono-scorer-topbar">
          <span className="text-sm font-swiss" style={{ color: 'var(--se-color-ink-muted)' }}>
            {sportConfig?.name || 'Match'}
          </span>
          <div className="mono-scorer-topbar-actions">
            <span className="mono-badge">Test Match</span>
            <span className="mono-badge mono-badge-live">{ORDINALS[currentInningsIndex]} Innings</span>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowActions(v => !v)}
                aria-label="Match options"
                aria-expanded={showActions}
                className="mono-btn"
                style={{ padding: '4px 8px', minHeight: 0, display: 'inline-flex', alignItems: 'center', color: 'var(--se-color-ink)' }}
              >
                <MenuIcon />
              </button>
              {showActions && (
                <>
                  <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setShowActions(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'transparent', border: 'none', cursor: 'default' }}
                  />
                  <div
                    role="menu"
                    style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50, minWidth: 190, display: 'flex', flexDirection: 'column', gap: 6, padding: 8, background: 'var(--card)', border: '1px solid var(--se-color-ink)', borderRadius: 'calc(var(--radius) + 4px)', boxShadow: 'var(--shadow-hard)' }}
                  >
                    {showDeclare && !isInningsOver && (
                      <button
                        role="menuitem"
                        onClick={() => { setShowActions(false); handleDeclare(); }}
                        disabled={scoringPrompt.isInteractionLocked}
                        className="mono-btn"
                        style={{ padding: '10px 12px', fontSize: '0.8125rem', textAlign: 'left', borderColor: 'var(--primary)', color: 'var(--primary)', opacity: scoringPrompt.isInteractionLocked ? 0.45 : 1 }}
                      >
                        Declare innings
                      </button>
                    )}
                    <button
                      role="menuitem"
                      onClick={() => { setShowActions(false); handleDraw(); }}
                      disabled={scoringPrompt.isInteractionLocked}
                      className="mono-btn"
                      style={{ padding: '10px 12px', fontSize: '0.8125rem', textAlign: 'left', opacity: scoringPrompt.isInteractionLocked ? 0.45 : 1 }}
                    >
                      End as draw
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { setShowActions(false); handleDiscard(); }}
                      disabled={scoringPrompt.isInteractionLocked}
                      className="mono-btn"
                      style={{ padding: '10px 12px', fontSize: '0.8125rem', textAlign: 'left', opacity: scoringPrompt.isInteractionLocked ? 0.45 : 1 }}
                    >
                      Discard match
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { setShowActions(false); handleFinish(); }}
                      disabled={scoringPrompt.isInteractionLocked}
                      className="mono-btn"
                      style={{ padding: '10px 12px', fontSize: '0.8125rem', textAlign: 'left', color: 'var(--primary)', opacity: scoringPrompt.isInteractionLocked ? 0.45 : 1 }}
                    >
                      Finish &amp; save
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Batting team — hero */}
        <div className="mono-scorer-main-score mono-quick-cricket-score">
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
                OUT
              </button>
              <button
                type="button"
                onClick={undo}
                disabled={history.length === 0 || scoringPrompt.isInteractionLocked}
                className="mono-cricket-undo-line"
                aria-label="Undo last action"
                title="Undo last action"
                style={{ touchAction: 'manipulation' }}
              >
                <UndoIcon />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

MonoCricketTestLiveScore.propTypes = {
  storageMode: PropTypes.string,
};

import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { loadSportTournaments, saveSportTournament, loadQuickMatch, saveQuickMatch } from '../../../utils/storage';
import { ballsToOvers, calculateRunRate, getMaxWickets, getTotalBalls, canEnforceFollowOn, getTestMatchResult } from '../../../utils/cricketCalculations';
import { migrateCricketFormat } from '../../../utils/formatMigration';
import { getSportById } from '../../../models/sportRegistry';
import { updateMatchInTournament } from '../../../utils/knockoutManager';
import { useAuth } from '../../../hooks/useAuth';
import { buildTournamentConvexPayload, normalizeNonTeamWinner } from '../../../utils/tournamentSync';
import { useAppScoringPrompt } from '../components/AppScoringPrompt';
import BackArrow from '../components/BackArrow';

const isTouchDevice = 'ontouchstart' in globalThis || navigator.maxTouchPoints > 0;

const triggerHaptic = (pattern) => {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
};

const ORDINALS = ['1st', '2nd', '3rd', '4th'];

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

  // Check for early result after scoring
  const checkResult = (updatedInnings) => {
    if (currentInningsIndex < 2) return false;

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
    if (!format || matchComplete || scoringPrompt.pendingPrompt) return;
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
    if (!format || matchComplete || scoringPrompt.pendingPrompt) return;
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
    if (!format || matchComplete || scoringPrompt.pendingPrompt) return;
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;

    triggerHaptic(30);
    saveSnapshot();

    setInnings(prev => {
      const updated = [...prev];
      const inn = { ...updated[currentInningsIndex] };
      inn.runs += 1;
      updated[currentInningsIndex] = inn;

      if (currentInningsIndex >= 2) checkResult(updated);
      return updated;
    });
  };

  // Declaration
  const handleDeclare = () => {
    if (matchComplete) return;
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
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setInnings(last.innings);
    setCurrentInningsIndex(last.currentInningsIndex);
    setFollowOnEnforced(last.followOnEnforced);
    setHistory(prev => prev.slice(0, -1));
  };

  // Save draft
  const saveDraft = () => {
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

  const handleCancel = () => {
    scoringPrompt.cancelOrNavigate(hasChanges, navigateBack);
  };

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

    if (promptType === 'discard') navigateBack();
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!format || matchComplete || followOnPrompt) return;
    if (isTouchDevice) return;

    const handleKeyPress = (e) => {
      if (scoringPrompt.pendingPrompt) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();
      if (['0', '1', '2', '3', '4', '6'].includes(key)) addRuns(Number.parseInt(key));
      else if (key === 'w') addWicket();
      else if (key === 'e') addExtra('wide');
      else if (key === 'u') undo();
    };

    globalThis.addEventListener('keydown', handleKeyPress);
    return () => globalThis.removeEventListener('keydown', handleKeyPress);
  }, [innings, currentInningsIndex, history, format, matchComplete, followOnPrompt, scoringPrompt.pendingPrompt]);

  if (!match || !format) {
    return <div className="min-h-screen px-6 py-10 flex items-center justify-center">
      <p style={{ color: '#888' }}>Loading...</p>
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
      <div className="min-h-screen px-6 py-10">
        <div className="max-w-2xl mx-auto text-center" style={{ paddingTop: '80px' }}>
          {saveWarning && (
            <div className="mono-card mb-4" style={{ padding: '10px 12px', borderColor: '#dc2626', color: '#dc2626' }}>
              {saveWarning}
            </div>
          )}
          <h2 className="text-2xl font-bold mb-4" style={{ color: '#111' }}>Enforce Follow-on?</h2>
          <p className="text-sm mb-2" style={{ color: '#888' }}>
            {team1Name} leads by {lead} runs.
          </p>
          <p className="text-sm mb-8" style={{ color: '#888' }}>
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
      : matchResult.winner === 'draw' ? null
      : matchResult.winner === 'tie' ? null
      : null;

    return (
      <div className="min-h-screen px-6 py-10">
        <div className="max-w-2xl mx-auto text-center" style={{ paddingTop: '40px' }}>
          {saveWarning && (
            <div className="mono-card mb-4" style={{ padding: '10px 12px', borderColor: '#dc2626', color: '#dc2626' }}>
              {saveWarning}
            </div>
          )}
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#888' }}>Match Complete</p>

          {winnerName ? (
            <>
              <h1 className="text-2xl font-bold mb-2" style={{ color: '#111' }}>{winnerName}</h1>
              <p className="text-sm mb-6" style={{ color: '#0066ff' }}>{matchResult.desc}</p>
            </>
          ) : (
            <h1 className="text-2xl font-bold mb-6" style={{ color: '#111' }}>{matchResult.desc}</h1>
          )}

          {/* Innings summary table */}
          <div className="mono-card mb-8" style={{ padding: '16px 20px' }}>
            <div className="flex justify-between text-xs uppercase tracking-widest mb-3" style={{ color: '#888' }}>
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
                <div key={teamId} className="flex justify-between items-center py-2" style={{ borderTop: '1px solid #eee' }}>
                  <span className="text-sm font-medium" style={{ color: isWinner ? '#111' : '#888' }}>
                    {isWinner ? '\u2605 ' : ''}{name}
                  </span>
                  <div className="flex gap-8 font-mono text-sm" style={{ color: isWinner ? '#111' : '#888' }}>
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
            <button onClick={saveCompleteMatch} className="mono-btn-primary" style={{ padding: '12px 24px' }}>
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
    <div className="min-h-screen px-6 py-10">
      <div className="max-w-2xl mx-auto">
        {saveWarning && (
          <div className="mono-card mb-4" style={{ padding: '10px 12px', borderColor: '#dc2626', color: '#dc2626' }}>
            {saveWarning}
          </div>
        )}
        {scoringPrompt.renderPrompt(confirmPendingPrompt)}
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={handleCancel} className="text-sm bg-transparent border-none cursor-pointer font-swiss flex items-center gap-1" style={{ color: '#888' }}>
            <BackArrow /> Back
          </button>
          <div className="flex items-center gap-2">
            <span className="mono-badge">Test Match</span>
            <span className="mono-badge mono-badge-live">{ORDINALS[currentInningsIndex]} Innings</span>
          </div>
        </div>

        {/* Batting team score */}
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#888' }}>
            {battingTeamName} batting
          </p>
          <p className="text-6xl font-bold font-mono mono-score mb-2" style={{ color: '#111' }}>
            {currentInning.runs}
            <span style={{ color: '#bbb', fontSize: '0.5em' }}>/{currentInning.wickets}</span>
          </p>
          <p className="text-sm font-mono mb-1" style={{ color: '#888' }}>
            {ballsToOvers(currentInning.balls)} ov &middot; RR {currentInning.balls > 0 ? calculateRunRate(currentInning.runs, currentInning.balls).toFixed(2) : '0.00'}
          </p>
          {contextLine && (
            <p className="text-sm mt-1" style={{ color: '#0066ff' }}>{contextLine}</p>
          )}
        </div>

        {/* Innings tabs */}
        <div className="flex gap-1 justify-center mb-4">
          {innings.map((inn, i) => {
            const isCurrent = i === currentInningsIndex;
            const hasData = inn.runs > 0 || inn.allOut || inn.declared;
            return (
              <div key={`inn-tab-${i}-${inn.teamId || 'unset'}`} className="text-center" style={{ minWidth: '60px' }}>
                <span className="text-xs font-medium" style={{ color: isCurrent ? '#0066ff' : hasData ? '#111' : '#ccc' }}>
                  {ORDINALS[i]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Innings summary cards */}
        <div className="mono-card mb-6" style={{ padding: '12px 16px' }}>
          {innings.map((inn, i) => {
            if (!inn.teamId) return null;
            const hasData = inn.runs > 0 || inn.allOut || inn.declared || inn.balls > 0;
            const isCurrent = i === currentInningsIndex;
            return (
              <div key={`inn-summary-${i}-${inn.teamId}`} className="flex justify-between py-1 text-xs" style={{ color: isCurrent ? '#111' : '#888' }}>
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

        {/* Scoring controls */}
        {!isInningsOver && (
          <>
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {[0, 1, 2, 3, 4, 6].map(r => (
                <button key={r} onClick={() => addRuns(r)}
                  className={r === 4 || r === 6 ? 'mono-btn-primary' : 'mono-btn'}
                  style={{ width: '56px', height: '56px', fontSize: '1.25rem', fontWeight: 700, padding: 0, touchAction: 'manipulation' }}>
                  {r}
                </button>
              ))}
            </div>

            <div className="flex gap-2 justify-center mb-4">
              <button onClick={() => addExtra('wide')} className="mono-btn"
                style={{ padding: '10px 16px', fontSize: '0.8125rem', touchAction: 'manipulation' }}>
                Wide (+1)
              </button>
              <button onClick={() => addExtra('noBall')} className="mono-btn"
                style={{ padding: '10px 16px', fontSize: '0.8125rem', touchAction: 'manipulation' }}>
                No Ball (+1)
              </button>
            </div>

            <button onClick={addWicket} className="mono-btn w-full mb-4"
              style={{ padding: '14px', fontSize: '0.9375rem', borderColor: '#dc2626', color: '#dc2626', touchAction: 'manipulation' }}>
              Wicket
            </button>
          </>
        )}

        {!isTouchDevice && !isInningsOver && (
          <p className="text-xs text-center mb-4" style={{ color: '#ccc' }}>
            Keyboard: 0-6 = Runs &middot; W = Wicket &middot; E = Extra &middot; U = Undo
          </p>
        )}

        {/* Bottom bar */}
        <div className="pt-4" style={{ borderTop: '1px solid #eee' }}>
          <div className="flex gap-2 mb-3">
            <button
              onClick={undo}
              disabled={history.length === 0}
              className="mono-btn flex-1"
              style={{ padding: '8px', fontSize: '0.8125rem', opacity: history.length === 0 ? 0.4 : 1, touchAction: 'manipulation' }}
            >
              Undo
            </button>
            {showDeclare && !isInningsOver && (
              <button onClick={handleDeclare} className="mono-btn flex-1" style={{ padding: '8px', fontSize: '0.8125rem', borderColor: '#0066ff', color: '#0066ff' }}>
                Declare
              </button>
            )}
            <button onClick={handleDraw} className="mono-btn flex-1" style={{ padding: '8px', fontSize: '0.8125rem' }}>
              Draw
            </button>
            {hasChanges && (
              <button onClick={saveDraft} className="mono-btn flex-1" style={{ padding: '8px', fontSize: '0.8125rem', borderColor: '#0066ff', color: '#0066ff' }}>
                Pause
              </button>
            )}
            <button onClick={handleCancel} className="mono-btn flex-1" style={{ padding: '8px', fontSize: '0.8125rem' }}>
              Discard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

MonoCricketTestLiveScore.propTypes = {
  storageMode: PropTypes.string,
};

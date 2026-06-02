import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { loadSportTournaments, saveSportTournament } from '../../../utils/storage';
import { ballsToOvers, calculateRunRate, getPowerplayPhase, getMaxWickets, getTotalBalls, getCricketFormat, getLimitedOversResult, canManuallyCompleteUnlimitedMatch } from '../../../utils/cricketCalculations';
import { migrateCricketFormat } from '../../../utils/formatMigration';
import { getSportById } from '../../../models/sportRegistry';
import { updateMatchInTournament } from '../../../utils/knockoutManager';
import { useAuth } from '../../../hooks/useAuth';
import { buildTournamentConvexPayload } from '../../../utils/tournamentSync';
import { CRICKET_RUN_VALUES, isCricketRunKey } from '../../../utils/cricketRunControls';
import { useAppScoringPrompt } from '../components/AppScoringPrompt';
import { triggerConfetti } from '../utils/confetti';
import BackArrow from '../components/BackArrow';

const isTouchDevice = 'ontouchstart' in globalThis || navigator.maxTouchPoints > 0;

// Haptic feedback helper
const triggerHaptic = (pattern) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

export default function MonoCricketLiveScore() {
  const navigate = useNavigate();
  const { sport, id, matchId } = useParams();
  const sportConfig = getSportById(sport || 'cricket');
  const { isAuthenticated } = useAuth();
  const saveMatchMutation = useMutation(api.matches.save);
  const navigateToTournament = () => navigate(`/${sport || 'cricket'}/tournament/${id}`);

  // Core state
  const [tournament, setTournament] = useState(null);
  const [match, setMatch] = useState(null);
  const [format, setFormat] = useState(null);

  // Scoring state
  const [battingTeam, setBattingTeam] = useState(1);
  const [innings, setInnings] = useState(1);
  const [scores, setScores] = useState({
    team1: { runs: 0, balls: 0, wickets: 0, allOut: false },
    team2: { runs: 0, balls: 0, wickets: 0, allOut: false },
  });
  const [history, setHistory] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [scoreAnimKey, setScoreAnimKey] = useState(0);

  // Free hit state
  const [freeHit, setFreeHit] = useState(false);

  // Trial ball state (gully cricket)
  const [trialBallUsed, setTrialBallUsed] = useState(false);

  // Pending innings switch (replaces setTimeout hack)
  const [pendingInningsSwitch, setPendingInningsSwitch] = useState(false);

  // Super Over state
  const [superOverPhase, setSuperOverPhase] = useState('inactive');
  // States: 'inactive' → 'prompt' → 'team1_batting' → 'team2_batting' → 'result' → ('prompt')
  const [superOver, setSuperOver] = useState({ team1: { runs: 0, balls: 0, wickets: 0 }, team2: { runs: 0, balls: 0, wickets: 0 } });
  const [saveWarning, setSaveWarning] = useState('');
  const scoringPrompt = useAppScoringPrompt();

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
        sportId: sport || 'cricket',
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

    // Use match-level format with fallback to knockout/tournament format (bug fix 9b)
    const rawFormat = foundMatch.format || (isKnockoutRef.current && found.knockoutConfig?.format) || found.format || {};
    const migratedFormat = migrateCricketFormat(rawFormat);
    setFormat(migratedFormat);

    // Initialize trial ball state
    if (migratedFormat.trialBall) {
      setTrialBallUsed(false);
    }

    // Initialize from existing score if editing
    if (foundMatch.team1Score && !foundMatch.draftState) {
      setScores({
        team1: { ...foundMatch.team1Score, wickets: foundMatch.team1Score.wickets || 0 },
        team2: { ...foundMatch.team2Score, wickets: foundMatch.team2Score.wickets || 0 },
      });
      if (foundMatch.team2Score && foundMatch.team2Score.balls > 0) {
        setInnings(2);
        setBattingTeam(2);
      }
    }

    // Restore from draft if exists
    if (foundMatch.draftState) {
      setScores(foundMatch.draftState.scores);
      setBattingTeam(foundMatch.draftState.battingTeam);
      setInnings(foundMatch.draftState.innings);
      setHistory(foundMatch.draftState.history || []);
      setFreeHit(foundMatch.draftState.freeHit || false);
      setTrialBallUsed(foundMatch.draftState.trialBallUsed || false);
    }
  }, [id, matchId, sport]);

  // Handle pending innings switch via useEffect (bug fix 9j)
  useEffect(() => {
    if (pendingInningsSwitch) {
      setInnings(2);
      setBattingTeam(battingTeam === 1 ? 2 : 1);
      setFreeHit(false);
      setPendingInningsSwitch(false);
    }
  }, [pendingInningsSwitch]);

  // Derived values from format
  const totalBalls = format ? getTotalBalls(format) : Infinity;
  const maxWickets = format ? getMaxWickets(format) : 10;
  const showOvers = !format || format.trackOvers !== false;
  const formatPreset = format?.preset ? getCricketFormat(format.preset) : null;
  const presetLabel = formatPreset?.name || (format?.preset === 'custom' ? 'Custom' : '');
  const hasLoadedMatch = Boolean(tournament && match && format);
  const getTeamName = (teamId) => tournament?.teams?.find(t => t.id === teamId)?.name || 'Unknown';
  const team1Name = hasLoadedMatch ? getTeamName(match.team1Id) : 'Team A';
  const team2Name = hasLoadedMatch ? getTeamName(match.team2Id) : 'Team B';
  const currentKey = `team${battingTeam}`;
  const currentScore = scores[currentKey];
  const currentName = battingTeam === 1 ? team1Name : team2Name;
  const otherName = battingTeam === 1 ? team2Name : team1Name;
  const otherScore = battingTeam === 1 ? scores.team2 : scores.team1;

  const target = hasLoadedMatch && innings === 2
    ? (battingTeam === 2 ? scores.team1.runs : scores.team2.runs)
    : null;

  const isInningsComplete = hasLoadedMatch && (currentScore.balls >= totalBalls || currentScore.wickets >= maxWickets);
  const isTied = innings === 2 && isInningsComplete && scores.team1.runs === scores.team2.runs;
  const isMatchComplete = innings === 2 && (isInningsComplete || (target !== null && currentScore.runs > target));

  useEffect(() => {
    if (isTied && superOverPhase === 'inactive' && format?.totalInnings !== 4) {
      setSuperOverPhase('prompt');
    }
  }, [isTied, superOverPhase, format?.totalInnings]);

  // Powerplay
  const currentOver = scores[`team${battingTeam}`]
    ? Math.floor(scores[`team${battingTeam}`].balls / 6) + 1
    : 1;
  const powerplayPhase = format && showOvers ? getPowerplayPhase(format, currentOver) : null;

  // Save history snapshot
  const saveSnapshot = () => {
    setHistory(prev => [...prev, {
      timestamp: Date.now(),
      scores: structuredClone(scores),
      battingTeam,
      innings,
      freeHit,
    }].slice(-100));
    setHasChanges(true);
  };

  // Add runs
  const addRuns = (runs) => {
    if (!tournament || !format || scoringPrompt.isInteractionLocked) return;

    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;

    if (runs === 4 || runs === 6) {
      triggerHaptic([50, 50, 50]);
    } else {
      triggerHaptic(50);
    }

    saveSnapshot();
    setScoreAnimKey(k => k + 1);

    // Clear free hit after this delivery
    if (freeHit) setFreeHit(false);

    const key = `team${battingTeam}`;
    setScores(prev => {
      const team = { ...prev[key] };
      team.runs += runs;
      team.balls += 1;

      // Check if innings over (balls exhausted)
      if (team.balls >= totalBalls) {
        team.allOut = false;
        if (innings === 1) {
          setPendingInningsSwitch(true);
        }
      }

      // Check if team 2 chased the target
      if (innings === 2) {
        const target = battingTeam === 2 ? prev.team1.runs : prev.team2.runs;
        if (team.runs > target) {
          // Match won — handled by isMatchComplete
        }
      }

      return { ...prev, [key]: team };
    });
  };

  // Add wicket
  const addWicket = () => {
    if (!tournament || !format || scoringPrompt.isInteractionLocked) return;

    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;

    triggerHaptic([80, 80, 80]);
    saveSnapshot();
    setScoreAnimKey(k => k + 1);

    // Clear free hit after this delivery
    if (freeHit) setFreeHit(false);

    const key = `team${battingTeam}`;
    setScores(prev => {
      const team = { ...prev[key] };
      team.wickets += 1;
      team.balls += 1;

      if (team.wickets >= maxWickets) {
        team.allOut = true;
        if (innings === 1) {
          setPendingInningsSwitch(true);
        }
      } else if (team.balls >= totalBalls) {
        team.allOut = false;
        if (innings === 1) {
          setPendingInningsSwitch(true);
        }
      }

      return { ...prev, [key]: team };
    });
  };

  // Add extra (wide/no-ball) — bug fix 9d: trigger free hit on no-ball
  const addExtra = (type) => {
    if (!tournament || !format || scoringPrompt.isInteractionLocked) return;

    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;

    triggerHaptic(30);
    saveSnapshot();
    setScoreAnimKey(k => k + 1);

    const key = `team${battingTeam}`;
    setScores(prev => ({
      ...prev,
      [key]: { ...prev[key], runs: prev[key].runs + 1 },
    }));

    // No ball triggers free hit if format supports it
    if (type === 'noBall' && format.freeHit) {
      setFreeHit(true);
    }
  };

  // Skip trial ball (gully cricket)
  const skipTrialBall = () => {
    setTrialBallUsed(true);
  };

  // Undo — restores freeHit state (bug fix 9k)
  const undo = () => {
    if (history.length === 0 || scoringPrompt.isInteractionLocked) return;

    const last = history[history.length - 1];
    setScores(last.scores);
    setBattingTeam(last.battingTeam);
    setInnings(last.innings);
    setFreeHit(last.freeHit || false);
    setHistory(prev => prev.slice(0, -1));
  };

  // Super Over scoring
  const addSuperOverRuns = (runs) => {
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;

    const key = superOverPhase === 'team1_batting' ? 'team1' : 'team2';
    setSuperOver(prev => {
      const team = { ...prev[key] };
      team.runs += runs;
      team.balls += 1;

      // Check if over done (6 balls or 2 wickets)
      if (team.balls >= 6 || team.wickets >= 2) {
        if (superOverPhase === 'team1_batting') {
          setTimeout(() => setSuperOverPhase('team2_batting'), 300);
        } else {
          setTimeout(() => setSuperOverPhase('result'), 300);
        }
      }

      return { ...prev, [key]: team };
    });
  };

  const addSuperOverWicket = () => {
    const now = Date.now();
    if (now - lastClickRef.current < 150) return;
    lastClickRef.current = now;

    const key = superOverPhase === 'team1_batting' ? 'team1' : 'team2';
    setSuperOver(prev => {
      const team = { ...prev[key] };
      team.wickets += 1;
      team.balls += 1;

      if (team.wickets >= 2 || team.balls >= 6) {
        if (superOverPhase === 'team1_batting') {
          setTimeout(() => setSuperOverPhase('team2_batting'), 300);
        } else {
          setTimeout(() => setSuperOverPhase('result'), 300);
        }
      }

      return { ...prev, [key]: team };
    });
  };

  const addSuperOverExtra = () => {
    const key = superOverPhase === 'team1_batting' ? 'team1' : 'team2';
    setSuperOver(prev => ({
      ...prev,
      [key]: { ...prev[key], runs: prev[key].runs + 1 },
    }));
  };

  // Save draft
  const saveDraft = () => {
    if (scoringPrompt.isInteractionLocked) return;

    const storageKey = sportConfig?.storageKey || 'se_cricket';
    const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
      ...m,
      status: 'in-progress',
      draftState: {
        scores: structuredClone(scores),
        battingTeam,
        innings,
        history: structuredClone(history.slice(-50)),
        freeHit,
        trialBallUsed,
        savedAt: new Date().toISOString(),
      },
    }));

    const ok = saveSportTournament(storageKey, updatedTournament);
    if (!ok) {
      setSaveWarning('Save failed - storage may be full. Export your data.');
      return;
    }
    setSaveWarning('');
    setHasChanges(false);
    scoringPrompt.scheduleDraftRedirect(navigateToTournament);
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!tournament || !format) return;
    if (isTouchDevice) return;

    const handleKeyPress = (e) => {
      if (scoringPrompt.isInteractionLocked) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (isMatchComplete) return;

      const key = e.key.toLowerCase();
      if (isCricketRunKey(key)) {
        addRuns(Number.parseInt(key, 10));
      } else if (key === 'w') {
        addWicket();
      } else if (key === 'e') {
        addExtra('wide');
      } else if (key === 'u') {
        undo();
      }
    };

    globalThis.addEventListener('keydown', handleKeyPress);
    return () => globalThis.removeEventListener('keydown', handleKeyPress);
  }, [scores, battingTeam, innings, history, tournament, format, isMatchComplete, scoringPrompt.isInteractionLocked]);

  // Save match (complete)
  const saveMatch = (winnerOverride) => {
    if (!tournament || !match || scoringPrompt.isInteractionLocked) return;
    const canManualComplete = canManuallyCompleteUnlimitedMatch(format, innings);
    if (!isMatchComplete && !winnerOverride && !canManualComplete) {
      scoringPrompt.showWarning('Complete both innings before ending the match.');
      return;
    }

    if (!isMatchComplete && !winnerOverride && canManualComplete && innings === 1) {
      setInnings(2);
      setBattingTeam(2);
      setSaveWarning('');
      return;
    }

    if (scores.team1.balls > 0 || scores.team2.balls > 0) {
      triggerConfetti();
      triggerHaptic([100, 100, 100, 100, 100]);
    }

    const storageKey = sportConfig?.storageKey || 'se_cricket';

    // Determine winner
    let winner = winnerOverride || null;
    if (!winner) {
      if (scores.team1.runs > scores.team2.runs) winner = match.team1Id;
      else if (scores.team2.runs > scores.team1.runs) winner = match.team2Id;
      else winner = 'tie';
    }
    const completedMatch = {
      ...match,
      status: 'completed',
      battingOrder: [match.team1Id, match.team2Id],
      team1Score: { runs: scores.team1.runs, balls: scores.team1.balls, wickets: scores.team1.wickets, allOut: scores.team1.allOut },
      team2Score: { runs: scores.team2.runs, balls: scores.team2.balls, wickets: scores.team2.wickets, allOut: scores.team2.allOut },
      winner,
      format,
      superOver: superOverPhase !== 'inactive' ? superOver : undefined,
    };

    const updatedTournament = updateMatchInTournament(tournament, matchId, m => ({
      ...m,
      team1Score: completedMatch.team1Score,
      team2Score: completedMatch.team2Score,
      battingOrder: completedMatch.battingOrder,
      winner,
      winDesc: getLimitedOversResult(completedMatch),
      superOver: completedMatch.superOver,
      status: 'completed',
      draftState: undefined,
      completedAt: new Date().toISOString(),
    }));

    const ok = saveSportTournament(storageKey, updatedTournament);
    if (!ok) {
      setSaveWarning('Save failed - storage may be full. Export your data.');
      return;
    }
    setSaveWarning('');
    saveTournamentToConvex(updatedTournament);
    setTimeout(() => navigate(`/${sport || 'cricket'}/tournament/${id}`), 300);
  };

  // Cancel
  const handleCancel = () => scoringPrompt.cancelOrNavigate(hasChanges, navigateToTournament);
  const confirmPendingPrompt = () => scoringPrompt.confirmDiscard(navigateToTournament);

  if (!tournament || !match || !format) {
    return <div className="min-h-screen px-6 py-10 flex items-center justify-center">
      <p style={{ color: '#888' }}>Loading...</p>
    </div>;
  }

  // Last Man Stands indicator
  const isLastMan = format.lastManStands && currentScore.wickets >= maxWickets - 1 && currentScore.wickets < maxWickets;

  // Trial ball indicator
  const showTrialBall = format.trialBall && !trialBallUsed && innings === 1 && currentScore.balls === 0;

  // Super Over prompt
  if (superOverPhase === 'prompt') {
    return (
      <div className="mono-scorer-screen">
        <div className="mono-scorer-shell text-center" style={{ paddingTop: '80px' }}>
          {saveWarning && (
            <div className="mono-alert mono-alert-danger mb-4">
              {saveWarning}
            </div>
          )}
          <h2 className="text-2xl font-bold mb-4" style={{ color: '#111' }}>Match Tied!</h2>
          <p className="text-sm mb-2" style={{ color: '#888' }}>
            Both teams scored {scores.team1.runs}.
          </p>
          <p className="text-sm mb-8" style={{ color: '#888' }}>Play a Super Over?</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setSuperOver({ team1: { runs: 0, balls: 0, wickets: 0 }, team2: { runs: 0, balls: 0, wickets: 0 } });
                setSuperOverPhase('team1_batting');
              }}
              className="mono-btn-primary"
              style={{ padding: '12px 24px' }}
            >
              Super Over
            </button>
            <button
              onClick={() => saveMatch('tie')}
              className="mono-btn"
              style={{ padding: '12px 24px' }}
            >
              Accept Tie
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Super Over scoring UI
  if (superOverPhase === 'team1_batting' || superOverPhase === 'team2_batting') {
    const soTeam = superOverPhase === 'team1_batting' ? 'team1' : 'team2';
    const soName = superOverPhase === 'team1_batting' ? team1Name : team2Name;
    const soScore = superOver[soTeam];
    const soTarget = superOverPhase === 'team2_batting' ? superOver.team1.runs : null;
    const soDone = soScore.balls >= 6 || soScore.wickets >= 2;

    return (
      <div className="mono-scorer-screen">
        <div className="mono-scorer-shell">
          {saveWarning && (
            <div className="mono-alert mono-alert-danger mb-4">
              {saveWarning}
            </div>
          )}
          <div className="mono-scorer-topbar">
            <span className="text-sm" style={{ color: '#888' }}>Super Over</span>
            <span className="mono-badge mono-badge-live">{soName} batting</span>
          </div>

          <div className="mono-scorer-main-score">
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#888' }}>{soName}</p>
            <p className="mono-scorer-score-value font-bold font-mono mono-score mb-2" style={{ color: '#111' }}>
              {soScore.runs}<span style={{ color: '#bbb', fontSize: '0.5em' }}>/{soScore.wickets}</span>
            </p>
            <p className="text-sm font-mono" style={{ color: '#888' }}>
              {soScore.balls}/6 balls · {2 - soScore.wickets} wickets left
            </p>
            {soTarget !== null && (
              <p className="text-sm mt-2" style={{ color: '#0066ff' }}>
                Target: {soTarget + 1} · Need {Math.max(0, soTarget + 1 - soScore.runs)} from {6 - soScore.balls} balls
              </p>
            )}
          </div>

          {!soDone && (
            <>
              <div className="mono-scorer-run-grid">
                {CRICKET_RUN_VALUES.map(r => (
                  <button key={r} onClick={() => addSuperOverRuns(r)}
                    className={`${r === 4 || r === 6 ? 'mono-btn-primary' : 'mono-btn'} mono-scorer-run-button`}
                    style={{ width: '56px', height: '56px', fontSize: '1.25rem', fontWeight: 700, padding: 0, touchAction: 'manipulation' }}>
                    {r}
                  </button>
                ))}
              </div>
              <div className="mono-scorer-extra-row">
                <button onClick={addSuperOverExtra} className="mono-btn" style={{ padding: '10px 16px', fontSize: '0.8125rem', touchAction: 'manipulation' }}>
                  Wide (+1)
                </button>
                <button onClick={addSuperOverExtra} className="mono-btn" style={{ padding: '10px 16px', fontSize: '0.8125rem', touchAction: 'manipulation' }}>
                  No Ball (+1)
                </button>
              </div>
              <button onClick={addSuperOverWicket} className="mono-btn w-full"
                style={{ padding: '14px', fontSize: '0.9375rem', borderColor: '#f59e0b', color: '#92400e', background: '#fffbeb', touchAction: 'manipulation' }}>
                Wicket
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Super Over result
  if (superOverPhase === 'result') {
    const soWinner = superOver.team1.runs > superOver.team2.runs ? match.team1Id
      : superOver.team2.runs > superOver.team1.runs ? match.team2Id
      : null;

    if (!soWinner) {
      // Still tied — offer another super over
      return (
        <div className="mono-scorer-screen">
          <div className="mono-scorer-shell text-center" style={{ paddingTop: '80px' }}>
            {saveWarning && (
              <div className="mono-alert mono-alert-danger mb-4">
                {saveWarning}
              </div>
            )}
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#111' }}>Super Over Tied!</h2>
            <p className="text-sm mb-8" style={{ color: '#888' }}>
              {team1Name}: {superOver.team1.runs}/{superOver.team1.wickets} · {team2Name}: {superOver.team2.runs}/{superOver.team2.wickets}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => {
                setSuperOver({ team1: { runs: 0, balls: 0, wickets: 0 }, team2: { runs: 0, balls: 0, wickets: 0 } });
                setSuperOverPhase('team1_batting');
              }} className="mono-btn-primary" style={{ padding: '12px 24px' }}>
                Another Super Over
              </button>
              <button onClick={() => saveMatch('tie')} className="mono-btn" style={{ padding: '12px 24px' }}>
                Accept Tie
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Super Over decided
    saveMatch(soWinner);
    return null;
  }

  // Format display for overs/balls
  const oversDisplay = showOvers
    ? `${ballsToOvers(currentScore.balls)} ov${format.overs ? ' / ' + format.overs : ''}`
    : `${currentScore.balls} balls${format.maxBalls ? ' / ' + format.maxBalls : ''}`;

  return (
    <div className="mono-scorer-screen">
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
          <button
            onClick={handleCancel}
            className="text-sm bg-transparent border-none cursor-pointer font-swiss"
            style={{ color: '#888', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <BackArrow /> Back
          </button>
          <div className="mono-scorer-topbar-actions">
            {presetLabel && (
              <span className="mono-badge">{presetLabel}</span>
            )}
            <span className={`mono-badge ${isMatchComplete ? 'mono-badge-final' : 'mono-badge-live'}`}>
              {isMatchComplete ? 'Completed' : `Innings ${innings}`}
            </span>
          </div>
        </div>

        {/* Gully rule indicators */}
        {format.oneTipOneHand && (
          <p className="text-xs text-center mb-2" style={{ color: '#888' }}>One tip one hand active</p>
        )}

        {/* Trial ball banner */}
        {showTrialBall && (
          <div className="mono-alert mono-alert-info text-center mb-4" style={{ padding: '12px 16px' }}>
            <p className="text-sm font-medium" style={{ color: '#0066ff' }}>Trial Ball — first delivery doesn't count</p>
            <button
              onClick={skipTrialBall}
              className="mono-btn mt-2"
              style={{ padding: '6px 16px', fontSize: '0.75rem', borderColor: '#0066ff', color: '#0066ff' }}
            >
              Skip (Trial)
            </button>
          </div>
        )}

        {/* Batting team score */}
        <div className="mono-scorer-main-score">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#888' }}>
            {currentName} batting
          </p>
          <p key={scoreAnimKey} className="mono-scorer-score-value font-bold font-mono mono-score mono-score-animate mb-2" style={{ color: '#111' }}>
            {currentScore.runs}
            <span style={{ color: '#bbb', fontSize: '0.5em' }}>/{currentScore.wickets}</span>
          </p>
          <p className="text-sm font-mono mb-1" style={{ color: '#888' }}>
            {oversDisplay} &middot; RR {currentScore.balls > 0 ? calculateRunRate(currentScore.runs, currentScore.balls).toFixed(2) : '0.00'}
          </p>

          {/* Powerplay indicator */}
          {powerplayPhase && (
            <p className="text-xs mt-1" style={{ color: '#0066ff' }}>
              {powerplayPhase.label} (Overs {powerplayPhase.start}-{powerplayPhase.end})
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

          {/* Target line */}
          {target !== null && (
            <p className="text-sm mt-2" style={{ color: '#0066ff' }}>
              Target: {target + 1} &middot; Need {Math.max(0, target + 1 - currentScore.runs)}
              {totalBalls !== Infinity ? ` from ${totalBalls - currentScore.balls} balls` : ''}
            </p>
          )}

          {!isTouchDevice && (
            <p className="text-xs mt-3" style={{ color: '#ccc' }}>
              Keyboard: 0-6 = Runs &middot; W = Wicket &middot; E = Extra &middot; U = Undo
            </p>
          )}
        </div>

        {/* Other team score */}
        <div className="mono-score-mini text-center mb-4" style={{ padding: '12px 16px' }}>
          <p className="text-xs" style={{ color: '#888' }}>
            {otherName}: {otherScore.runs}/{otherScore.wickets}
            {' '}({showOvers ? `${ballsToOvers(otherScore.balls)} ov` : `${otherScore.balls} balls`})
          </p>
        </div>

        {/* Scoring controls */}
        {!isMatchComplete && (
          <>
            <div className="mono-scorer-run-grid">
              {CRICKET_RUN_VALUES.map(r => (
                <button
                  key={r}
                  onClick={() => addRuns(r)}
                  disabled={isInningsComplete || scoringPrompt.isInteractionLocked}
                  className={`${r === 4 || r === 6 ? 'mono-btn-primary' : 'mono-btn'} mono-scorer-run-button`}
                  style={{
                    width: '56px', height: '56px', fontSize: '1.25rem', fontWeight: 700, padding: 0,
                    opacity: isInningsComplete || scoringPrompt.isInteractionLocked ? 0.5 : 1, touchAction: 'manipulation',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="mono-scorer-extra-row">
              <button onClick={() => addExtra('wide')} disabled={isInningsComplete || scoringPrompt.isInteractionLocked} className="mono-btn"
                style={{ padding: '10px 16px', fontSize: '0.8125rem', opacity: isInningsComplete || scoringPrompt.isInteractionLocked ? 0.5 : 1, touchAction: 'manipulation' }}>
                Wide (+1)
              </button>
              <button onClick={() => addExtra('noBall')} disabled={isInningsComplete || scoringPrompt.isInteractionLocked} className="mono-btn"
                style={{ padding: '10px 16px', fontSize: '0.8125rem', opacity: isInningsComplete || scoringPrompt.isInteractionLocked ? 0.5 : 1, touchAction: 'manipulation' }}>
                No Ball (+1)
              </button>
            </div>

            <button onClick={addWicket} disabled={isInningsComplete || scoringPrompt.isInteractionLocked} className="mono-btn w-full mb-4"
              style={{ padding: '14px', fontSize: '0.9375rem', borderColor: '#f59e0b', color: '#92400e', background: '#fffbeb',
                opacity: isInningsComplete || scoringPrompt.isInteractionLocked ? 0.5 : 1, touchAction: 'manipulation' }}>
              {freeHit ? 'Run Out Only' : 'Wicket'}
            </button>
          </>
        )}

        {/* Innings complete message */}
        {isInningsComplete && !isMatchComplete && (
          <div className="text-center mb-6 py-4" style={{ borderTop: '1px solid #eee', borderBottom: '1px solid #eee' }}>
            <p className="text-sm font-medium" style={{ color: '#0066ff' }}>End of Innings</p>
            <p className="text-xs mt-1" style={{ color: '#888' }}>
              {currentName}: {currentScore.runs}/{currentScore.wickets}
              {' '}({showOvers ? ballsToOvers(currentScore.balls) : `${currentScore.balls} balls`})
            </p>
          </div>
        )}

        {/* Bottom bar */}
        <div className="mono-scorer-control-strip pt-4">
          <button
            onClick={() => saveMatch()}
            disabled={scoringPrompt.isInteractionLocked}
            className="mono-btn-primary w-full mb-3"
            style={{ padding: '12px', fontSize: '0.875rem', opacity: scoringPrompt.isInteractionLocked ? 0.45 : 1 }}
          >
            End Match
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
            {hasChanges && (
              <button
                onClick={saveDraft}
                disabled={scoringPrompt.isInteractionLocked}
                className="mono-btn flex-1"
                style={{ padding: '8px', fontSize: '0.8125rem', borderColor: '#0066ff', color: '#0066ff', opacity: scoringPrompt.isInteractionLocked ? 0.45 : 1 }}
              >
                Pause Match
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

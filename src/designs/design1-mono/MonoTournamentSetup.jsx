import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { saveSportTournament } from '../../utils/storage';
import { generateRoundRobinMatches } from '../../utils/roundRobin';
import { getSportById } from '../../models/sportRegistry';
import { OVERS_PRESETS, CRICKET_FORMATS, buildCricketFormat } from '../../utils/cricketCalculations';
import { getSportDefaults, applyStandardDefaults } from '../../utils/sportDefaults';

const STEP_LABELS = ['Basics', 'Match rules', 'Teams', 'Review'];

const mobileBackButtonStyle = {
  color: '#0066ff',
  minHeight: 44,
  padding: '8px 10px',
};

const stickyActionStyle = {
  position: 'sticky',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)',
  zIndex: 20,
  minHeight: 52,
  padding: '12px',
  fontSize: '0.9375rem',
  boxShadow: '0 -10px 20px rgba(250, 250, 250, 0.92)',
};

function getCricketReviewLabel(format) {
  const presetName = format.preset
    ? (CRICKET_FORMATS.find(f => f.id === format.preset)?.name || format.preset)
    : 'Custom';
  const oversLabel = format.overs ? format.overs + ' ov' : 'No limit';
  return presetName + ' - ' + oversLabel + ' - ' + format.players + 'p';
}

function getSetsReviewLabel(format) {
  const scoringLabel = format.scoringMode === 'side-out' ? ' - side-out' : '';
  if (format.type === 'best-of') return `Best of ${format.sets} - ${format.points} pts${scoringLabel}`;
  return `Single set - ${format.points} pts${scoringLabel}`;
}

function getGoalsReviewLabel(format) {
  if (format.mode === 'free') return 'Free play';
  if (format.mode === 'timed') return `${Math.floor(format.timeLimit / 60)} min`;
  return `First to ${format.target}`;
}

function getFormatReviewLabel({ format, isCricket, sportConfig }) {
  if (!format) return 'Not set';
  if (isCricket) return getCricketReviewLabel(format);
  if (sportConfig?.engine === 'sets') return getSetsReviewLabel(format);
  if (sportConfig?.engine === 'goals') return getGoalsReviewLabel(format);
  return 'Custom';
}

// Standard squad sizes per sport (playing + subs)
const SQUAD_LIMITS = {
  volleyball: { playing: 6, max: 14 },
  badminton: { playing: 1, max: 2 },
  tabletennis: { playing: 1, max: 2 },
  tennis: { playing: 1, max: 2 },
  pickleball: { playing: 2, max: 4 },
  squash: { playing: 1, max: 2 },
  football: { playing: 11, max: 23 },
  basketball: { playing: 5, max: 15 },
  hockey: { playing: 11, max: 18 },
  handball: { playing: 7, max: 16 },
  futsal: { playing: 5, max: 14 },
  kabaddi: { playing: 7, max: 12 },
  rugby: { playing: 15, max: 23 },
  cricket: { playing: 11, max: 16 },
};

function makeTeam(index, existing, suggestedName) {
  return {
    id: existing?.id || `team-${Date.now()}-${index}`,
    name: existing?.name || suggestedName || `Team ${index + 1}`,
    members: existing?.members || [],
  };
}

export default function MonoTournamentSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sport } = useParams();
  const [searchParams] = useSearchParams();
  const preselectedFormat = searchParams.get('format'); // e.g. ?format=T20
  const sportConfig = getSportById(sport);
  const wizardTeams = Array.isArray(location.state?.teams)
    ? location.state.teams.map((t) => t?.trim()).filter(Boolean).slice(0, 8)
    : [];
  const wizardTournamentName = typeof location.state?.tournamentName === 'string'
    ? location.state.tournamentName.trim()
    : '';
  const wizardTeamCount = wizardTeams.length >= 2 ? wizardTeams.length : 4;

  const [step, setStep] = useState(1);
  const [formatMode, setFormatMode] = useState('standard');
  const [name, setName] = useState(wizardTournamentName);
  const [tournamentType, setTournamentType] = useState(wizardTeams.length >= 2 ? 'round-robin' : null);
  const [seriesGames, setSeriesGames] = useState(3);
  const [teamCount, setTeamCount] = useState(wizardTeamCount);
  const [teams, setTeams] = useState(() => wizardTeams.map((teamName, idx) => makeTeam(idx, null, teamName)));
  const [format, setFormat] = useState(null);
  const [customOvers, setCustomOvers] = useState('');
  const [showCustomOvers, setShowCustomOvers] = useState(false);
  const visible = true;
  const [cricketPreset, setCricketPreset] = useState('T20');
  const [winnerMode, setWinnerMode] = useState('table-topper');
  const [teamsAdvancing, setTeamsAdvancing] = useState(2);
  const [thirdPlaceMatch, setThirdPlaceMatch] = useState(false);
  const [knockoutSameFormat, setKnockoutSameFormat] = useState(true);
  const [knockoutFormat, setKnockoutFormat] = useState(null);
  const [playerInputs, setPlayerInputs] = useState({});
  const [captains, setCaptains] = useState({}); // { teamIdx: playerName }
  const [showFormatGrid, setShowFormatGrid] = useState(false);
  const [showHouseRules, setShowHouseRules] = useState(false);
  const [saveWarning, setSaveWarning] = useState('');

  const isCricket = sportConfig?.engine === 'custom-cricket';
  const supportedScoringModes = sportConfig?.config?.scoringModes || [];
  const canConfigureScoringMode = sportConfig?.engine === 'sets' && supportedScoringModes.length > 1;

  const ensureScoringMode = (nextFormat, previousFormat) => {
    if (!canConfigureScoringMode) return nextFormat;
    const fallback = previousFormat?.scoringMode
      || nextFormat?.scoringMode
      || sportConfig?.config?.defaultScoringMode
      || supportedScoringModes[0];
    return {
      ...nextFormat,
      scoringModes: supportedScoringModes,
      scoringMode: supportedScoringModes.includes(fallback) ? fallback : supportedScoringModes[0],
    };
  };

  // Auto-configure from URL query param (e.g. ?format=T20)
  useEffect(() => {
    if (!preselectedFormat || !isCricket) return;
    const matched = CRICKET_FORMATS.find(f => f.id === preselectedFormat);
    if (!matched) return;
    setCricketPreset(matched.id);
    setFormatMode(matched.customizable ? 'custom' : 'standard');
    setFormat(buildCricketFormat(matched.id));
  }, []); // Run once on mount

  // Initialize format based on sport and format mode
  useEffect(() => {
    if (!sportConfig || format !== null) return;

    // Try standard defaults first
    if (formatMode === 'standard') {
      const defaults = getSportDefaults(sport);
      if (defaults && Object.keys(defaults).length > 0) {
        setFormat(ensureScoringMode(applyStandardDefaults(sport, {}), format));
        return;
      }
    }

    // Fallback: engine-specific defaults
    if (sportConfig.engine === 'custom-cricket') {
      setFormat({ overs: 5, players: 6, solo: true });
    } else if (sportConfig.engine === 'sets') {
      setFormat(ensureScoringMode({ type: 'best-of', sets: 3, points: sportConfig.config.pointsPerSet }, format));
    } else if (sportConfig.engine === 'goals') {
      setFormat({ mode: 'free' });
    }
  }, [sportConfig, format, formatMode, sport]);

  // Apply standard defaults when format mode changes to 'standard'
  useEffect(() => {
    if (formatMode === 'standard' && sport && format) {
      const defaults = getSportDefaults(sport);
      if (defaults && Object.keys(defaults).length > 0) {
        setFormat(ensureScoringMode(applyStandardDefaults(sport, {}), format));
      }
    }
  }, [formatMode, sport]);

  const teamCountOptions = [2, 3, 4, 5, 6, 7, 8];

  const initTeams = (count) => {
    setTeams((prev) => {
      if (prev.length === count) return prev;
      return Array.from({ length: count }, (_, i) => makeTeam(i, prev[i], wizardTeams[i]));
    });
  };

  // Ensure wizard prefill is applied once even if route state arrives without refresh.
  useEffect(() => {
    if (wizardTournamentName && !name) {
      setName(wizardTournamentName);
    }
  }, [wizardTournamentName, name]);

  // Step navigation
  const canAdvanceStep1 = name.trim() && tournamentType;

  const goToStep = (target) => {
    if (target === 3) {
      // Initialize teams when entering step 3 without wiping existing edits.
      initTeams(teamCount);
    }
    setStep(target);
  };

  const updateTeamName = (index, newName) => {
    setTeams(prev => prev.map((t, i) => i === index ? { ...t, name: newName } : t));
  };

  const squadLimit = SQUAD_LIMITS[sport] || { playing: 11, max: 30 };

  const addMembers = (teamIdx, input) => {
    // Split by comma or newline, trim, filter empties
    const names = input.split(/[,\n]/).map(n => n.trim()).filter(Boolean);
    if (names.length === 0) return;
    setTeams(prev => prev.map((t, i) => {
      if (i !== teamIdx) return t;
      const remaining = squadLimit.max - t.members.length;
      const toAdd = names.slice(0, Math.max(0, remaining));
      return { ...t, members: [...t.members, ...toAdd] };
    }));
    setPlayerInputs(prev => ({ ...prev, [teamIdx]: '' }));
  };

  const removeMember = (teamIdx, memberIdx) => {
    setTeams(prev => {
      const removed = prev[teamIdx].members[memberIdx];
      const updated = [...prev];
      updated[teamIdx] = { ...updated[teamIdx], members: updated[teamIdx].members.filter((_, mi) => mi !== memberIdx) };
      // Clear captain if removed player was captain
      if (captains[teamIdx] === removed) {
        setCaptains(p => { const n = { ...p }; delete n[teamIdx]; return n; });
      }
      return updated;
    });
  };

  const toggleCaptain = (teamIdx, playerName) => {
    setCaptains(prev => {
      if (prev[teamIdx] === playerName) {
        const n = { ...prev }; delete n[teamIdx]; return n;
      }
      return { ...prev, [teamIdx]: playerName };
    });
  };

  // Generate matches based on tournament type
  const generateMatches = () => {
    if (tournamentType === 'series') {
      return Array.from({ length: seriesGames }, (_, i) => ({
        id: `${Date.now()}-${i}`,
        team1Id: teams[0].id,
        team2Id: teams[1].id,
        status: 'pending',
      }));
    }
    if (teamCount === 2) {
      return [{ id: `${Date.now()}-0`, team1Id: teams[0].id, team2Id: teams[1].id, status: 'pending' }];
    }
    return generateRoundRobinMatches(teams);
  };

  // Add engine-specific fields to matches
  const initializeMatches = (matches) => {
    if (sportConfig.engine === 'sets') return matches.map(m => ({ ...m, sets: [], status: 'pending' }));
    if (sportConfig.engine === 'goals') return matches.map(m => ({ ...m, score1: null, score2: null, status: 'pending' }));
    if (sportConfig.engine === 'custom-cricket') return matches.map(m => ({ ...m, team1Score: null, team2Score: null, format, status: 'pending' }));
    return matches;
  };

  const startTournament = () => {
    if (!sportConfig) return;
    if (teams.some(t => !t.name.trim())) return;

    const initializedMatches = initializeMatches(generateMatches());

    const isKnockout = tournamentType === 'round-robin' && teamCount >= 3 && winnerMode === 'knockouts';

    // Attach captain to each team object
    const teamsWithCaptains = teams.map((t, i) => captains[i] ? { ...t, captain: captains[i] } : t);

    const tournament = {
      id: Date.now(),
      name: name.trim(),
      type: tournamentType,
      teams: teamsWithCaptains,
      matches: initializedMatches,
      format,
      createdAt: new Date().toISOString(),
      mode: 'tournament',
      winnerMode: isKnockout ? 'knockouts' : 'table-topper',
      phase: 'group',
      knockoutConfig: isKnockout ? {
        teamsAdvancing,
        thirdPlaceMatch: teamsAdvancing === 4 ? thirdPlaceMatch : false,
        format: knockoutSameFormat ? format : (knockoutFormat || format),
      } : null,
      knockoutMatches: [],
    };

    const ok = saveSportTournament(sportConfig.storageKey, tournament);
    if (!ok) {
      setSaveWarning('Save failed - storage may be full. Export your data.');
      return;
    }
    setSaveWarning('');
    navigate(`/${sport}/tournament/${tournament.id}`);
  };

  // Format description helper
  const getFormatDescription = (f) => {
    if (!f) return 'Not set';
    if (isCricket) {
      const oversLabel = f.overs ? f.overs + ' overs' : 'No limit';
      return `${oversLabel} · ${f.players || 6} players`;
    }
    if (sportConfig.engine === 'sets') {
      const scoringLabel = f.scoringMode === 'side-out' ? ' · side-out' : '';
      if (f.type === 'best-of') return `Best of ${f.sets} sets · ${f.points} pts${scoringLabel}`;
      return `Single set · ${f.points} pts${scoringLabel}`;
    }
    if (f.mode === 'free') return 'Free play';
    if (f.mode === 'timed') return `${Math.floor((f.timeLimit || 0) / 60)} min time limit`;
    return `First to ${f.target} ${sportConfig?.config?.scoringUnit || 'point'}s`;
  };

  const matchCountPreview = tournamentType === 'series'
    ? seriesGames
    : (teamCount * (teamCount - 1)) / 2;

  const finalStageLabel = (() => {
    if (tournamentType !== 'round-robin' || teamCount < 3) return null;
    if (winnerMode !== 'knockouts') return 'Standings';
    const suffix = thirdPlaceMatch ? ' + 3rd place' : '';
    return `Playoffs (Top ${teamsAdvancing}${suffix})`;
  })();

  const tournamentTypePreset = (() => {
    if (tournamentType === 'series') return 'series';
    if (winnerMode === 'knockouts') return 'group-knockout';
    return 'round-robin';
  })();

  const tournamentTypeReviewLabel = (() => {
    if (tournamentType === 'series') return `${seriesGames}-match series`;
    if (winnerMode === 'knockouts') return `Group + playoffs`;
    return 'Round-robin';
  })();

  const tournamentTypeDescription = (() => {
    if (tournamentTypePreset === 'group-knockout') {
      return 'Group matches first, then playoffs decide the winner';
    }
    if (tournamentType === 'round-robin') return 'Multiple teams, everyone plays everyone';
    return '2 teams compete in a series of matches';
  })();

  const teamNameById = (teamId) => teams.find(t => t.id === teamId)?.name || 'TBD';

  const schedulePreview = (() => {
    if (tournamentType === 'series') {
      return Array.from({ length: Math.min(seriesGames, 4) }, (_, i) => ({
        label: `Match ${i + 1}`,
        team1Id: teams[0]?.id,
        team2Id: teams[1]?.id,
      }));
    }
    if (teamCount === 2) {
      return [{ label: 'Match 1', team1Id: teams[0]?.id, team2Id: teams[1]?.id }];
    }
    return generateRoundRobinMatches(teams).slice(0, 4).map((match, i) => ({
      ...match,
      label: `Match ${i + 1}`,
    }));
  })();

  const formatReviewLabel = getFormatReviewLabel({ format, isCricket, sportConfig });

  if (!sportConfig) {
    return (
      <div className="min-h-screen px-6 py-10 flex items-center justify-center">
        <p style={{ color: '#888' }}>Sport not found</p>
      </div>
    );
  }

  if (!format) {
    return null;
  }

  return (
    <div className={`min-h-screen px-6 py-10 mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>
      <div className="max-w-2xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 mb-6" aria-label="Breadcrumb">
          <button
            onClick={() => navigate('/')}
            className="text-sm bg-transparent border-none cursor-pointer font-swiss"
            style={{ color: '#888' }}
          >
            Home
          </button>
          <span style={{ color: '#ccc' }} aria-hidden="true">/</span>
          <span className="text-sm" style={{ color: '#111' }} aria-current="page">
            {sportConfig.name} Tournament
          </span>
        </nav>

        <h1 className="text-xl font-semibold tracking-tight mb-4" style={{ color: '#111' }}>
          New Tournament
        </h1>
        {saveWarning && (
          <div className="mono-card mb-4" style={{ padding: '10px 12px', borderColor: '#dc2626', color: '#dc2626' }}>
            {saveWarning}
          </div>
        )}

        {/* Step indicator */}
        <div className="grid grid-cols-4 gap-2 mb-8" aria-label="Tournament setup progress">
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1;
            const isActive = stepNum === step;
            const isDone = stepNum < step;
            let stepBg = '#eee';
            if (isActive) stepBg = '#0066ff';
            else if (isDone) stepBg = '#111';
            return (
              <div key={label} className="flex flex-col items-center gap-1 text-center">
                <div
                  style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.6875rem', fontWeight: 600,
                    background: stepBg,
                    color: isActive || isDone ? '#fff' : '#888',
                  }}
                >
                  {isDone ? '✓' : stepNum}
                </div>
                <span
                  className="text-xs font-swiss"
                  style={{ color: isActive ? '#111' : '#888', lineHeight: 1.15 }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* ──────────────────────────────────────────────── */}
        {/* Step 1: Basics — Name, Type, Team Count         */}
        {/* ──────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="animate-fade-in">
            {/* Tournament Name */}
            <div className="mb-8">
              <label htmlFor="tournament-name" className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                Tournament name
              </label>
              <input
                id="tournament-name"
                type="text"
                className="mono-input text-lg"
                placeholder={isCricket ? 'Weekend Cricket League' : `${sportConfig.name} Championship`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Tournament Type */}
            <div className="mb-8">
              <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                Tournament type
              </span>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                <button
                  onClick={() => {
                    setTournamentType('round-robin');
                    setWinnerMode('table-topper');
                    setTeamCount(4);
                  }}
                  className={tournamentTypePreset === 'round-robin' ? 'mono-btn-primary' : 'mono-btn'}
                  style={{ minHeight: 44, padding: '10px 12px', fontSize: '0.8125rem' }}
                  aria-pressed={tournamentTypePreset === 'round-robin'}
                >
                  Round-robin
                </button>
                <button
                  onClick={() => {
                    setTournamentType('round-robin');
                    setWinnerMode('knockouts');
                    setTeamCount(prev => Math.max(prev, 4));
                  }}
                  className={tournamentTypePreset === 'group-knockout' ? 'mono-btn-primary' : 'mono-btn'}
                  style={{ minHeight: 44, padding: '10px 12px', fontSize: '0.8125rem' }}
                  aria-pressed={tournamentTypePreset === 'group-knockout'}
                >
                  Group + Playoffs
                </button>
                <button
                  onClick={() => {
                    setTournamentType('series');
                    setWinnerMode('table-topper');
                    setTeamCount(2);
                  }}
                  className={tournamentTypePreset === 'series' ? 'mono-btn-primary' : 'mono-btn'}
                  style={{ minHeight: 44, padding: '10px 12px', fontSize: '0.8125rem' }}
                  aria-pressed={tournamentTypePreset === 'series'}
                >
                  Series
                </button>
              </div>
              <p className="text-xs mt-2" style={{ color: '#bbb' }}>{tournamentTypeDescription}</p>
            </div>

            {/* Team Count (Round-robin only) */}
            {tournamentType === 'round-robin' && (
              <fieldset className="mb-8" style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888', padding: 0 }}>
                  Number of teams
                </legend>
                <div className="flex gap-2">
                  {teamCountOptions.map(n => (
                    <button
                      key={n}
                      onClick={() => setTeamCount(n)}
                      className={teamCount === n ? 'mono-btn-primary' : 'mono-btn'}
                      style={{ width: '44px', height: '44px', padding: 0, fontSize: '0.9375rem' }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: '#888' }}>
                  Will generate {teamCount === 2 ? '1 match' : `${(teamCount * (teamCount - 1)) / 2} matches`}
                  {teamCount >= 3 && ' (round-robin format)'}
                </p>
              </fieldset>
            )}

            {/* Series Length (Series only) */}
            {tournamentType === 'series' && (
              <div className="mb-8">
                <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                  Matches in series
                </span>
                <div className="flex gap-2">
                  {[1, 3, 5, 7].map(n => (
                    <button
                      key={n}
                      onClick={() => setSeriesGames(n)}
                      className={seriesGames === n ? 'mono-btn-primary' : 'mono-btn'}
                      style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                    >
                      {n === 1 ? '1 match' : `${n} matches`}
                    </button>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: '#888' }}>
                  {seriesGames === 1 ? 'Single match series' : `${seriesGames}-match series`}
                </p>
              </div>
            )}

            {/* Pre-selected format badge */}
            {preselectedFormat && isCricket && (
              <div className="mb-4 p-3 mono-card" style={{ background: '#f0f6ff', borderColor: '#bfdbfe' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase tracking-widest font-normal" style={{ color: '#888' }}>Format</span>
                    <p className="text-sm font-medium mt-1" style={{ color: '#111' }}>
                      {CRICKET_FORMATS.find(f => f.id === preselectedFormat)?.name || preselectedFormat}
                      <span className="text-xs font-normal ml-2" style={{ color: '#888' }}>
                        {CRICKET_FORMATS.find(f => f.id === preselectedFormat)?.desc}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs" style={{ color: '#0066ff' }}>Pre-selected</span>
                </div>
              </div>
            )}

            <button
              onClick={() => goToStep(2)}
              className="mono-btn-primary w-full"
              style={{ ...stickyActionStyle, opacity: canAdvanceStep1 ? 1 : 0.4 }}
              disabled={!canAdvanceStep1}
            >
              {preselectedFormat && isCricket ? 'Next: Review Format' : 'Next: Match Rules'}
            </button>
          </div>
        )}

        {/* ──────────────────────────────────────────────── */}
        {/* Step 2: Match Rules — Format, Playoffs           */}
        {/* ──────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-medium" style={{ color: '#111' }}>
                How should matches be played?
              </span>
              <button
                onClick={() => setStep(1)}
                className="text-xs bg-transparent border-none cursor-pointer font-swiss"
                style={mobileBackButtonStyle}
              >
                Back
              </button>
            </div>

            {/* Format Mode — non-cricket sports */}
            {!isCricket && (
              <div className="mb-8">
                <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                  Format mode
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormatMode('standard')}
                    className={formatMode === 'standard' ? 'mono-btn-primary' : 'mono-btn'}
                    style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                  >
                    Standard
                  </button>
                  <button
                    onClick={() => setFormatMode('custom')}
                    className={formatMode === 'custom' ? 'mono-btn-primary' : 'mono-btn'}
                    style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                  >
                    Custom
                  </button>
                </div>
                <p className="text-xs mt-2" style={{ color: '#bbb' }}>
                  {formatMode === 'standard'
                    ? 'Official rules for this sport'
                    : 'Customize all format options'}
                </p>
              </div>
            )}

            {/* Cricket Format — pre-selected summary or full grid */}
            {isCricket && (
              <div className="mb-8">
                {preselectedFormat && !showFormatGrid ? (
                  /* Show selected format with change option */
                  <div>
                    <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                      Format
                    </span>
                    <div className="mono-card p-4 mb-2" style={{ background: '#f0f6ff', borderColor: '#bfdbfe' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#111' }}>
                            {CRICKET_FORMATS.find(f => f.id === cricketPreset)?.name || cricketPreset}
                          </p>
                          <p className="text-xs mt-1" style={{ color: '#888' }}>
                            {CRICKET_FORMATS.find(f => f.id === cricketPreset)?.desc}
                          </p>
                        </div>
                        <button
                          onClick={() => setShowFormatGrid(true)}
                          className="text-xs bg-transparent border-none cursor-pointer font-swiss"
                          style={{ color: '#0066ff' }}
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Full format grid */
                  <div>
                    <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                      Format
                    </span>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {CRICKET_FORMATS.map(cf => (
                        <button
                          key={cf.id}
                          onClick={() => {
                            setCricketPreset(cf.id);
                            setFormatMode(cf.customizable ? 'custom' : 'standard');
                            setFormat(buildCricketFormat(cf.id));
                            setShowCustomOvers(false);
                            setCustomOvers('');
                            if (preselectedFormat) setShowFormatGrid(false);
                          }}
                          className={cricketPreset === cf.id ? 'mono-btn-primary' : 'mono-btn'}
                          style={{ padding: '12px 8px', fontSize: '0.8125rem', textAlign: 'center' }}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-semibold">{cf.name}</span>
                            <span className="text-xs font-normal" style={{ opacity: 0.7 }}>{cf.desc}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cricket sub-options (Gully and Custom only) */}
            {isCricket && (cricketPreset === 'gully' || cricketPreset === 'custom') && format && (
              <div className="mb-8">
                {cricketPreset === 'custom' && (
                  <div className="mb-6">
                    <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                      Scoring format
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFormat(prev => ({ ...prev, trackOvers: true, maxBalls: null }))}
                        className={format.trackOvers === false ? 'mono-btn' : 'mono-btn-primary'}
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

                {cricketPreset === 'custom' && format.trackOvers === false && (
                  <div className="mb-6">
                    <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                      Ball limit
                    </span>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setFormat(prev => ({ ...prev, maxBalls: null }))}
                        className={format.maxBalls === null || format.maxBalls === undefined ? 'mono-btn-primary' : 'mono-btn'}
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
                        {format.maxBalls || '∞'}
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

                <div className="mb-6">
                  <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                    Players
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
                </div>

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
                      ? `One team bats, other bowls · ${(format.players || 6) - 1} wickets`
                      : `Both teams bat and bowl · ${(format.players || 6) - 1} wickets`
                    }
                  </p>
                </div>

                {cricketPreset === 'custom' && (
                  <div className="mb-6">
                    <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                      Innings format
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFormat(prev => ({ ...prev, totalInnings: 2, declaration: false, followOn: false }))}
                        className={format.totalInnings === 2 ? 'mono-btn-primary' : 'mono-btn'}
                        style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                      >
                        1 per side (2 total)
                      </button>
                      <button
                        onClick={() => setFormat(prev => ({ ...prev, totalInnings: 4, declaration: true, followOn: true }))}
                        className={format.totalInnings === 4 ? 'mono-btn-primary' : 'mono-btn'}
                        style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                      >
                        2 per side (4 total)
                      </button>
                    </div>
                    <p className="text-xs mt-2" style={{ color: '#bbb' }}>
                      Innings count is independent of overs
                    </p>
                  </div>
                )}

                {cricketPreset === 'gully' && (
                  <div className="mb-6">
                    <button
                      onClick={() => setShowHouseRules(!showHouseRules)}
                      className="text-xs bg-transparent border-none cursor-pointer font-swiss"
                      style={{ color: '#0066ff', padding: '8px 0', marginBottom: showHouseRules ? 8 : 0 }}
                    >
                      {showHouseRules ? '- Hide house rules' : '+ House rules'}
                    </button>
                    {showHouseRules && (
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
                          {format.lastManStands && 'Last batter plays alone · '}
                          {format.trialBall && 'First ball doesn\'t count · '}
                          {format.oneTipOneHand && 'One-bounce catch = out'}
                          {!format.lastManStands && !format.trialBall && !format.oneTipOneHand && 'Toggle rules on/off'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Goals-based format — custom mode only */}
            {formatMode === 'custom' && sportConfig.engine === 'goals' && (
              <div className="mb-8">
                <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                  Match mode
                </span>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setFormat({ mode: 'free' })}
                    className={format.mode === 'free' ? 'mono-btn-primary' : 'mono-btn'}
                    style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                  >
                    Free play
                  </button>
                  <button
                    onClick={() => setFormat({ mode: 'timed', timeLimit: sportConfig.config.timePresets?.[0]?.value || 1800 })}
                    className={format.mode === 'timed' ? 'mono-btn-primary' : 'mono-btn'}
                    style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                  >
                    By time
                  </button>
                  <button
                    onClick={() => setFormat({ mode: 'points', target: sportConfig.config.pointPresets?.[0] || 10 })}
                    className={format.mode === 'points' ? 'mono-btn-primary' : 'mono-btn'}
                    style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                  >
                    By points
                  </button>
                </div>

                {format.mode === 'timed' && (
                  <div className="mt-6">
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
                  <div className="mt-6">
                    <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                      First to
                    </span>
                    <div className="flex gap-2 flex-wrap">
                      {(sportConfig.config.pointPresets || [5, 10, 15, 20]).map(pts => (
                        <button
                          key={pts}
                          onClick={() => setFormat({ mode: 'points', target: pts })}
                          className={format.target === pts ? 'mono-btn-primary' : 'mono-btn'}
                          style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                        >
                          {pts} {sportConfig.config.scoringUnit || 'point'}s
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sets-based format — custom mode only */}
            {formatMode === 'custom' && sportConfig.engine === 'sets' && sportConfig.config.setFormats && (
              <div className="mb-8">
                <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                  Format
                </span>

                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setFormat(prev => ensureScoringMode({ type: 'best-of', sets: 3, points: sportConfig.config.pointsPerSet }, prev))}
                    className={format.type === 'best-of' ? 'mono-btn-primary' : 'mono-btn'}
                    style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                  >
                    Best-of
                  </button>
                  <button
                    onClick={() => setFormat(prev => ensureScoringMode({ type: 'single', points: 15 }, prev))}
                    className={format.type === 'single' ? 'mono-btn-primary' : 'mono-btn'}
                    style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                  >
                    Single set
                  </button>
                </div>

                {format.type === 'best-of' && (
                  <div className="mt-6">
                    <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                      Sets
                    </span>
                    <div className="flex gap-2 flex-wrap">
                      {sportConfig.config.setFormats.map((formatOption, idx) => (
                        <button
                          key={formatOption.sets}
                          onClick={() => setFormat(prev => ensureScoringMode({ ...prev, sets: formatOption.sets }, prev))}
                          className={format.sets === formatOption.sets ? 'mono-btn-primary' : 'mono-btn'}
                          style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                        >
                          {formatOption.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6">
                  <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                    Points to win
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    {[10, 15, 21, 25].map(pts => (
                      <button
                        key={pts}
                        onClick={() => setFormat(prev => ensureScoringMode({ ...prev, points: pts }, prev))}
                        className={format.points === pts ? 'mono-btn-primary' : 'mono-btn'}
                        style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                      >
                        {pts} pts
                      </button>
                    ))}
                  </div>
                </div>

                {canConfigureScoringMode && (
                  <div className="mt-6">
                    <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                      Scoring mode
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFormat(prev => ensureScoringMode({ ...prev, scoringMode: 'rally' }, prev))}
                        className={(format.scoringMode || sportConfig?.config?.defaultScoringMode || 'rally') === 'rally' ? 'mono-btn-primary' : 'mono-btn'}
                        style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                      >
                        Rally
                      </button>
                      <button
                        onClick={() => setFormat(prev => ensureScoringMode({ ...prev, scoringMode: 'side-out' }, prev))}
                        className={(format.scoringMode || sportConfig?.config?.defaultScoringMode || 'rally') === 'side-out' ? 'mono-btn-primary' : 'mono-btn'}
                        style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                      >
                        Side-out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* After Group Stage (Round-robin, 3+ teams only) */}
            {tournamentType === 'round-robin' && teamCount >= 3 && (
              <>
                <hr className="mono-divider mb-8" />

                <div className="mb-8">
                  <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                    After group stage
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setWinnerMode('table-topper')}
                      className={winnerMode === 'table-topper' ? 'mono-btn-primary' : 'mono-btn'}
                      style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                    >
                      Standings decide
                    </button>
                    <button
                      onClick={() => setWinnerMode('knockouts')}
                      className={winnerMode === 'knockouts' ? 'mono-btn-primary' : 'mono-btn'}
                      style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                    >
                      Playoffs
                    </button>
                  </div>
                  <p className="text-xs mt-2" style={{ color: '#bbb' }}>
                    {winnerMode === 'table-topper'
                      ? 'Team at the top of the table wins the tournament'
                      : 'Top teams play elimination matches to decide the winner'}
                  </p>
                </div>

                {/* Playoff Configuration */}
                {winnerMode === 'knockouts' && (
                  <div className="mb-8" style={{ borderLeft: '2px solid #0066ff', paddingLeft: '16px' }}>
                    <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                      Playoff spots
                    </span>
                    <div className="flex gap-2 mb-1">
                      <button
                        onClick={() => { setTeamsAdvancing(2); setThirdPlaceMatch(false); }}
                        className={teamsAdvancing === 2 ? 'mono-btn-primary' : 'mono-btn'}
                        style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1 }}
                      >
                        Top 2
                      </button>
                      <button
                        onClick={() => setTeamsAdvancing(4)}
                        className={teamsAdvancing === 4 ? 'mono-btn-primary' : 'mono-btn'}
                        style={{ padding: '8px 16px', fontSize: '0.8125rem', flex: 1, opacity: teamCount < 4 ? 0.4 : 1 }}
                        disabled={teamCount < 4}
                      >
                        Top 4
                      </button>
                    </div>
                    <p className="text-xs mt-1 mb-4" style={{ color: '#bbb' }}>
                      {teamsAdvancing === 2
                        ? '1st vs 2nd in the final'
                        : '1st vs 4th and 2nd vs 3rd in semi-finals, then a final'}
                    </p>

                    {teamsAdvancing === 4 && teamCount >= 4 && (
                      <label className="flex items-center gap-2 mb-4 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={thirdPlaceMatch}
                          onChange={() => setThirdPlaceMatch(!thirdPlaceMatch)}
                          className="sr-only"
                        />
                        <span
                          aria-hidden="true"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '18px', height: '18px', border: '1px solid #ddd',
                            background: thirdPlaceMatch ? '#0066ff' : '#fff', color: '#fff',
                            fontSize: '11px', flexShrink: 0,
                          }}
                        >
                          {thirdPlaceMatch && '✓'}
                        </span>
                        <span className="text-sm" style={{ color: '#444' }}>
                          Include 3rd place match
                        </span>
                      </label>
                    )}

                    <hr className="mono-divider mb-4" />

                    {/* Playoff match rules */}
                    <span className="text-xs uppercase tracking-widest font-normal mb-3 block" style={{ color: '#888' }}>
                      Playoff match rules
                    </span>

                    <div
                      className="mono-card p-3 mb-3"
                      style={{ background: knockoutSameFormat ? '#f8f8f8' : '#fff' }}
                    >
                      <p className="text-sm" style={{ color: '#111' }}>
                        {getFormatDescription(knockoutSameFormat ? format : knockoutFormat)}
                      </p>
                      <p className="text-xs mt-1" style={{ color: '#888' }}>
                        {knockoutSameFormat ? 'Same rules as group stage' : 'Custom rules for playoffs'}
                      </p>
                    </div>

                    <label className="flex items-center gap-2 mb-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!knockoutSameFormat}
                        onChange={() => {
                          if (knockoutSameFormat) {
                            setKnockoutSameFormat(false);
                            setKnockoutFormat(format ? { ...format } : null);
                          } else {
                            setKnockoutSameFormat(true);
                            setKnockoutFormat(null);
                          }
                        }}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '18px', height: '18px', border: '1px solid #ddd',
                          background: knockoutSameFormat ? '#fff' : '#0066ff', color: '#fff',
                          fontSize: '11px', flexShrink: 0,
                        }}
                      >
                        {!knockoutSameFormat && '✓'}
                      </span>
                      <span className="text-sm" style={{ color: '#444' }}>
                        Use different rules for playoffs
                      </span>
                    </label>

                    {/* Playoff format options (when customized) */}
                    {!knockoutSameFormat && sportConfig?.engine === 'sets' && sportConfig.config.setFormats && (
                      <div className="mt-2 p-4 mono-card">
                        <div className="flex gap-2 mb-3">
                          <button
                            onClick={() => setKnockoutFormat(prev => ({ ...prev, type: 'best-of', sets: 3, points: prev?.points || sportConfig.config.pointsPerSet }))}
                            className={knockoutFormat?.type === 'best-of' ? 'mono-btn-primary' : 'mono-btn'}
                            style={{ padding: '6px 12px', fontSize: '0.75rem', flex: 1 }}
                          >
                            Best-of
                          </button>
                          <button
                            onClick={() => setKnockoutFormat(prev => ({ ...prev, type: 'single', points: prev?.points || 15 }))}
                            className={knockoutFormat?.type === 'single' ? 'mono-btn-primary' : 'mono-btn'}
                            style={{ padding: '6px 12px', fontSize: '0.75rem', flex: 1 }}
                          >
                            Single set
                          </button>
                        </div>
                        {knockoutFormat?.type === 'best-of' && (
                          <div className="flex gap-2 mb-3">
                            {sportConfig.config.setFormats.filter(f => f.sets > 1).map(f => (
                              <button
                                key={f.sets}
                                onClick={() => setKnockoutFormat(prev => ({ ...prev, sets: f.sets }))}
                                className={knockoutFormat?.sets === f.sets ? 'mono-btn-primary' : 'mono-btn'}
                                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          {[10, 15, 21, 25].map(pts => (
                            <button
                              key={pts}
                              onClick={() => setKnockoutFormat(prev => ({ ...prev, points: pts }))}
                              className={knockoutFormat?.points === pts ? 'mono-btn-primary' : 'mono-btn'}
                              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                            >
                              {pts} pts
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {!knockoutSameFormat && sportConfig?.engine === 'goals' && (
                      <div className="mt-2 p-4 mono-card">
                        <div className="flex gap-2 mb-3">
                          <button
                            onClick={() => setKnockoutFormat({ mode: 'free' })}
                            className={knockoutFormat?.mode === 'free' ? 'mono-btn-primary' : 'mono-btn'}
                            style={{ padding: '6px 12px', fontSize: '0.75rem', flex: 1 }}
                          >
                            Free play
                          </button>
                          <button
                            onClick={() => setKnockoutFormat({ mode: 'timed', timeLimit: sportConfig.config.timePresets?.[0]?.value || 1800 })}
                            className={knockoutFormat?.mode === 'timed' ? 'mono-btn-primary' : 'mono-btn'}
                            style={{ padding: '6px 12px', fontSize: '0.75rem', flex: 1 }}
                          >
                            By time
                          </button>
                          <button
                            onClick={() => setKnockoutFormat({ mode: 'points', target: sportConfig.config.pointPresets?.[0] || 10 })}
                            className={knockoutFormat?.mode === 'points' ? 'mono-btn-primary' : 'mono-btn'}
                            style={{ padding: '6px 12px', fontSize: '0.75rem', flex: 1 }}
                          >
                            By points
                          </button>
                        </div>

                        {knockoutFormat?.mode === 'timed' && (
                          <div>
                            <span className="text-xs uppercase tracking-widest font-normal mb-2 block" style={{ color: '#888' }}>
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
                                  onClick={() => setKnockoutFormat({ mode: 'timed', timeLimit: opt.value })}
                                  className={knockoutFormat?.timeLimit === opt.value ? 'mono-btn-primary' : 'mono-btn'}
                                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {knockoutFormat?.mode === 'points' && (
                          <div>
                            <span className="text-xs uppercase tracking-widest font-normal mb-2 block" style={{ color: '#888' }}>
                              First to
                            </span>
                            <div className="flex gap-2 flex-wrap">
                              {(sportConfig.config.pointPresets || [5, 10, 15, 20]).map(pts => (
                                <button
                                  key={pts}
                                  onClick={() => setKnockoutFormat({ mode: 'points', target: pts })}
                                  className={knockoutFormat?.target === pts ? 'mono-btn-primary' : 'mono-btn'}
                                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                >
                                  {pts} {sportConfig.config.scoringUnit || 'point'}s
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <button
              onClick={() => goToStep(3)}
              className="mono-btn-primary w-full"
              style={stickyActionStyle}
            >
              Next: Name Teams
            </button>
          </div>
        )}

        {/* ──────────────────────────────────────────────── */}
        {/* Step 3: Team Names                               */}
        {/* ──────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase tracking-widest font-normal" style={{ color: '#888' }}>
                  Team names
                </span>
                <button
                  onClick={() => setStep(2)}
                  className="text-xs bg-transparent border-none cursor-pointer font-swiss"
                  style={mobileBackButtonStyle}
                >
                  Back
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {teams.map((team, i) => (
                  <div key={team.id} className="flex items-center gap-3">
                    <span className="text-xs font-mono w-5 text-right" style={{ color: '#bbb' }}>
                      {i + 1}
                    </span>
                    <input
                      type="text"
                      className="mono-input flex-1"
                      value={team.name}
                      onChange={(e) => updateTeamName(i, e.target.value)}
                      placeholder={`Team ${i + 1}`}
                      aria-label={`Team ${i + 1} name`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(4)}
              className="mono-btn-primary w-full"
              style={stickyActionStyle}
            >
              Next: Review &amp; Start
            </button>
          </div>
        )}

        {/* ──────────────────────────────────────────────── */}
        {/* Step 4: Players (optional) + Summary + Start     */}
        {/* ──────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs uppercase tracking-widest font-normal block" style={{ color: '#888' }}>
                  Review &amp; Start
                </span>
                <h2 className="text-lg font-semibold" style={{ color: '#111' }}>
                  Check tournament details
                </h2>
              </div>
              <button
                onClick={() => setStep(3)}
                className="text-xs bg-transparent border-none cursor-pointer font-swiss"
                style={mobileBackButtonStyle}
              >
                Back
              </button>
            </div>

            <div className="mono-card mb-6" style={{ padding: '16px 20px' }}>
              <h3 className="text-xs uppercase tracking-widest font-normal mb-3" style={{ color: '#888' }}>
                Summary
              </h3>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-sm gap-4">
                  <span style={{ color: '#888' }}>Tournament</span>
                  <span className="text-right" style={{ color: '#111' }}>{name}</span>
                </div>
                <div className="flex justify-between text-sm gap-4">
                  <span style={{ color: '#888' }}>Type</span>
                  <span className="font-mono text-right" style={{ color: '#111' }}>
                    {tournamentTypeReviewLabel}
                  </span>
                </div>
                <div className="flex justify-between text-sm gap-4">
                  <span style={{ color: '#888' }}>Format</span>
                  <span className="font-mono text-right" style={{ color: '#111', maxWidth: '220px' }}>
                    {formatReviewLabel}
                  </span>
                </div>
                <div className="flex justify-between text-sm gap-4">
                  <span style={{ color: '#888' }}>Teams</span>
                  <span className="font-mono" style={{ color: '#111' }}>{teamCount}</span>
                </div>
                <div className="flex justify-between text-sm gap-4">
                  <span style={{ color: '#888' }}>Matches</span>
                  <span className="font-mono" style={{ color: '#111' }}>{matchCountPreview}</span>
                </div>
                {finalStageLabel && (
                  <div className="flex justify-between text-sm gap-4">
                    <span style={{ color: '#888' }}>Final stage</span>
                    <span className="font-mono text-right" style={{ color: '#111' }}>{finalStageLabel}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mono-card mb-6" style={{ padding: '16px 20px', background: '#f8fafc' }}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-xs uppercase tracking-widest font-normal" style={{ color: '#888' }}>
                  Schedule preview
                </h3>
                {matchCountPreview > schedulePreview.length && (
                  <span className="text-xs font-mono" style={{ color: '#888' }}>
                    First {schedulePreview.length} of {matchCountPreview}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {schedulePreview.map(match => (
                  <div key={`${match.label}-${match.team1Id}-${match.team2Id}`} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-mono text-xs" style={{ color: '#888' }}>{match.label}</span>
                    <span className="text-right" style={{ color: '#111' }}>
                      {teamNameById(match.team1Id)} vs {teamNameById(match.team2Id)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Squad Roster Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-xs uppercase tracking-widest font-normal block" style={{ color: '#888' }}>
                    Optional roster
                  </span>
                  <span className="text-xs" style={{ color: '#bbb' }}>
                    Playing {squadLimit.playing} per match · squad up to {squadLimit.max}
                  </span>
                </div>
              </div>

              {/* Squad vs playing info */}
              <div className="mb-4 p-3 mono-card" style={{ background: '#f8fafc' }}>
                <p className="text-xs" style={{ color: '#555' }}>
                  <strong>Squad</strong> = all available players for the tournament.
                  <strong> Playing {squadLimit.playing}</strong> = picked from the squad each match.
                </p>
              </div>

              {/* Squad size warnings */}
              {(() => {
                const counts = teams.map(t => t.members.length).filter(c => c > 0);
                const warnings = [];

                // Unequal squad sizes
                if (counts.length >= 2 && new Set(counts).size > 1) {
                  const min = Math.min(...counts);
                  const max = Math.max(...counts);
                  warnings.push(
                    <div key="unequal" className="mb-3 p-3" style={{ background: '#fffbeb', border: '1px solid #fde68a', fontSize: '0.8125rem', color: '#92400e' }}>
                      Squads have unequal sizes ({min}–{max} players). This is allowed but may affect fairness.
                    </div>
                  );
                }

                // Squads smaller than playing requirement
                const underSized = teams.filter(t => t.members.length > 0 && t.members.length < squadLimit.playing);
                if (underSized.length > 0) {
                  warnings.push(
                    <div key="under" className="mb-3 p-3" style={{ background: '#fef2f2', border: '1px solid #fecaca', fontSize: '0.8125rem', color: '#991b1b' }}>
                      {underSized.map(t => t.name).join(', ')} {underSized.length === 1 ? 'has' : 'have'} fewer
                      than {squadLimit.playing} players needed to play.
                    </div>
                  );
                }

                return warnings.length > 0 ? warnings : null;
              })()}

              {teams.map((team, idx) => (
                <div key={team.id} className="mono-card p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium" style={{ color: '#111' }}>{team.name}</h4>
                    <div className="text-right">
                      <span className="text-xs font-mono" style={{ color: team.members.length >= squadLimit.max ? '#dc2626' : '#888' }}>
                        {team.members.length}/{squadLimit.max} squad
                      </span>
                      {team.members.length > 0 && team.members.length < squadLimit.playing && (
                        <span className="text-xs block" style={{ color: '#dc2626' }}>
                          need {squadLimit.playing - team.members.length} more to play
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Player chips */}
                  {team.members.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {team.members.map((member, mIdx) => {
                        const isCaptain = captains[idx] === member;
                        return (
                          <span
                            key={`${member}-${mIdx}`}
                            className="flex items-center gap-1"
                            style={{
                              padding: '4px 8px 4px 10px',
                              background: isCaptain ? '#eff6ff' : '#f4f4f4',
                              border: isCaptain ? '1px solid #bfdbfe' : '1px solid #eee',
                              fontSize: '0.8125rem',
                              color: '#111',
                            }}
                          >
                            <button
                              onClick={() => toggleCaptain(idx, member)}
                              className="bg-transparent border-none cursor-pointer"
                              style={{
                                color: isCaptain ? '#0066ff' : '#ddd',
                                fontSize: '0.6875rem',
                                padding: '0 2px',
                                lineHeight: 1,
                              }}
                              title={isCaptain ? 'Remove captain' : 'Make captain'}
                              aria-label={isCaptain ? `Remove ${member} as captain` : `Make ${member} captain of ${team.name}`}
                            >
                              ★
                            </button>
                            {member}
                            {isCaptain && (
                              <span className="text-xs" style={{ color: '#0066ff', fontWeight: 600 }}>C</span>
                            )}
                            <button
                              onClick={() => removeMember(idx, mIdx)}
                              className="bg-transparent border-none cursor-pointer"
                              style={{ color: '#aaa', fontSize: '0.75rem', padding: '0 2px', lineHeight: 1 }}
                              aria-label={`Remove ${member} from ${team.name}`}
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Tag input */}
                  {team.members.length < squadLimit.max ? (
                    <>
                      <input
                        type="text"
                        className="mono-input w-full"
                        style={{ fontSize: '0.8125rem' }}
                        placeholder={team.members.length === 0
                          ? `e.g. Alice, Bob, Charlie — press Enter (max ${squadLimit.max})`
                          : `Add more, comma-separated... (${squadLimit.max - team.members.length} spots left)`}
                        value={playerInputs[idx] || ''}
                        onChange={(e) => setPlayerInputs(prev => ({ ...prev, [idx]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addMembers(idx, playerInputs[idx] || '');
                          }
                        }}
                        onPaste={(e) => {
                          const pasted = e.clipboardData.getData('text');
                          if (pasted.includes(',') || pasted.includes('\n')) {
                            e.preventDefault();
                            addMembers(idx, pasted);
                          }
                        }}
                        aria-label={`Add player to ${team.name}`}
                      />
                      <p className="text-xs mt-1" style={{ color: '#bbb' }}>
                        {team.members.length === 0
                          ? `Comma-separate for multiple · Need at least ${squadLimit.playing} · ★ = captain`
                          : `${squadLimit.max - team.members.length} squad spots left · ★ = captain`}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs mt-1" style={{ color: '#dc2626' }}>
                      Squad full ({squadLimit.max} max) · Playing {squadLimit.playing} per match
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={startTournament}
              className="mono-btn-primary w-full"
              style={stickyActionStyle}
            >
              Start Tournament
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

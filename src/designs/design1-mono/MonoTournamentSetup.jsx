import { supportsGoalPeriods, periodPreset } from '../../utils/goalsPeriods';
import GoalsPeriodSetup from './components/GoalsPeriodSetup';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { saveSportTournament } from '../../utils/storage';
import { generateKnockoutMatches, generateRoundRobinMatches } from '../../utils/roundRobin';
import { getSportById } from '../../models/sportRegistry';
import { OVERS_PRESETS, CRICKET_FORMATS, buildCricketFormat } from '../../utils/cricketCalculations';
import { getSportDefaults, applyStandardDefaults } from '../../utils/sportDefaults';
import { getTournamentMatchCountPreview } from '../../utils/tournamentDisplay';
import { sportIdentity, sportIdentityVars } from '../../lib/sportIdentity';
import BackArrow from './components/BackArrow';
import { KitWash, GoArrow } from './kit/KitParts';
import { KitSegmented, KitStepper } from './kit/KitSetupParts';
import { SetupSteps, ChoiceCards } from './kit/TournamentSetupParts';

const STEP_LABELS = ['Basics', 'Match rules', 'Teams', 'Review'];

// A labelled segmented control with an optional one-line hint (quick setup's rules rows).
function Seg({ id, label, options, value, onChange, hint }) {
  return (
    <div className="kit-setup-field">
      <p id={id} className="kit-setup-label">{label}</p>
      <KitSegmented labelledBy={id} options={options} value={value} onChange={onChange} />
      {hint && <p className="kit-setup-hint">{hint}</p>}
    </div>
  );
}

function getCricketReviewLabel(format) {
  const presetName = format.preset
    ? (CRICKET_FORMATS.find(f => f.id === format.preset)?.name || format.preset)
    : 'Custom';
  const oversLabel = format.overs ? format.overs + ' ov' : 'No limit';
  return presetName + ' - ' + oversLabel + ' - ' + format.players + ' players';
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
  football: { playing: 11, max: 23 },
  basketball: { playing: 5, max: 15 },
  hockey: { playing: 11, max: 18 },
  kabaddi: { playing: 7, max: 12 },
  cricket: { playing: 11, max: 16 },
};

function makeTeam(index, existing, suggestedName) {
  return {
    id: existing?.id || `team-${Date.now()}-${index}`,
    name: existing?.name || suggestedName || `Team ${index + 1}`,
    members: existing?.members || [],
  };
}

function getRoundRobinPlayoffTeamsAdvancing(teamCount, requestedTeamsAdvancing) {
  return teamCount >= 4 && Number(requestedTeamsAdvancing) === 4 ? 4 : 2;
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
  const [showRoster, setShowRoster] = useState(false);
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
        setFormat(ensureScoringMode(supportsGoalPeriods(sport) ? periodPreset(sport) : applyStandardDefaults(sport, {}), format));
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
        setFormat(ensureScoringMode(supportsGoalPeriods(sport) ? periodPreset(sport) : applyStandardDefaults(sport, {}), format));
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
    if (tournamentType === 'knockout') {
      return [];
    }
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

    const isElimination = tournamentType === 'knockout';
    const isGroupKnockout = tournamentType === 'round-robin' && teamCount >= 3 && winnerMode === 'knockouts';
    const isKnockout = isElimination || isGroupKnockout;
    const activeTeamsAdvancing = isElimination
      ? teamCount
      : getRoundRobinPlayoffTeamsAdvancing(teamCount, teamsAdvancing);
    const activeKnockoutFormat = isElimination || knockoutSameFormat ? format : (knockoutFormat || format);
    const knockoutConfig = isKnockout ? {
      teamsAdvancing: activeTeamsAdvancing,
      thirdPlaceMatch: activeTeamsAdvancing >= 4 ? thirdPlaceMatch : false,
      format: activeKnockoutFormat,
      mode: isElimination ? 'single-elimination' : 'group-playoff',
    } : null;
    const seededStandings = teams.map((team, index) => ({
      teamId: team.id,
      team,
      seed: index + 1,
    }));
    const initializedKnockoutMatches = isElimination
      ? initializeMatches(generateKnockoutMatches(seededStandings, knockoutConfig))
      : [];

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
      phase: isElimination ? 'knockout' : 'group',
      knockoutConfig,
      knockoutMatches: initializedKnockoutMatches,
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

  const matchCountPreview = getTournamentMatchCountPreview({
    tournamentType,
    teamCount,
    seriesGames,
    winnerMode,
    teamsAdvancing: tournamentType === 'round-robin'
      ? getRoundRobinPlayoffTeamsAdvancing(teamCount, teamsAdvancing)
      : teamsAdvancing,
    thirdPlaceMatch,
  });

  const isKnockoutSelection = tournamentType === 'round-robin' && teamCount >= 3 && winnerMode === 'knockouts';

  const finalStageLabel = (() => {
    if (tournamentType === 'knockout') {
      return `${teamCount}-team elimination${teamCount >= 4 && thirdPlaceMatch ? ' + 3rd place' : ''}`;
    }
    if (tournamentType !== 'round-robin' || teamCount < 3) return null;
    if (winnerMode !== 'knockouts') return 'Standings';
    const playoffTeamsAdvancing = getRoundRobinPlayoffTeamsAdvancing(teamCount, teamsAdvancing);
    const suffix = playoffTeamsAdvancing >= 4 && thirdPlaceMatch ? ' + 3rd place' : '';
    return `Playoffs (Top ${playoffTeamsAdvancing}${suffix})`;
  })();

  const tournamentTypePreset = (() => {
    if (!tournamentType) return null;
    if (tournamentType === 'knockout') return 'knockout';
    if (tournamentType === 'series') return 'series';
    if (isKnockoutSelection) return 'group-knockout';
    return 'round-robin';
  })();

  const tournamentTypeReviewLabel = (() => {
    if (tournamentType === 'knockout') return 'Single elimination';
    if (tournamentType === 'series') return `${seriesGames}-match series`;
    if (isKnockoutSelection) return `Group + playoffs`;
    return 'Round-robin';
  })();

  const teamNameById = (teamId) => teams.find(t => t.id === teamId)?.name || 'TBD';

  const schedulePreview = (() => {
    if (tournamentType === 'knockout') {
      const seededStandings = teams.map((team, index) => ({ teamId: team.id, team, seed: index + 1 }));
      const config = {
        teamsAdvancing: teamCount,
        thirdPlaceMatch: teamCount >= 4 ? thirdPlaceMatch : false,
      };
      return generateKnockoutMatches(seededStandings, config).map((match) => ({
        ...match,
        label: match.label,
      }));
    }
    if (tournamentType === 'series') {
      return Array.from({ length: seriesGames }, (_, i) => ({
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
        <p style={{ color: 'var(--se-color-ink-soft)' }}>Sport not found</p>
      </div>
    );
  }

  if (!format) {
    return null;
  }

  const sportVars = sportIdentityVars(sport);
  const sportTint = sportIdentity(sport)?.tint;
  const trimmedNames = teams.map(t => t.name.trim());
  const hasEmptyTeamName = trimmedNames.some(n => !n);
  const duplicateName = trimmedNames.find((n, i) => n && trimmedNames.findIndex(m => m.toLowerCase() === n.toLowerCase()) !== i);
  const isDuplicateAt = (i) => Boolean(trimmedNames[i])
    && trimmedNames.filter(n => n.toLowerCase() === trimmedNames[i].toLowerCase()).length > 1;

  const chooseType = (id) => {
    if (id === 'round-robin') {
      setTournamentType('round-robin');
      setWinnerMode('table-topper');
      setTeamCount(4);
      setTeamsAdvancing(2);
      setThirdPlaceMatch(false);
    } else if (id === 'group-knockout') {
      setTournamentType('round-robin');
      setWinnerMode('knockouts');
      setTeamCount(prev => Math.max(prev, 4));
      setTeamsAdvancing(4);
    } else if (id === 'knockout') {
      setTournamentType('knockout');
      setWinnerMode('knockouts');
      setTeamCount(4);
      setTeamsAdvancing(4);
      setKnockoutSameFormat(true);
      setKnockoutFormat(null);
    } else {
      setTournamentType('series');
      setWinnerMode('table-topper');
      setTeamCount(2);
    }
  };

  const chooseTeamCount = (n) => {
    setTeamCount(n);
    if (tournamentType === 'knockout') {
      setWinnerMode('knockouts');
      setTeamsAdvancing(n);
      if (n < 4) setThirdPlaceMatch(false);
    } else if (n < 3) {
      setWinnerMode('table-topper');
      setTeamsAdvancing(2);
      setThirdPlaceMatch(false);
    } else if (n < 4 && teamsAdvancing === 4) {
      setTeamsAdvancing(2);
      setThirdPlaceMatch(false);
    }
  };

  const chooseCricketFormat = (id) => {
    const cf = CRICKET_FORMATS.find(f => f.id === id);
    setCricketPreset(id);
    setFormatMode(cf.customizable ? 'custom' : 'standard');
    setFormat(buildCricketFormat(id));
    setShowCustomOvers(false);
    setCustomOvers('');
    if (preselectedFormat) setShowFormatGrid(false);
  };

  const goBack = () => {
    if (step === 1) navigate('/app');
    else setStep(step - 1);
  };

  const timePresets = sportConfig?.config?.timePresets || [
    { label: '10 min', value: 600 },
    { label: '20 min', value: 1200 },
    { label: '30 min', value: 1800 },
  ];
  const pointPresets = sportConfig.config?.pointPresets || [5, 10, 15, 20];
  const unitWord = `${sportConfig.config?.scoringUnit || 'point'}s`;
  const goalsModeOptions = [
    { id: 'free', label: 'Free play' },
    { id: 'timed', label: 'By time' },
    { id: 'points', label: 'By points' },
  ];
  const chooseGoalsMode = (setter) => (id) => {
    if (id === 'free') setter({ mode: 'free' });
    else if (id === 'timed') setter({ mode: 'timed', timeLimit: sportConfig.config.timePresets?.[0]?.value || 1800 });
    else setter({ mode: 'points', target: sportConfig.config.pointPresets?.[0] || 10 });
  };
  const goalsDetail = (f, setter, prefix) => (
    <>
      {f?.mode === 'timed' && (
        <Seg
          id={`${prefix}-time`}
          label="Time limit"
          options={timePresets.map(o => ({ id: String(o.value), label: o.label }))}
          value={String(f.timeLimit)}
          onChange={(id) => setter({ mode: 'timed', timeLimit: Number(id) })}
        />
      )}
      {f?.mode === 'points' && (
        <Seg
          id={`${prefix}-first`}
          label="First to"
          options={pointPresets.map(pts => ({ id: String(pts), label: `${pts} ${unitWord}` }))}
          value={String(f.target)}
          onChange={(id) => setter({ mode: 'points', target: Number(id) })}
        />
      )}
    </>
  );
  const setsFormatOptions = (all) => (sportConfig.config.setFormats || [])
    .filter(f => all || f.sets > 1)
    .map(f => ({ id: String(f.sets), label: f.label }));
  const pointsOptions = [10, 15, 21, 25].map(pts => ({ id: String(pts), label: `${pts} pts` }));
  const bestOfOrSingle = [{ id: 'best-of', label: 'Best-of' }, { id: 'single', label: 'Single set' }];
  const scoringOf = (f) => f.scoringMode || sportConfig?.config?.defaultScoringMode || 'rally';

  const typeOptions = [
    { id: 'round-robin', label: 'Round-robin', desc: 'Everyone plays everyone' },
    { id: 'group-knockout', label: 'Group + Playoffs', desc: 'Group games, then playoffs' },
    { id: 'knockout', label: 'Elimination', desc: 'Lose once and you are out' },
    { id: 'series', label: 'Series', desc: 'Two teams, several matches' },
  ];

  const cta = (label, onClick, { blocked = false, hint = '' } = {}) => (
    <div className="kit-setup-cta">
      <button
        type="button"
        className="se-go"
        onClick={blocked ? undefined : onClick}
        aria-disabled={blocked}
        aria-describedby={blocked && hint ? 'tournament-cta-hint' : undefined}
      >
        {label}
        <GoArrow />
      </button>
      {blocked && hint && (
        <p id="tournament-cta-hint" role="status" className="kit-setup-hint">{hint}</p>
      )}
    </div>
  );

  // The cricket format shown as a summary (a ?format= link, or after choosing). `action` is the Change link.
  const preselectedPanel = (action) => {
    const key = action ? cricketPreset : preselectedFormat;
    const preset = CRICKET_FORMATS.find(f => f.id === key);
    return (
      <div className="kit-setup-field">
        <p className="kit-setup-label">Format</p>
        <div className="kit-card kit-setup-pre">
          <div>
            <b>{preset?.name || key}</b>
            <span>{preset?.desc}</span>
          </div>
          {action || <span className="kit-chip">Pre-selected</span>}
        </div>
      </div>
    );
  };

  const squadCounts = teams.map(t => t.members.length).filter(c => c > 0);
  const underSized = teams.filter(t => t.members.length > 0 && t.members.length < squadLimit.playing);
  const rosterWarnings = (
    <>
      {squadCounts.length >= 2 && new Set(squadCounts).size > 1 && (
        <p className="kit-setup-note is-warn">
          Squads have unequal sizes ({Math.min(...squadCounts)}–{Math.max(...squadCounts)} players). This is allowed but may affect fairness.
        </p>
      )}
      {underSized.length > 0 && (
        <p className="kit-setup-note is-danger">
          {underSized.map(t => t.name).join(', ')} {underSized.length === 1 ? 'has' : 'have'} fewer
          than {squadLimit.playing} players needed to play.
        </p>
      )}
    </>
  );

  return (
    <div className="kit-screen kit-setup" data-screen="tournament-setup" style={sportVars}>
      <KitWash from={sportTint} to={sportTint} />
      <div className="kit-setup-top">
        {/* Back */}
        <button
          type="button"
          className="se-ctl kit-setup-back"
          onClick={goBack}
          aria-label={step === 1 ? 'Home' : 'Back'}
        >
          <BackArrow size={20} />
        </button>
        <span className="kit-setup-badge" aria-hidden="true" />
        <div className="kit-setup-title">
          <h1>New tournament</h1>
          <p>{sportConfig.name} · Step {step} of {STEP_LABELS.length}</p>
        </div>
      </div>

      {saveWarning && (
        <div className="mono-alert mono-alert-danger mb-4" role="alert">
          {saveWarning}
        </div>
      )}

      <SetupSteps labels={STEP_LABELS} step={step} />

      {/* Step 1: Basics — name, type, team count */}
      {step === 1 && (
        <>
          <section className="kit-setup-field">
            <label htmlFor="tournament-name" className="kit-setup-label">Tournament name</label>
            <input
              id="tournament-name"
              type="text"
              className="kit-setup-input"
              placeholder={isCricket ? 'Weekend Cricket League' : `${sportConfig.name} Championship`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </section>

          <section className="kit-setup-field">
            <p id="tournament-type-label" className="kit-setup-label">Tournament type</p>
            <ChoiceCards labelledBy="tournament-type-label" options={typeOptions} value={tournamentTypePreset} onChange={chooseType} />
          </section>

          {(tournamentType === 'round-robin' || tournamentType === 'knockout') && (
            <Seg
              id="tournament-teams-label"
              label={tournamentType === 'knockout' ? 'Bracket size' : 'Number of teams'}
              options={teamCountOptions.map(n => ({ id: String(n), label: String(n) }))}
              value={String(teamCount)}
              onChange={(id) => chooseTeamCount(Number(id))}
              hint={tournamentType === 'knockout'
                ? `Will generate ${matchCountPreview} ${matchCountPreview === 1 ? 'match' : 'matches'}`
                : `Will generate ${matchCountPreview === 1 ? '1 match' : `${matchCountPreview} matches`}${teamCount >= 3 ? ' (round-robin format)' : ''}`}
            />
          )}

          {tournamentType === 'knockout' && teamCount >= 4 && (
            <label className="kit-setup-check">
              <input type="checkbox" checked={thirdPlaceMatch} onChange={() => setThirdPlaceMatch(!thirdPlaceMatch)} />
              <span>Include 3rd place match</span>
            </label>
          )}

          {tournamentType === 'series' && (
            <Seg
              id="tournament-series-label"
              label="Matches in series"
              options={[1, 3, 5, 7].map(n => ({ id: String(n), label: n === 1 ? '1 match' : `${n} matches` }))}
              value={String(seriesGames)}
              onChange={(id) => setSeriesGames(Number(id))}
              hint={seriesGames === 1 ? 'Single match series' : `${seriesGames}-match series`}
            />
          )}

          {preselectedFormat && isCricket && preselectedPanel()}

          {cta(
            preselectedFormat && isCricket ? 'Next: Review Format' : 'Next: Match Rules',
            () => goToStep(2),
            { blocked: !canAdvanceStep1, hint: name.trim() ? 'Pick a tournament type to continue.' : 'Name the tournament and pick a type to continue.' },
          )}
        </>
      )}

      {/* Step 2: Match rules — format, playoffs */}
      {step === 2 && (
        <>
          <p className="kit-setup-intro">How should matches be played?</p>

          {!isCricket && (
            <Seg
              id="format-mode-label"
              label="Format mode"
              options={[{ id: 'standard', label: 'Standard' }, { id: 'custom', label: 'Custom' }]}
              value={formatMode}
              onChange={setFormatMode}
              hint={formatMode === 'standard' ? 'Official rules for this sport' : 'Customize all format options'}
            />
          )}

          {isCricket && (preselectedFormat && !showFormatGrid ? (
            preselectedPanel(
              <button type="button" className="kit-setup-link" onClick={() => setShowFormatGrid(true)}>Change</button>,
            )
          ) : (
            <section className="kit-setup-field">
              <p id="cricket-format-label" className="kit-setup-label">Format</p>
              <ChoiceCards
                labelledBy="cricket-format-label"
                options={CRICKET_FORMATS.map(cf => ({ id: cf.id, label: cf.name, desc: cf.desc }))}
                value={cricketPreset}
                onChange={chooseCricketFormat}
              />
            </section>
          ))}

          {/* Cricket sub-options (Gully and Custom only) */}
          {isCricket && (cricketPreset === 'gully' || cricketPreset === 'custom') && format && (
            <>
              {cricketPreset === 'custom' && (
                <Seg
                  id="cricket-scoring-label"
                  label="Scoring format"
                  options={[{ id: 'overs', label: 'Track by Overs' }, { id: 'balls', label: 'Track by Balls' }]}
                  value={format.trackOvers === false ? 'balls' : 'overs'}
                  onChange={(id) => setFormat(prev => (id === 'balls'
                    ? { ...prev, trackOvers: false, overs: null, powerplay: [] }
                    : { ...prev, trackOvers: true, maxBalls: null }))}
                />
              )}

              {format.trackOvers !== false && (
                <div className="kit-setup-field">
                  <p id="cricket-overs-label" className="kit-setup-label">Overs</p>
                  <KitSegmented
                    labelledBy="cricket-overs-label"
                    options={[
                      { id: 'none', label: 'No limit' },
                      ...OVERS_PRESETS.map(p => ({ id: `ov-${p.value}`, label: p.label })),
                      { id: 'custom', label: 'Custom' },
                    ]}
                    value={showCustomOvers ? 'custom' : (format.overs === null ? 'none' : `ov-${format.overs}`)}
                    onChange={(id) => {
                      if (id === 'custom') {
                        setShowCustomOvers(true);
                        setCustomOvers('');
                        return;
                      }
                      setFormat(prev => ({ ...prev, overs: id === 'none' ? null : Number(id.slice(3)) }));
                      setCustomOvers('');
                      setShowCustomOvers(false);
                    }}
                  />
                  {showCustomOvers && (
                    <div className="kit-rules-custom">
                      <input
                        type="number" min="1" max="50"
                        className="kit-setup-input"
                        aria-label="Custom overs"
                        placeholder="1-50" value={customOvers}
                        onChange={(e) => {
                          const v = Number.parseInt(e.target.value);
                          setCustomOvers(e.target.value);
                          if (v >= 1 && v <= 50) setFormat(prev => ({ ...prev, overs: v }));
                        }}
                        autoFocus
                      />
                      <span className="kit-setup-hint">overs a side</span>
                    </div>
                  )}
                </div>
              )}

              {cricketPreset === 'custom' && format.trackOvers === false && (
                <div className="kit-setup-field">
                  <p id="cricket-balls-label" className="kit-setup-label">Ball limit</p>
                  <div className="kit-setup-inline">
                    <button
                      type="button"
                      className="se-ctl"
                      aria-pressed={format.maxBalls === null || format.maxBalls === undefined}
                      onClick={() => setFormat(prev => ({ ...prev, maxBalls: null }))}
                    >
                      No limit
                    </button>
                    <KitStepper
                      label="balls"
                      labelledBy="cricket-balls-label"
                      value={format.maxBalls || '∞'}
                      onDecrease={() => setFormat(prev => ({ ...prev, maxBalls: Math.max(6, (prev.maxBalls || 30) - 6) }))}
                      onIncrease={() => setFormat(prev => ({ ...prev, maxBalls: (prev.maxBalls || 24) + 6 }))}
                    />
                  </div>
                  <p className="kit-setup-hint">No over structure — just track runs and balls</p>
                </div>
              )}

              <div className="kit-setup-field">
                <p id="cricket-players-label" className="kit-setup-label">Players</p>
                <KitStepper
                  label="players"
                  labelledBy="cricket-players-label"
                  value={format.players || 6}
                  canDecrease={!(format.players <= 2)}
                  canIncrease={!(format.players >= (format.solo ? 10 : 11))}
                  onDecrease={() => setFormat(prev => ({ ...prev, players: Math.max(2, (prev.players || 6) - 1) }))}
                  onIncrease={() => {
                    const maxPlayers = format.solo ? 10 : 11;
                    setFormat(prev => ({ ...prev, players: Math.min(maxPlayers, (prev.players || 6) + 1) }));
                  }}
                />
              </div>

              <Seg
                id="cricket-type-label"
                label="Match type"
                options={[{ id: 'solo', label: 'Bat Only' }, { id: 'both', label: 'Bat & Bowl' }]}
                value={format.solo ? 'solo' : (format.solo === false ? 'both' : undefined)}
                onChange={(id) => setFormat(prev => (id === 'solo'
                  ? { ...prev, solo: true, players: Math.min(prev.players || 6, 10) }
                  : { ...prev, solo: false }))}
                hint={`${format.solo ? 'One team bats, other bowls' : 'Both teams bat and bowl'} · ${(format.players || 6) - 1} wickets`}
              />

              {cricketPreset === 'custom' && (
                <Seg
                  id="cricket-innings-label"
                  label="Innings format"
                  options={[{ id: '2', label: '1 per side (2 total)' }, { id: '4', label: '2 per side (4 total)' }]}
                  value={String(format.totalInnings)}
                  onChange={(id) => setFormat(prev => (id === '2'
                    ? { ...prev, totalInnings: 2, declaration: false, followOn: false }
                    : { ...prev, totalInnings: 4, declaration: true, followOn: true }))}
                  hint="Innings count is independent of overs"
                />
              )}

              {cricketPreset === 'gully' && (
                <div className="kit-setup-field">
                  <button type="button" className="kit-setup-link" aria-expanded={showHouseRules} onClick={() => setShowHouseRules(!showHouseRules)}>
                    {showHouseRules ? 'Hide house rules' : 'House rules'}
                  </button>
                  {showHouseRules && (
                    <>
                      {[
                        ['lastManStands', 'Last Man Batting'],
                        ['trialBall', 'Trial Ball'],
                        ['oneTipOneHand', 'One Tip One Hand'],
                      ].map(([key, label]) => (
                        <label key={key} className="kit-setup-check">
                          <input
                            type="checkbox"
                            checked={Boolean(format[key])}
                            onChange={() => setFormat(prev => ({ ...prev, [key]: !prev[key] }))}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                      <p className="kit-setup-hint">
                        {format.lastManStands && 'Last batter plays alone · '}
                        {format.trialBall && 'First ball doesn\'t count · '}
                        {format.oneTipOneHand && 'One-bounce catch = out'}
                        {!format.lastManStands && !format.trialBall && !format.oneTipOneHand && 'Toggle rules on/off'}
                      </p>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {sportConfig.engine === 'goals' && <GoalsPeriodSetup sport={sport} format={format} onChange={setFormat} />}

          {/* Goals-based format — custom mode only */}
          {formatMode === 'custom' && sportConfig.engine === 'goals' && !format.periods && (
            <>
              <Seg id="goals-mode-label" label="Match mode" options={goalsModeOptions} value={format.mode} onChange={chooseGoalsMode(setFormat)} />
              {goalsDetail(format, setFormat, 'goals')}
            </>
          )}

          {/* Sets-based format — custom mode only */}
          {formatMode === 'custom' && sportConfig.engine === 'sets' && sportConfig.config.setFormats && (
            <>
              <Seg
                id="sets-type-label"
                label="Format"
                options={bestOfOrSingle}
                value={format.type}
                onChange={(id) => setFormat(prev => ensureScoringMode(id === 'best-of'
                  ? { type: 'best-of', sets: 3, points: sportConfig.config.pointsPerSet }
                  : { type: 'single', points: 15 }, prev))}
              />
              {format.type === 'best-of' && (
                <Seg
                  id="sets-count-label"
                  label="Sets"
                  options={setsFormatOptions(true)}
                  value={String(format.sets)}
                  onChange={(id) => setFormat(prev => ensureScoringMode({ ...prev, sets: Number(id) }, prev))}
                />
              )}
              <Seg
                id="sets-points-label"
                label="Points to win"
                options={pointsOptions}
                value={String(format.points)}
                onChange={(id) => setFormat(prev => ensureScoringMode({ ...prev, points: Number(id) }, prev))}
              />
              {canConfigureScoringMode && (
                <Seg
                  id="sets-scoring-label"
                  label="Scoring mode"
                  options={[{ id: 'rally', label: 'Rally' }, { id: 'side-out', label: 'Side-out' }]}
                  value={scoringOf(format)}
                  onChange={(id) => setFormat(prev => ensureScoringMode({ ...prev, scoringMode: id }, prev))}
                />
              )}
            </>
          )}

          {/* After group stage (round-robin, 3+ teams only) */}
          {tournamentType === 'round-robin' && teamCount >= 3 && (
            <>
              <Seg
                id="after-group-label"
                label="After group stage"
                options={[{ id: 'table-topper', label: 'Standings decide' }, { id: 'knockouts', label: 'Playoffs' }]}
                value={winnerMode}
                onChange={(id) => {
                  setWinnerMode(id);
                  if (id === 'knockouts') setTeamsAdvancing(prev => getRoundRobinPlayoffTeamsAdvancing(teamCount, prev));
                }}
                hint={winnerMode === 'table-topper'
                  ? 'Team at the top of the table wins the tournament'
                  : 'Top teams play elimination matches to decide the winner'}
              />

              {winnerMode === 'knockouts' && (
                <section className="kit-setup-panel" aria-label="Playoff setup">
                  <Seg
                    id="playoff-spots-label"
                    label="Playoff spots"
                    options={[{ id: '2', label: 'Top 2' }, { id: '4', label: 'Top 4', disabled: teamCount < 4 }]}
                    value={String(teamsAdvancing)}
                    onChange={(id) => {
                      setTeamsAdvancing(Number(id));
                      if (id === '2') setThirdPlaceMatch(false);
                    }}
                    hint={teamsAdvancing === 2
                      ? '1st vs 2nd in the final'
                      : '1st vs 4th and 2nd vs 3rd in semi-finals, then a final'}
                  />

                  {teamsAdvancing === 4 && teamCount >= 4 && (
                    <label className="kit-setup-check">
                      <input type="checkbox" checked={thirdPlaceMatch} onChange={() => setThirdPlaceMatch(!thirdPlaceMatch)} />
                      <span>Include 3rd place match</span>
                    </label>
                  )}

                  <h3>Playoff match rules</h3>
                  <p className="kit-setup-rules">
                    {getFormatDescription(knockoutSameFormat ? format : knockoutFormat)}
                    {' · '}
                    {knockoutSameFormat ? 'Same rules as group stage' : 'Custom rules for playoffs'}
                  </p>

                  <label className="kit-setup-check">
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
                    />
                    <span>Use different rules for playoffs</span>
                  </label>

                  {!knockoutSameFormat && sportConfig?.engine === 'sets' && sportConfig.config.setFormats && (
                    <>
                      <Seg
                        id="playoff-type-label"
                        label="Playoff format"
                        options={bestOfOrSingle}
                        value={knockoutFormat?.type}
                        onChange={(id) => setKnockoutFormat(prev => (id === 'best-of'
                          ? { ...prev, type: 'best-of', sets: 3, points: prev?.points || sportConfig.config.pointsPerSet }
                          : { ...prev, type: 'single', points: prev?.points || 15 }))}
                      />
                      {knockoutFormat?.type === 'best-of' && (
                        <Seg
                          id="playoff-sets-label"
                          label="Sets"
                          options={setsFormatOptions(false)}
                          value={String(knockoutFormat?.sets)}
                          onChange={(id) => setKnockoutFormat(prev => ({ ...prev, sets: Number(id) }))}
                        />
                      )}
                      <Seg
                        id="playoff-points-label"
                        label="Points to win"
                        options={pointsOptions}
                        value={String(knockoutFormat?.points)}
                        onChange={(id) => setKnockoutFormat(prev => ({ ...prev, points: Number(id) }))}
                      />
                    </>
                  )}

                  {!knockoutSameFormat && sportConfig?.engine === 'goals' && (
                    <>
                      <GoalsPeriodSetup sport={sport} format={knockoutFormat || format} onChange={setKnockoutFormat} />
                      <Seg id="playoff-goals-label" label="Playoff match mode" options={goalsModeOptions} value={knockoutFormat?.mode} onChange={chooseGoalsMode(setKnockoutFormat)} />
                      {goalsDetail(knockoutFormat, setKnockoutFormat, 'playoff')}
                    </>
                  )}
                </section>
              )}
            </>
          )}

          {cta('Next: Name Teams', () => goToStep(3))}
        </>
      )}

      {/* Step 3: Team names */}
      {step === 3 && (
        <>
          <section className="kit-setup-field">
            <p className="kit-setup-label">Team names</p>
            <ul className="kit-setup-teams">
              {teams.map((team, i) => (
                <li key={team.id}>
                  <span aria-hidden="true">{i + 1}</span>
                  <input
                    type="text"
                    className="kit-setup-input"
                    value={team.name}
                    onChange={(e) => updateTeamName(i, e.target.value)}
                    placeholder={`Team ${i + 1}`}
                    aria-label={`Team ${i + 1} name`}
                    aria-invalid={!trimmedNames[i] || isDuplicateAt(i) ? 'true' : undefined}
                    aria-describedby={!trimmedNames[i] || isDuplicateAt(i) ? 'team-names-note' : undefined}
                  />
                </li>
              ))}
            </ul>
            {hasEmptyTeamName && (
              <p id="team-names-note" role="status" className="kit-setup-note is-danger">
                Every team needs a name before the tournament can start.
              </p>
            )}
            {!hasEmptyTeamName && duplicateName && (
              <p id="team-names-note" role="status" className="kit-setup-note is-warn">
                More than one team is called “{duplicateName}”. Rename one so the table and fixtures stay clear.
              </p>
            )}
          </section>

          {cta('Next: Review & Start', () => setStep(4))}
        </>
      )}

      {/* Step 4: Summary, schedule, optional roster, start */}
      {step === 4 && (
        <>
          <div className="kit-setup-head">
            <h2>Check tournament details</h2>
          </div>

          <section className="kit-card kit-setup-card" aria-label="Summary">
            <dl className="kit-setup-sum">
              <div><dt>Tournament</dt><dd>{name}</dd></div>
              <div><dt>Type</dt><dd>{tournamentTypeReviewLabel}</dd></div>
              <div><dt>Format</dt><dd>{formatReviewLabel}</dd></div>
              <div><dt>Teams</dt><dd>{teamCount}</dd></div>
              <div><dt>Matches</dt><dd>{matchCountPreview}</dd></div>
              {finalStageLabel && <div><dt>Final stage</dt><dd>{finalStageLabel}</dd></div>}
            </dl>
          </section>

          <section className="kit-card kit-setup-card" aria-label="Schedule preview">
            <div className="kit-setup-head">
              <h2>Schedule preview</h2>
              {matchCountPreview > schedulePreview.length && (
                <span className="kit-setup-count">First {schedulePreview.length} of {matchCountPreview}</span>
              )}
            </div>
            <ul className="kit-setup-sched">
              {schedulePreview.map(match => (
                <li key={`${match.label}-${match.team1Id}-${match.team2Id}`}>
                  <span>{match.label}</span>
                  <span>{teamNameById(match.team1Id)} vs {teamNameById(match.team2Id)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="kit-setup-field">
            <button type="button" className="kit-setup-link" aria-expanded={showRoster} onClick={() => setShowRoster((value) => !value)}>
              {showRoster ? 'Hide roster' : 'Add roster'}
            </button>
            <p className="kit-setup-hint">
              Optional · playing {squadLimit.playing} per match · squad up to {squadLimit.max}
            </p>

            {showRoster && (
              <>
                <p className="kit-setup-note">
                  <b>Squad</b> = all available players for the tournament. <b>Playing {squadLimit.playing}</b> = picked from the squad each match.
                </p>
                {rosterWarnings}
                {teams.map((team, idx) => (
                  <div key={team.id} className="kit-setup-roster">
                    <div className="kit-setup-roster-team">
                      <div className="kit-setup-head" style={{ marginTop: 0 }}>
                        <h2>{team.name}</h2>
                        <span className={`kit-setup-count${team.members.length >= squadLimit.max ? ' is-full' : ''}`}>
                          {team.members.length}/{squadLimit.max} squad
                        </span>
                      </div>
                      {team.members.length > 0 && team.members.length < squadLimit.playing && (
                        <p className="kit-setup-hint" style={{ color: 'var(--se-color-danger)' }}>
                          Need {squadLimit.playing - team.members.length} more to play
                        </p>
                      )}
                      {team.members.length > 0 && (
                        <ul className="kit-pl">
                          {team.members.map((member, mIdx) => {
                            const isCaptain = captains[idx] === member;
                            return (
                              <li key={`${member}-${mIdx}`} className={isCaptain ? 'is-captain' : undefined}>
                                <button
                                  type="button"
                                  onClick={() => toggleCaptain(idx, member)}
                                  title={isCaptain ? 'Remove captain' : 'Make captain'}
                                  aria-label={isCaptain ? `Remove ${member} as captain` : `Make ${member} captain of ${team.name}`}
                                >
                                  ★
                                </button>
                                <span className="kit-pl-name">{member}</span>
                                {isCaptain && <em>C</em>}
                                <button
                                  type="button"
                                  onClick={() => removeMember(idx, mIdx)}
                                  aria-label={`Remove ${member} from ${team.name}`}
                                >
                                  ✕
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {team.members.length < squadLimit.max ? (
                        <>
                          <input
                            type="text"
                            className="kit-setup-input"
                            placeholder={team.members.length === 0 ? 'e.g. Alice, Bob, Charlie' : 'Add more players'}
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
                          <p className="kit-setup-hint">
                            {team.members.length === 0
                              ? `Press Enter after each name, or comma-separate · Need at least ${squadLimit.playing} · ★ = captain`
                              : `${squadLimit.max - team.members.length} squad spots left · ★ = captain`}
                          </p>
                        </>
                      ) : (
                        <p className="kit-setup-hint" style={{ color: 'var(--se-color-danger)' }}>
                          Squad full ({squadLimit.max} max) · Playing {squadLimit.playing} per match
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </section>

          {cta('Start Tournament', startTournament, { blocked: hasEmptyTeamName, hint: 'Every team needs a name. Go back and fill the empty ones.' })}
        </>
      )}
    </div>
  );
}

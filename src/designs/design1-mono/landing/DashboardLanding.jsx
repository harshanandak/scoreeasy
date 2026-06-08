import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSportTournaments, loadData } from '../../../utils/storage';
import { getActiveSessions } from '../../../utils/universalStorage';
import { getSportsList, getSportById } from '../../../models/sportRegistry';
import { useAuth } from '../../../hooks/useAuth';
import { isTournamentMatchCompleted } from '../../../utils/tournamentSync';
import { MONO, SWISS } from './landingTheme';
import SportIcon from './sportIcons';

const QM_KEY = 'se_quickmatches';
const MIN_TOURNAMENT_TEAMS = 2;
const FALLBACK_TOURNAMENT_SPORT_ID = 'volleyball';

/* ─── Tokens ─── */
const t = {
  blue: '#0066ff', blueLight: '#e8f0ff',
  bg: '#fafafa', surface: '#ffffff', text: '#1a1a1a',
  textSoft: '#555', textMuted: '#888', textFaint: '#bbb',
  border: '#e8e8e8', borderStrong: '#1a1a1a',
  green: '#16a34a', greenLight: '#dcfce7',
  orange: '#ea580c', orangeLight: '#fff7ed',
  cardShadow: '0 1px 4px rgba(0,0,0,0.05)',
  r: 6,
};

/* ─── Layered style tokens ─── */
const s = {
  sportCard: { background: t.surface, border: 'none', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '16px 12px' },
  btn: { borderRadius: 6 },
  activeRow: { background: t.blueLight, border: 'none', borderRadius: 0, boxShadow: 'none' },
  darkCard: {
    bg: '#1a1a1a', text: '#ffffff', muted: '#999', border: '#333',
    outer: { background: '#1a1a1a', border: '1.5px solid #444', borderRadius: 0, boxShadow: `6px 6px 0 -1.5px #1a1a1a, 6px 6px 0 0 ${t.blue}` },
    badge: { background: `${t.blue}25`, color: t.blue },
    resumeBtn: { background: t.blue, color: '#fff', border: 'none' },
  },
};

const btnPrimary = {
  fontFamily: MONO, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em',
  padding: '10px 16px', background: t.blue, color: '#fff', border: 'none',
  borderRadius: s.btn.borderRadius, cursor: 'pointer', textAlign: 'center',
};
const btnSecondary = {
  fontFamily: MONO, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em',
  padding: '10px 16px', background: 'transparent', color: t.text,
  border: `1.5px solid ${t.border}`, borderRadius: s.btn.borderRadius,
  cursor: 'pointer', textAlign: 'center',
};

const bareButton = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  margin: 0,
  textAlign: 'inherit',
};

const allSportsList = getSportsList();

const SPORT_NAMES = allSportsList.map(sp => sp.name);

function withStableKeys(values, prefix) {
  const seen = {};
  return values.map((value) => {
    const normalized = String(value || '').trim() || prefix;
    const count = seen[normalized] || 0;
    seen[normalized] = count + 1;
    return { key: `${prefix}-${normalized}-${count}`, value };
  });
}

function getProgressState(step, state) {
  if (step === 1) {
    return { filled: Boolean(state.selectedSport), current: !state.selectedSport };
  }
  if (step === 2) {
    return { filled: Boolean(state.selectedMode), current: Boolean(state.selectedSport && !state.selectedMode) };
  }
  if (step === 3) {
    return { filled: state.teamsReady, current: Boolean(state.selectedMode && !state.teamsReady) };
  }
  return { filled: state.allReady, current: state.teamsReady };
}

function getModeSubtitle(state) {
  if (!state.selectedMode) {
    return state.selectedSport ? `How do you want to play ${state.sportName}?` : 'Select a sport first';
  }
  return state.isTourney ? 'Tournament mode' : 'Quick match mode';
}

function getSetupSubtitle(state) {
  if (state.teamsReady) {
    return state.isTourney ? `${state.tourneyName} - ${state.filledTourneyTeams} teams` : `${state.team1} vs ${state.team2}`;
  }
  return state.isTourney ? 'Name your tournament and add teams' : 'Who is playing?';
}

function getPreviewSubtitle(state) {
  if (state.teamsReady) {
    return state.isTourney ? 'Tournament overview' : 'Your scorecard preview';
  }
  return state.isTourney ? 'Add teams first' : 'Name your teams first';
}

function collectTournamentsBySport(sports) {
  const tournaments = [];
  for (const sport of sports) {
    const sportTournaments = loadSportTournaments(sport.storageKey);
    for (const tr of sportTournaments) {
      const allMatches = [...(tr.matches || []), ...(tr.knockoutMatches || [])];
      const completed = allMatches.filter((m) => isTournamentMatchCompleted(m, sport.engine, m.format || tr.format)).length;
      const total = allMatches.length;
      tournaments.push({
        ...tr,
        sportName: sport.name,
        sportIcon: sport.name,
        sportId: sport.id,
        completed,
        total,
        isActive: total > 0 && completed < total,
      });
    }
  }
  tournaments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return tournaments;
}
function getSportFromName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  return SPORT_NAMES.find(s => lower.includes(s.toLowerCase())) || null;
}

function getNewTournamentPath({
  activeTournaments = [],
  displayTournaments = [],
  favoriteSports = [],
  recentMatches = [],
} = {}) {
  const candidateIds = [
    recentMatches[0]?.sport,
    activeTournaments[0]?.sportId,
    displayTournaments[0]?.sportId,
    favoriteSports[0]?.id,
    FALLBACK_TOURNAMENT_SPORT_ID,
  ];
  const sportId = candidateIds.find((id) => id && getSportById(id)) || FALLBACK_TOURNAMENT_SPORT_ID;
  return `/${sportId}/tournament/new`;
}

function getWinnerLabel(winner) {
  if (winner === 'draw') return 'Draw';
  if (winner === 'tie') return 'Tied';
  if (winner === 'Draw') return 'Draw';
  if (winner === 'Tie') return 'Tied';
  return `${winner} won`;
}

function getScore(qm) {
  if (typeof qm.score1 === 'number' && typeof qm.score2 === 'number') {
    return `${qm.score1} \u2014 ${qm.score2}`;
  }
  if (Array.isArray(qm.innings) && qm.innings.length > 0 && typeof qm.score1 !== 'number') {
    const team1Id = qm.team1Id || 'team1';
    const team2Id = qm.team2Id || 'team2';
    const score1 = qm.innings.filter((inn) => inn.teamId === team1Id).reduce((sum, inn) => sum + (inn.runs || 0), 0);
    const score2 = qm.innings.filter((inn) => inn.teamId === team2Id).reduce((sum, inn) => sum + (inn.runs || 0), 0);
    return `${score1} \u2014 ${score2}`;
  }
  if (qm.team1Score) {
    return `${qm.team1Score.runs}/${qm.team1Score.wickets} vs ${qm.team2Score?.runs}/${qm.team2Score?.wickets}`;
  }
  return '0 \u2014 0';
}

/* ═══════════════════════════════════════
   NEW USER FLOW — Guided 4-step wizard
   ═══════════════════════════════════════ */

function useSportState() {
  const [selectedSport, setSelectedSport] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [tourneyTeams, setTourneyTeams] = useState(['', '']);
  const [tourneyName, setTourneyName] = useState('');

  const sportObj = selectedSport ? allSportsList.find(s => s.id === selectedSport) : null;
  const sportName = sportObj ? sportObj.name : '';
  const sportIcon = sportObj ? sportObj.name : 'Volleyball';
  const isTourney = selectedMode === 'tournament';
  const filledTourneyTeams = tourneyTeams.filter(x => x.trim().length > 0).length;
  const teamsReady = isTourney
    ? tourneyName.trim().length > 0 && filledTourneyTeams >= MIN_TOURNAMENT_TEAMS
    : team1.trim().length > 0 && team2.trim().length > 0;
  const allReady = selectedSport && selectedMode && teamsReady;

  const resetTeams = () => { setTeam1(''); setTeam2(''); setTourneyTeams(['', '']); setTourneyName(''); };
  const pickSport = (id) => {
    if (id === selectedSport) { setSelectedSport(null); setSelectedMode(null); resetTeams(); }
    else { setSelectedSport(id); setSelectedMode(null); resetTeams(); }
  };
  const pickMode = (mode) => {
    setSelectedMode(selectedMode === mode ? null : mode);
    resetTeams();
  };
  const updateTourneyTeam = (idx, val) => {
    const next = [...tourneyTeams]; next[idx] = val; setTourneyTeams(next);
  };
  const addTourneyTeam = () => { if (tourneyTeams.length < 8) setTourneyTeams([...tourneyTeams, '']); };
  const removeTourneyTeam = (idx) => { if (tourneyTeams.length > MIN_TOURNAMENT_TEAMS) setTourneyTeams(tourneyTeams.filter((_, i) => i !== idx)); };
  const resetAll = () => { setSelectedSport(null); setSelectedMode(null); resetTeams(); };

  return {
    selectedSport, selectedMode, team1, setTeam1, team2, setTeam2,
    tourneyTeams, tourneyName, setTourneyName, sportName, sportIcon,
    isTourney, filledTourneyTeams, teamsReady, allReady,
    pickSport, pickMode, updateTourneyTeam, addTourneyTeam, removeTourneyTeam, resetAll,
  };
}

function SportGrid({ selectedSport, pickSport }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
      {allSportsList.map(sp => (
        <button
          key={sp.id}
          type="button"
          onClick={() => pickSport(sp.id)}
          style={{
            ...bareButton,
          background: selectedSport === sp.id ? t.text : t.surface,
          color: selectedSport === sp.id ? '#fff' : t.text,
          border: `1.5px solid ${selectedSport === sp.id ? t.text : t.border}`,
          borderRadius: t.r, padding: '14px 8px', textAlign: 'center', cursor: 'pointer',
          transition: 'all 200ms ease', boxShadow: t.cardShadow,
          }}
        >
          <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'center' }}>
            <SportIcon name={sp.name} size={26} color={selectedSport === sp.id ? t.blue : t.text} />
          </div>
          <div style={{ fontFamily: MONO, fontSize: '0.4375rem', fontWeight: 600, letterSpacing: '0.04em' }}>{sp.name.toUpperCase()}</div>
        </button>
      ))}
    </div>
  );
}

function ModeCards({ selectedMode, pickMode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <button
        type="button"
        onClick={() => pickMode('tournament')}
        style={{
          ...bareButton,
        background: selectedMode === 'tournament' ? t.text : t.surface,
        color: selectedMode === 'tournament' ? '#fff' : t.text,
        border: `1.5px solid ${selectedMode === 'tournament' ? t.text : t.border}`,
        borderRadius: t.r, padding: 20, cursor: 'pointer', transition: 'all 200ms ease', boxShadow: t.cardShadow,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: selectedMode === 'tournament' ? t.blue : t.blueLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 800, color: selectedMode === 'tournament' ? '#fff' : t.blue }}>T</span>
          </div>
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Tournament</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: selectedMode === 'tournament' ? '#aaa' : t.textMuted, margin: 0, lineHeight: 1.4 }}>2-8 teams. Round-robin or knockout brackets. Auto standings and point tables.</p>
      </button>
      <button
        type="button"
        onClick={() => pickMode('quick')}
        style={{
          ...bareButton,
        background: selectedMode === 'quick' ? t.text : t.surface,
        color: selectedMode === 'quick' ? '#fff' : t.text,
        border: `1.5px solid ${selectedMode === 'quick' ? t.text : t.border}`,
        borderRadius: t.r, padding: 20, cursor: 'pointer', transition: 'all 200ms ease', boxShadow: t.cardShadow,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: selectedMode === 'quick' ? t.orange : t.orangeLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 800, color: selectedMode === 'quick' ? '#fff' : t.orange }}>Q</span>
          </div>
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Quick Match</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: selectedMode === 'quick' ? '#aaa' : t.textMuted, margin: 0, lineHeight: 1.4 }}>2 teams, 1 game. Start scoring in under 10 seconds. No brackets needed.</p>
      </button>
    </div>
  );
}

function TournamentInput({ tourneyName, setTourneyName, tourneyTeams, filledTourneyTeams, updateTourneyTeam, removeTourneyTeam, addTourneyTeam }) {
  const keyedTourneyTeams = withStableKeys(tourneyTeams, 'tourney-team');

  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.r, padding: 20, boxShadow: t.cardShadow }}>
      <div style={{ marginBottom: 20 }}>
        <label htmlFor="wizard-tourney-name" style={{ fontFamily: MONO, fontSize: '0.5625rem', color: t.textMuted, letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>TOURNAMENT NAME</label>
        <input id="wizard-tourney-name" value={tourneyName} onChange={e => setTourneyName(e.target.value)} placeholder="e.g. Office Volleyball Cup"
          style={{ width: '100%', padding: '10px 12px', fontSize: '0.875rem', border: 'none', borderBottom: `2px solid ${tourneyName.trim() ? t.blue : t.border}`, background: 'transparent', outline: 'none', color: t.text, fontFamily: SWISS, transition: 'border-color 200ms ease', boxSizing: 'border-box' }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: t.textMuted, letterSpacing: '0.06em' }}>TEAMS ({filledTourneyTeams}/{tourneyTeams.length})</span>
          <span style={{ fontFamily: MONO, fontSize: '0.5rem', color: filledTourneyTeams >= MIN_TOURNAMENT_TEAMS ? t.green : t.textFaint, letterSpacing: '0.06em' }}>
            {filledTourneyTeams >= MIN_TOURNAMENT_TEAMS ? 'MIN 2 MET' : `NEED ${MIN_TOURNAMENT_TEAMS - filledTourneyTeams} MORE`}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {keyedTourneyTeams.map(({ key, value: tm }, idx) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: tm.trim() ? t.blue : t.textFaint, width: 18, textAlign: 'center', flexShrink: 0 }}>{idx + 1}</span>
              <input id={`wizard-team-${idx + 1}`} value={tm} onChange={e => updateTourneyTeam(idx, e.target.value)} placeholder={`Team ${idx + 1}`}
                style={{ flex: 1, padding: '8px 10px', fontSize: '0.8125rem', border: 'none', borderBottom: `1.5px solid ${tm.trim() ? t.blue : t.border}`, background: 'transparent', outline: 'none', color: t.text, fontFamily: SWISS, transition: 'border-color 200ms ease', boxSizing: 'border-box', minWidth: 0 }} />
              {tourneyTeams.length > MIN_TOURNAMENT_TEAMS && (
                <button type="button" onClick={() => removeTourneyTeam(idx)} style={{ ...bareButton, fontSize: '0.75rem', color: t.textFaint, cursor: 'pointer', padding: '4px 6px', lineHeight: 1 }} title="Remove team" aria-label={`Remove team ${idx + 1}`}>&times;</button>
              )}
            </div>
          ))}
        </div>
      </div>
      {tourneyTeams.length < 8 && (
        <button type="button" onClick={addTourneyTeam} style={{ ...bareButton, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', border: `1px dashed ${t.border}`, borderRadius: t.r, cursor: 'pointer' }}>
          <span style={{ fontFamily: MONO, fontSize: '0.75rem', color: t.blue, fontWeight: 700 }}>+</span>
          <span style={{ fontFamily: MONO, fontSize: '0.625rem', color: t.textMuted, letterSpacing: '0.04em' }}>ADD TEAM ({tourneyTeams.length}/8)</span>
        </button>
      )}
      {tourneyTeams.length >= 8 && (
        <div style={{ fontFamily: MONO, fontSize: '0.5625rem', color: t.textMuted, textAlign: 'center', padding: '8px 0' }}>Maximum 8 teams reached</div>
      )}
    </div>
  );
}

function QuickMatchInput({ team1, setTeam1, team2, setTeam2 }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.r, padding: 20, boxShadow: t.cardShadow }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="wizard-team1" style={{ fontFamily: MONO, fontSize: '0.5625rem', color: t.textMuted, letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>PLAYER / TEAM 1</label>
          <input id="wizard-team1" value={team1} onChange={e => setTeam1(e.target.value)} placeholder="e.g. Eagles"
            style={{ width: '100%', padding: '10px 12px', fontSize: '0.875rem', border: 'none', borderBottom: `2px solid ${team1 ? t.blue : t.border}`, background: 'transparent', outline: 'none', color: t.text, fontFamily: SWISS, transition: 'border-color 200ms ease', boxSizing: 'border-box' }} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: '0.625rem', color: t.textFaint, fontWeight: 600, padding: '0 8px', alignSelf: 'flex-end', marginBottom: 12 }}>VS</div>
        <div style={{ flex: 1 }}>
          <label htmlFor="wizard-team2" style={{ fontFamily: MONO, fontSize: '0.5625rem', color: t.textMuted, letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>PLAYER / TEAM 2</label>
          <input id="wizard-team2" value={team2} onChange={e => setTeam2(e.target.value)} placeholder="e.g. Hawks"
            style={{ width: '100%', padding: '10px 12px', fontSize: '0.875rem', border: 'none', borderBottom: `2px solid ${team2 ? t.blue : t.border}`, background: 'transparent', outline: 'none', color: t.text, fontFamily: SWISS, transition: 'border-color 200ms ease', boxSizing: 'border-box' }} />
        </div>
      </div>
    </div>
  );
}

function TournamentPreview({ sportIcon, sportName, tourneyName, tourneyTeams }) {
  const teams = tourneyTeams.filter(x => x.trim().length > 0);
  const keyedTeams = withStableKeys(teams, 'preview-team');
  const matchCount = teams.length * (teams.length - 1) / 2;
  return (
    <div style={{ background: t.surface, border: `1.5px solid ${t.text}`, borderRadius: t.r, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SportIcon name={sportIcon} size={20} color={t.text} />
          <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em' }}>{sportName.toUpperCase()}</span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: t.blue, background: t.blueLight, padding: '3px 10px', borderRadius: 10 }}>TOURNAMENT</span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: '1rem', fontWeight: 800, color: t.text, marginBottom: 16, letterSpacing: '-0.01em' }}>{tourneyName}</div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${t.border}` }}>
        {[{ v: teams.length, l: 'teams' }, { v: matchCount, l: 'matches' }, { v: 'Round Robin', l: 'format' }].map(stat => (
          <div key={stat.l}>
            <div style={{ fontFamily: MONO, fontSize: '1.125rem', fontWeight: 800, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{stat.v}</div>
            <div style={{ fontFamily: MONO, fontSize: '0.5rem', color: t.textMuted, letterSpacing: '0.06em', marginTop: 2 }}>{stat.l.toUpperCase()}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
        {keyedTeams.map(({ key, value: tm }, i) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: t.bg, borderRadius: 4, border: `1px solid ${t.border}` }}>
            <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: t.blue }}>{i + 1}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tm}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: t.textMuted }}>Brackets and point table generated automatically.</span>
        <span style={{ fontFamily: MONO, fontSize: '0.8125rem', fontWeight: 700, padding: '10px 28px', background: t.blue, color: '#fff', borderRadius: t.r, cursor: 'pointer', letterSpacing: '0.04em', flexShrink: 0 }}>Create tournament &rarr;</span>
      </div>
    </div>
  );
}

function QuickMatchPreview({ sportIcon, sportName, team1, team2 }) {
  return (
    <div style={{ background: t.surface, border: `1.5px solid ${t.text}`, borderRadius: t.r, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SportIcon name={sportIcon} size={20} color={t.text} />
          <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em' }}>{sportName.toUpperCase()}</span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: t.green, background: t.greenLight, padding: '3px 10px', borderRadius: 10 }}>QUICK MATCH</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', margin: '20px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: '0.625rem', color: t.textMuted, fontWeight: 600, letterSpacing: '0.06em', marginBottom: 6 }}>{team1.toUpperCase()}</div>
          <div style={{ fontFamily: MONO, fontSize: '2.5rem', fontWeight: 800, color: t.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>0</div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: '0.6875rem', color: t.textFaint, fontWeight: 600 }}>vs</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: '0.625rem', color: t.textMuted, fontWeight: 600, letterSpacing: '0.06em', marginBottom: 6 }}>{team2.toUpperCase()}</div>
          <div style={{ fontFamily: MONO, fontSize: '2.5rem', fontWeight: 800, color: t.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>0</div>
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: t.textMuted }}>Score updates in real time.</span>
        <span style={{ fontFamily: MONO, fontSize: '0.8125rem', fontWeight: 700, padding: '10px 28px', background: t.blue, color: '#fff', borderRadius: t.r, cursor: 'pointer', letterSpacing: '0.04em' }}>Start scoring &rarr;</span>
      </div>
    </div>
  );
}

function StepHead({ num, title, sub, active, done, chip }) {
  let stepBg = t.border;
  if (done) stepBg = t.green;
  else if (active) stepBg = t.blue;
  const stepTextColor = active || done ? t.text : t.textFaint;
  const subTextColor = active ? t.textSoft : t.textFaint;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: stepBg,
        color: '#fff', fontFamily: MONO, fontSize: '0.875rem', fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 300ms ease',
      }}>
        {done ? '\u2713' : num}
      </div>
      <div>
        <div style={{ fontFamily: MONO, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', color: stepTextColor, transition: 'color 300ms ease' }}>{title}</div>
        <div style={{ fontSize: '0.75rem', color: subTextColor, transition: 'color 300ms ease' }}>{sub}</div>
      </div>
      {chip}
    </div>
  );
}

/* ─── New User Flow ─── */
function NewUserFlow({ navigate }) {
  const [showExpanded, setShowExpanded] = useState(false);
  const st = useSportState();
  const modeSubtitle = getModeSubtitle(st);
  const setupSubtitle = getSetupSubtitle(st);
  const previewSubtitle = getPreviewSubtitle(st);

  const handleStart = () => {
    if (!st.selectedSport) return;
    if (st.isTourney) {
      navigate(`/${st.selectedSport}/tournament/new`, {
        state: {
          fromWizard: true,
          tournamentName: st.tourneyName.trim(),
          teams: st.tourneyTeams.filter((tm) => tm.trim().length > 0),
        },
      });
    } else {
      navigate(`/${st.selectedSport}/quick`, {
        state: {
          fromWizard: true,
          teams: [st.team1.trim(), st.team2.trim()],
        },
      });
    }
  };

  return (
    <div style={{ maxWidth: 672, margin: '0 auto', padding: '28px 24px' }}>
      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
        {[1, 2, 3, 4].map(step => {
          const { filled, current } = getProgressState(step, st);
          let background = t.border;
          if (filled) background = t.blue;
          else if (current) background = `${t.blue}40`;
          return <div key={step} style={{ flex: 1, height: 3, borderRadius: 2, background, transition: 'background 400ms ease' }} />;
        })}
      </div>

      {/* STEP 1: Pick a sport */}
      <div style={{ marginBottom: 24 }}>
        <StepHead num="1" title="PICK A SPORT" sub={st.selectedSport ? `${st.sportName} selected` : 'What are you scoring today?'} active={!st.selectedSport} done={!!st.selectedSport}
          chip={st.selectedSport ? (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: t.blueLight, borderRadius: 20 }}>
              <SportIcon name={st.sportIcon} size={16} color={t.blue} />
              <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: t.blue }}>{st.sportName.toUpperCase()}</span>
            </div>
          ) : null} />
        {!st.selectedSport || showExpanded ? (
          <SportGrid selectedSport={st.selectedSport} pickSport={(id) => { st.pickSport(id); setShowExpanded(false); }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={() => setShowExpanded(true)} style={{ ...bareButton, fontSize: '0.6875rem', color: t.blue, cursor: 'pointer' }}>Change sport</button>
          </div>
        )}
      </div>

      {/* STEP 2: Choose mode */}
      <div style={{ marginBottom: 24, opacity: st.selectedSport ? 1 : 0.25, pointerEvents: st.selectedSport ? 'auto' : 'none', transition: 'opacity 400ms ease' }}>
        <StepHead num="2" title="CHOOSE MODE"
          sub={modeSubtitle}
          active={st.selectedSport && !st.selectedMode} done={!!st.selectedMode}
          chip={st.selectedMode ? (
            <div style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 20, background: st.isTourney ? t.blueLight : t.orangeLight }}>
              <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: st.isTourney ? t.blue : t.orange }}>{st.selectedMode.toUpperCase()}</span>
            </div>
          ) : null} />
        <ModeCards selectedMode={st.selectedMode} pickMode={st.pickMode} />
      </div>

      {/* STEP 3: Team input */}
      <div style={{ marginBottom: 24, opacity: st.selectedMode ? 1 : 0.25, pointerEvents: st.selectedMode ? 'auto' : 'none', transition: 'opacity 400ms ease' }}>
        <StepHead num="3" title={st.isTourney ? 'SET UP TOURNAMENT' : 'NAME THE PLAYERS'}
          sub={setupSubtitle}
          active={st.selectedMode && !st.teamsReady} done={st.teamsReady} />
        {st.isTourney ? (
          <TournamentInput tourneyName={st.tourneyName} setTourneyName={st.setTourneyName} tourneyTeams={st.tourneyTeams} filledTourneyTeams={st.filledTourneyTeams} updateTourneyTeam={st.updateTourneyTeam} removeTourneyTeam={st.removeTourneyTeam} addTourneyTeam={st.addTourneyTeam} />
        ) : (
          <QuickMatchInput team1={st.team1} setTeam1={st.setTeam1} team2={st.team2} setTeam2={st.setTeam2} />
        )}
      </div>

      {/* STEP 4: Preview */}
      <div style={{ opacity: st.teamsReady ? 1 : 0.25, pointerEvents: st.teamsReady ? 'auto' : 'none', transition: 'opacity 400ms ease' }}>
        <StepHead num="4" title="READY TO GO" sub={previewSubtitle} active={st.teamsReady} done={false} />
        {st.teamsReady && st.isTourney && (
          <button type="button" onClick={handleStart} style={{ ...bareButton, width: '100%' }}>
            <TournamentPreview sportIcon={st.sportIcon} sportName={st.sportName} tourneyName={st.tourneyName} tourneyTeams={st.tourneyTeams} />
          </button>
        )}
        {st.teamsReady && !st.isTourney && (
          <button type="button" onClick={handleStart} style={{ ...bareButton, width: '100%' }}>
            <QuickMatchPreview sportIcon={st.sportIcon} sportName={st.sportName} team1={st.team1} team2={st.team2} />
          </button>
        )}
      </div>

      {/* Reset */}
      {st.selectedSport && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button type="button" onClick={() => { st.resetAll(); setShowExpanded(false); }} style={{ ...bareButton, fontSize: '0.6875rem', color: t.textMuted, cursor: 'pointer', textDecoration: 'underline' }}>Start over</button>
        </div>
      )}
    </div>
  );
}

/* ─── Existing User Dashboard ─── */
function getDashboardDisplayName(user) {
  return user?.username || user?.name || user?.displayName || null;
}

function ExistingUserDashboard({
  cloudAuthAvailable,
  isAuthenticated,
  navigate,
  user,
  sessions,
  allTournaments,
  recentMatches,
  showAllSports,
  setShowAllSports,
}) {
  const hasActive = sessions.length > 0;
  const activeTournaments = allTournaments.filter(tr => tr.isActive);
  const displayTournaments = allTournaments.slice(0, 4);
  const displayName = getDashboardDisplayName(user);
  const dashboardTitle = displayName ? `Welcome back, ${displayName}` : 'Welcome back';
  const playedCount = recentMatches.length;
  const tournamentCount = allTournaments.length;

  const favoriteIds = user?.favoriteGames || [];
  const favoriteSports = favoriteIds.length > 0
    ? allSportsList.filter(sp => favoriteIds.includes(sp.id))
    : allSportsList.slice(0, 3);
  const otherSports = allSportsList.filter(sp => !favoriteSports.some(f => f.id === sp.id));
  const visibleOthers = showAllSports ? otherSports : otherSports.slice(0, 4);
  const newTournamentPath = getNewTournamentPath({
    activeTournaments,
    displayTournaments,
    favoriteSports,
    recentMatches,
  });

  return (
    <div style={{ maxWidth: 672, margin: '0 auto', padding: '18px 16px 56px' }}>
      <section
        aria-labelledby="dashboard-welcome-title"
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 10,
          boxShadow: t.cardShadow,
          marginBottom: 20,
          padding: 18,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div>
            <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textMuted }}>
              App dashboard
            </span>
            <h2 id="dashboard-welcome-title" style={{ fontSize: '1.45rem', fontWeight: 750, lineHeight: 1.12, margin: '6px 0 0', color: t.text }}>
              {dashboardTitle}
            </h2>
          </div>
          <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', padding: '6px 9px', borderRadius: 999, background: isAuthenticated ? t.greenLight : t.blueLight, color: isAuthenticated ? t.green : t.blue, whiteSpace: 'nowrap' }}>
            {isAuthenticated ? 'Signed in' : 'Guest mode'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}>
          {[
            ['Active', sessions.length],
            ['Recent', playedCount],
            ['Events', tournamentCount],
          ].map(([label, value]) => (
            <div key={label} style={{ border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px 8px', background: t.bg }}>
              <div style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.textMuted }}>{label}</div>
              <div style={{ fontFamily: MONO, fontSize: '1.2rem', fontWeight: 850, color: t.text, lineHeight: 1.1 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <button type="button" onClick={() => navigate('/play')} style={{ ...btnPrimary, minHeight: 44, fontSize: '0.75rem' }}>Start scoring</button>
          <button type="button" onClick={() => navigate(newTournamentPath)} style={{ ...btnSecondary, minHeight: 44, fontSize: '0.75rem' }}>New tournament</button>
        </div>

        {cloudAuthAvailable && (
          <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12 }}>
            {isAuthenticated ? (
              <button
                type="button"
                aria-label="Account"
                onClick={() => navigate('/profile')}
                style={{ ...bareButton, width: '100%', minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${t.border}`, borderRadius: 8, cursor: 'pointer', padding: '10px 12px' }}
              >
                <span style={{ fontSize: '0.8125rem', fontWeight: 650, color: t.text }}>Account</span>
                <span style={{ fontSize: '0.75rem', color: t.textMuted }}>Sync and profile settings</span>
              </button>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                <p style={{ margin: 0, fontSize: '0.8125rem', lineHeight: 1.45, color: t.textSoft }}>
                  Continue as guest on this device, or use one account path to sign in or create an account for sync.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login?returnTo=%2Fapp')}
                  style={{ ...btnSecondary, width: '100%', minHeight: 42, fontSize: '0.75rem', borderColor: t.blue, color: t.blue }}
                >
                  Sign in or create account
                </button>
              </div>
            )}
          </div>
        )}

      {/* ── ACTIVE STATE ── */}
      {hasActive && (
        <div style={{ marginTop: 20 }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textMuted, display: 'block', marginBottom: 16 }}>Active</span>

          {sessions.map((session) => {
            const d = s.darkCard;
            const participantNames = session.participants.map(p => p.name);
            const scores = session.participants.map(p => session.scores[p.id]?.total ?? 0);
            const sportName = getSportFromName(session.name);
            const statusLabel = session.status === 'paused' ? 'PAUSED' : 'LIVE';
            const badgeBg = session.status === 'paused' ? { background: `${t.orange}25`, color: t.orange } : d.badge;

            return (
              <button
                key={session.id}
                type="button"
                style={{ ...bareButton, width: '100%', marginBottom: 12, cursor: 'pointer', ...d.outer, padding: 20 }}
                onClick={() => navigate(`/game/${session.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SportIcon name={sportName} size={20} color={d.text} />
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: d.text }}>{session.name}</span>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, padding: '3px 10px', borderRadius: 10, letterSpacing: '0.06em', ...badgeBg }}>{statusLabel}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', margin: '0 0 14px' }}>
                  {participantNames.map((name, i) => (
                    <div key={name} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: d.muted, marginBottom: 4 }}>{name}</div>
                      <div style={{ fontFamily: MONO, fontSize: '2rem', fontWeight: 800, color: d.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{scores[i]}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${d.border}`, paddingTop: 12 }}>
                  <span style={{ fontFamily: MONO, fontSize: '0.625rem', color: d.muted, letterSpacing: '0.06em' }}>
                    {session.status === 'paused' ? 'Paused' : 'In progress'}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: '0.6875rem', fontWeight: 700, padding: '8px 20px', borderRadius: s.btn.borderRadius, cursor: 'pointer', letterSpacing: '0.04em', ...d.resumeBtn }}>
                    Resume &rarr;
                  </span>
                </div>
              </button>
            );
          })}

          {activeTournaments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {activeTournaments.slice(0, 2).map(tr => (
                <button
                  key={tr.id}
                  type="button"
                  onClick={() => navigate(`/${tr.sportId}/tournament/${tr.id}`)}
                  style={{ ...bareButton, width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', ...s.activeRow }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.blueLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <SportIcon name={tr.sportIcon} size={18} color={t.blue} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: t.text }}>{tr.name}</div>
                    <div style={{ fontFamily: MONO, fontSize: '0.6875rem', color: t.textMuted, marginTop: 2 }}>
                      {tr.teams?.length || 0} teams &middot; {tr.completed}/{tr.total} matches played
                    </div>
                  </div>
                  <span style={{ ...btnPrimary, fontSize: '0.625rem', padding: '6px 14px' }}>Continue &rarr;</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── INACTIVE STATE ── */}
      {!hasActive && (
        <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 14, paddingTop: 12 }}>
          <p style={{ fontSize: '0.8125rem', color: t.textMuted, margin: 0 }}>
            No active games right now.
          </p>
        </div>
      )}

      {/* ── Sports ── */}
      </section>

      <div style={{ paddingTop: 4, marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textMuted }}>Sports</span>
          {!showAllSports && (
            <button type="button" onClick={() => setShowAllSports(true)} style={{ ...bareButton, fontSize: '0.6875rem', color: t.blue, cursor: 'pointer' }}>Browse all &rarr;</button>
          )}
          {showAllSports && (
            <button type="button" onClick={() => setShowAllSports(false)} style={{ ...bareButton, fontSize: '0.6875rem', color: t.textMuted, cursor: 'pointer' }}>Show less</button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(favoriteSports.length, 3)}, 1fr)`, gap: 12, marginBottom: 16 }}>
          {favoriteSports.map(sp => (
            <div key={sp.id} style={{ padding: '20px', cursor: 'pointer', ...s.sportCard }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <SportIcon name={sp.name} size={28} color={t.text} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: t.text }}>{sp.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => navigate(`/${sp.id}/tournament`)} style={{ ...btnPrimary, flex: 1, fontSize: '0.625rem', padding: '8px 8px' }}>Tournament</button>
                <button type="button" onClick={() => navigate(`/${sp.id}/quick`)} style={{ ...btnSecondary, flex: 1, fontSize: '0.625rem', padding: '8px 8px' }}>Quick Match</button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {visibleOthers.map(sp => (
            <button
              key={sp.id}
              type="button"
              onClick={() => navigate(`/${sp.id}/quick`)}
              style={{ ...bareButton, padding: '14px 10px', cursor: 'pointer', textAlign: 'center', ...s.sportCard }}
            >
              <SportIcon name={sp.name} size={20} color={t.textSoft} />
              <div style={{ fontSize: '0.75rem', fontWeight: 500, color: t.text, marginTop: 6 }}>{sp.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Recent matches ── */}
      {recentMatches.length > 0 && (
        <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 24, marginBottom: 48 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textMuted }}>Recent</span>
            <button type="button" onClick={() => navigate('/history')} style={{ ...bareButton, fontSize: '0.6875rem', color: t.blue, cursor: 'pointer' }}>History &rarr;</button>
          </div>
          {recentMatches.map((qm, i) => {
            const sportConfig = getSportById(qm.sport);
            const sportName = sportConfig?.name || null;
            return (
              <div key={qm.id}>
                {i > 0 && <div style={{ height: 1, background: t.border }} />}
                <button
                  type="button"
                  style={{ ...bareButton, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', cursor: 'pointer' }}
                  onClick={() => navigate('/history')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <SportIcon name={sportName} size={16} color={t.textMuted} />
                    <span style={{ fontSize: '0.875rem', color: t.text }}>{qm.team1} vs {qm.team2}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontFamily: MONO, fontSize: '0.875rem', fontWeight: 700, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{getScore(qm)}</span>
                    {qm.winner && <span style={{ fontSize: '0.6875rem', color: t.blue }}>{getWinnerLabel(qm.winner)}</span>}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tournaments ── */}
      {displayTournaments.length > 0 && (
        <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textMuted }}>Tournaments</span>
            <button type="button" onClick={() => navigate('/play')} style={{ ...bareButton, fontSize: '0.6875rem', color: t.blue, cursor: 'pointer' }}>View all &rarr;</button>
          </div>
          {displayTournaments.map((tr, i) => (
            <div key={tr.id}>
              {i > 0 && <div style={{ height: 1, background: t.border }} />}
              <button
                type="button"
                onClick={() => navigate(`/${tr.sportId}/tournament/${tr.id}`)}
                style={{ ...bareButton, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: tr.isActive ? t.blueLight : t.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <SportIcon name={tr.sportIcon} size={18} color={tr.isActive ? t.blue : t.green} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: t.text }}>{tr.name}</div>
                    <div style={{ fontSize: '0.75rem', color: t.textMuted, marginTop: 2 }}>{tr.teams?.length || 0} teams &middot; {tr.sportName}</div>
                  </div>
                </div>
                <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 600, padding: '4px 10px', borderRadius: 10, background: tr.isActive ? t.blueLight : t.greenLight, color: tr.isActive ? t.blue : t.green }}>
                  {tr.isActive ? `${tr.completed}/${tr.total}` : 'DONE'}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

SportGrid.propTypes = {
  selectedSport: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  pickSport: PropTypes.func.isRequired,
};

ModeCards.propTypes = {
  selectedMode: PropTypes.string,
  pickMode: PropTypes.func.isRequired,
};

TournamentInput.propTypes = {
  tourneyName: PropTypes.string.isRequired,
  setTourneyName: PropTypes.func.isRequired,
  tourneyTeams: PropTypes.arrayOf(PropTypes.string).isRequired,
  filledTourneyTeams: PropTypes.number.isRequired,
  updateTourneyTeam: PropTypes.func.isRequired,
  removeTourneyTeam: PropTypes.func.isRequired,
  addTourneyTeam: PropTypes.func.isRequired,
};

QuickMatchInput.propTypes = {
  team1: PropTypes.string.isRequired,
  setTeam1: PropTypes.func.isRequired,
  team2: PropTypes.string.isRequired,
  setTeam2: PropTypes.func.isRequired,
};

TournamentPreview.propTypes = {
  sportIcon: PropTypes.string.isRequired,
  sportName: PropTypes.string.isRequired,
  tourneyName: PropTypes.string.isRequired,
  tourneyTeams: PropTypes.arrayOf(PropTypes.string).isRequired,
};

QuickMatchPreview.propTypes = {
  sportIcon: PropTypes.string.isRequired,
  sportName: PropTypes.string.isRequired,
  team1: PropTypes.string.isRequired,
  team2: PropTypes.string.isRequired,
};

StepHead.propTypes = {
  num: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  title: PropTypes.string.isRequired,
  sub: PropTypes.string.isRequired,
  active: PropTypes.bool,
  done: PropTypes.bool,
  chip: PropTypes.node,
};

NewUserFlow.propTypes = {
  navigate: PropTypes.func.isRequired,
};

ExistingUserDashboard.propTypes = {
  cloudAuthAvailable: PropTypes.bool.isRequired,
  isAuthenticated: PropTypes.bool.isRequired,
  navigate: PropTypes.func.isRequired,
  user: PropTypes.shape({
    favoriteGames: PropTypes.arrayOf(PropTypes.string),
    username: PropTypes.string,
    name: PropTypes.string,
    displayName: PropTypes.string,
  }),
  sessions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    name: PropTypes.string.isRequired,
    status: PropTypes.string,
    participants: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      name: PropTypes.string,
    })),
    scores: PropTypes.object,
  })).isRequired,
  allTournaments: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    name: PropTypes.string,
    sportId: PropTypes.string,
    sportName: PropTypes.string,
    sportIcon: PropTypes.string,
    teams: PropTypes.array,
    completed: PropTypes.number,
    total: PropTypes.number,
    isActive: PropTypes.bool,
  })).isRequired,
  recentMatches: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    sport: PropTypes.string,
    team1: PropTypes.string,
    team2: PropTypes.string,
    winner: PropTypes.string,
  })).isRequired,
  showAllSports: PropTypes.bool.isRequired,
  setShowAllSports: PropTypes.func.isRequired,
};

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */
export default function DashboardLanding() {
  const navigate = useNavigate();
  const { cloudAuthAvailable, isAuthenticated, user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [allTournaments, setAllTournaments] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [showAllSports, setShowAllSports] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    setSessions(getActiveSessions());
    setAllTournaments(collectTournamentsBySport(getSportsList()));

    const qm = loadData(QM_KEY, []);
    qm.sort((a, b) => new Date(b.completedAt || b.date || b.createdAt) - new Date(a.completedAt || a.date || a.createdAt));
    setRecentMatches(qm.slice(0, 3));
  }, []);

  /* New user = no tournaments AND no quick matches AND no active sessions */
  const isNewUser = allTournaments.length === 0 && recentMatches.length === 0 && sessions.length === 0;
  return (
    <div style={{ fontFamily: SWISS, background: t.bg, color: t.text, minHeight: '100vh' }}
         className={`mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>
      <h1 className="sr-only">Dashboard</h1>

      {/* ── Route to correct view ── */}
      {isNewUser ? (
        <NewUserFlow navigate={navigate} />
      ) : (
        <ExistingUserDashboard
          cloudAuthAvailable={Boolean(cloudAuthAvailable)}
          isAuthenticated={Boolean(isAuthenticated)}
          navigate={navigate}
          user={user}
          sessions={sessions}
          allTournaments={allTournaments}
          recentMatches={recentMatches}
          showAllSports={showAllSports}
          setShowAllSports={setShowAllSports}
        />
      )}

      {/* ── Footer ── */}
      <footer style={{
        padding: '24px 32px', borderTop: '1.5px solid #1a1a1a',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        maxWidth: 672, margin: '0 auto',
      }}>
        <span style={{ fontFamily: MONO, fontSize: '0.75rem', fontWeight: 700, color: t.text }}>SCORE EASY</span>
        <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: t.textMuted }}>&copy; 2025</span>
      </footer>
    </div>
  );
}



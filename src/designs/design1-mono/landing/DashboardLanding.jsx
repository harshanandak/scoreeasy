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
import LiveNowStrip from '../live/LiveNowStrip';
import ErrorBoundary from '../../../components/ErrorBoundary';

const QM_KEY = 'se_quickmatches';

/* Going live is a property of an in-progress match: the LiveBroadcastBar that
   owns the actual go-live trigger only appears inside a scoring screen. The
   dashboard itself can only navigate, so the home's "Go live" hero entry is a
   labelled shortcut into the start-a-match flow (the sport picker), where the
   broadcast control then becomes available. */
const GO_LIVE_PATH = '/play';

/* ─── Tokens (CSS variables from the design system in index.css — single source of truth) ─── */
const t = {
  blue: 'var(--primary)', blueLight: 'var(--accent)',
  bg: 'var(--background)', surface: 'var(--card)', text: 'var(--foreground)',
  textSoft: 'var(--se-color-ink-soft)', textMuted: 'var(--muted-foreground)', textFaint: 'var(--muted-foreground)',
  border: 'var(--border)', borderStrong: 'var(--border)',
  /* Interior dividers dissect content softly; pure black is reserved for object edges. */
  divider: 'color-mix(in oklch, var(--border) 14%, transparent)',
  green: 'var(--primary)', greenLight: 'var(--accent)',
  orange: 'var(--se-color-warning)', orangeLight: 'var(--se-color-warning-soft)',
  cardShadow: 'var(--shadow-2xs)',
  r: 'var(--radius)',
};

/* ─── Layered style tokens ─── */
const s = {
  sportCard: { background: t.surface, border: `1px solid ${t.border}`, borderRadius: 'calc(var(--radius) + 4px)', boxShadow: t.cardShadow, padding: '16px 12px' },
  btn: { borderRadius: 'var(--radius)' },
  activeRow: { background: t.blueLight, border: 'none', borderRadius: 0, boxShadow: 'none' },
  darkCard: {
    bg: 'var(--foreground)', text: 'var(--primary-foreground)', muted: '#999', border: '#333',
    outer: { background: 'var(--foreground)', border: '1.5px solid #444', borderRadius: 0, boxShadow: `6px 6px 0 -1.5px var(--foreground), 6px 6px 0 0 ${t.blue}` },
    badge: { background: `color-mix(in oklch, ${t.blue} 15%, transparent)`, color: t.blue },
    resumeBtn: { background: t.blue, color: 'var(--primary-foreground)', border: 'none' },
  },
};

const btnPrimary = {
  fontFamily: MONO, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em',
  padding: '10px 16px', background: t.blue, color: 'var(--primary-foreground)', border: 'none',
  borderRadius: s.btn.borderRadius, cursor: 'pointer', textAlign: 'center',
};
const btnSecondary = {
  fontFamily: MONO, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em',
  padding: '10px 16px', background: 'transparent', color: t.text,
  border: `1px solid ${t.border}`, borderRadius: s.btn.borderRadius,
  cursor: 'pointer', textAlign: 'center',
};

const bareButton = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  margin: 0,
  textAlign: 'inherit',
};

/* Corner cross marks — the landing scorecard's signature detail */
function CardCross({ top, left, right, bottom }) {
  return (
    <span aria-hidden="true" style={{ position: 'absolute', top, left, right, bottom, fontFamily: MONO, fontSize: '0.5rem', color: t.textFaint, lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>+</span>
  );
}
CardCross.propTypes = {
  top: PropTypes.number,
  left: PropTypes.number,
  right: PropTypes.number,
  bottom: PropTypes.number,
};

const allSportsList = getSportsList();

const SPORT_NAMES = allSportsList.map(sp => sp.name);

const DEFAULT_FEATURED_SPORT_IDS = ['cricket', 'football', 'volleyball'];

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
  playedCount,
  showAllSports,
  setShowAllSports,
}) {
  const hasActive = sessions.length > 0;
  const activeTournaments = allTournaments.filter(tr => tr.isActive);
  const displayTournaments = allTournaments.slice(0, 4);
  const displayName = getDashboardDisplayName(user);
  const tournamentCount = allTournaments.length;

  /* Featured tier: real favourites first; else sports they recently played; else no tier at all. */
  const favoriteIds = user?.favoriteGames || [];
  const favoriteSports = allSportsList.filter(sp => favoriteIds.includes(sp.id));
  const recentSportIds = [...new Set(recentMatches.map(qm => qm.sport).filter(Boolean))];
  const recentSports = recentSportIds
    .map(id => allSportsList.find(sp => sp.id === id))
    .filter(Boolean)
    .slice(0, 4);
  const featuredSports = favoriteSports.length > 0 ? favoriteSports : recentSports;
  const featuredLabel = favoriteSports.length > 0 ? 'Favourites' : 'Recently played';
  const otherSports = allSportsList.filter(sp => !featuredSports.some(f => f.id === sp.id));
  const visibleOthers = showAllSports ? otherSports : otherSports.slice(0, 7);
  return (
    <div style={{ maxWidth: 672, margin: '0 auto', padding: '20px 16px 96px' }}>
      {/* ── Typographic header — no card, straight on the canvas ── */}
      <header style={{ marginBottom: 24, position: 'relative' }}>
        <div aria-hidden="true" style={{ position: 'absolute', top: 30, right: 0, opacity: 0.12, transform: 'rotate(-8deg)', pointerEvents: 'none' }}>
          <SportIcon name={featuredSports[0]?.name || 'Cricket'} size={48} color={t.text} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textMuted }}>
            App dashboard
          </span>
          <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '5px 8px', borderRadius: 'var(--radius)', background: t.blueLight, color: 'var(--accent-foreground)', whiteSpace: 'nowrap' }}>
            {isAuthenticated ? 'Signed in' : 'Guest mode'}
          </span>
        </div>
        <h2 id="dashboard-welcome-title" style={{ fontSize: 'clamp(2rem, 9vw, 2.75rem)', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.04em', margin: 0, color: t.text }}>
          {displayName ? <>Welcome back,<br />{displayName}.</> : <>Welcome<br />back.</>}
        </h2>
        <div aria-hidden="true" style={{ height: 2, background: t.text, marginTop: 16 }} />
      </header>

      {/* ── Stat line — pure typography, no chrome ── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          ['Active', sessions.length],
          ['Recent', playedCount],
          ['Events', tournamentCount],
        ].map(([label, value]) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: '1.125rem', fontWeight: 900, color: t.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
            <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textMuted }}>{label}</span>
          </span>
        ))}
      </div>

      {cloudAuthAvailable && (
        isAuthenticated ? (
          <button
            type="button"
            aria-label="Account"
            onClick={() => navigate('/profile')}
            style={{ ...bareButton, width: '100%', minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: `1px solid ${t.border}`, borderRadius: 'var(--radius)', background: t.surface, cursor: 'pointer', padding: '10px 14px', marginBottom: 12 }}
          >
            <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.text }}>Account</span>
            <span style={{ fontSize: '0.75rem', color: t.textMuted }}>Sync and profile settings &rarr;</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/login?returnTo=%2Fapp')}
            style={{ ...bareButton, width: '100%', minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: `1px solid ${t.border}`, borderRadius: 'var(--radius)', background: t.surface, cursor: 'pointer', padding: '10px 14px', marginBottom: 12 }}
          >
            <span style={{ fontSize: '0.8125rem', color: t.textSoft }}>Guest on this device</span>
            <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.blue }}>Sign in &rarr;</span>
          </button>
        )
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
            const badgeBg = session.status === 'paused' ? { background: `color-mix(in oklch, ${t.orange} 15%, transparent)`, color: t.orange } : d.badge;

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
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius)', border: `1px solid ${t.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxSizing: 'border-box' }}>
                    <SportIcon name={tr.sportIcon} size={18} color={t.text} />
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

      {/* ── Hero scorecard — landing-style card when nothing is live.
            Body tap = view the result in history; Rematch = quick match with the same teams. ── */}
      {!hasActive && (
        <div style={{ position: 'relative', border: `1px solid ${t.border}`, borderRadius: 'var(--radius)', background: t.surface, boxShadow: `4px 4px 0 ${t.blue}`, boxSizing: 'border-box' }}>
          <CardCross top={3} left={6} />
          <CardCross top={3} right={6} />
          <CardCross bottom={3} left={6} />
          <CardCross bottom={3} right={6} />
          {recentMatches[0] ? (
            <>
              <button
                type="button"
                aria-label="View last match in history"
                onClick={() => navigate('/history')}
                style={{ ...bareButton, display: 'block', width: '100%', textAlign: 'left', padding: '14px 16px 0', cursor: 'pointer' }}
              >
                <span style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: t.blue, letterSpacing: '0.06em' }}>&#9679; LAST MATCH</span>
                  {getSportById(recentMatches[0].sport)?.name && (
                    <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textSoft }}>{getSportById(recentMatches[0].sport).name}</span>
                  )}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingBottom: 12 }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: MONO, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.textSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recentMatches[0].team1}</span>
                  <span style={{ flexShrink: 0, fontFamily: MONO, fontSize: '1.5rem', fontWeight: 900, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{getScore(recentMatches[0])}</span>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: MONO, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.textSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{recentMatches[0].team2}</span>
                </span>
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 16px', borderTop: `1px solid ${t.divider}` }}>
                <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: t.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{recentMatches[0].winner ? getWinnerLabel(recentMatches[0].winner) : 'Completed'}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: -10 }}>
                  <button
                    type="button"
                    className="dash-action"
                    aria-label="Go live"
                    onClick={() => navigate(GO_LIVE_PATH)}
                    style={{ ...bareButton, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: t.text, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', padding: '14px 10px', minHeight: 44 }}
                  >
                    <span aria-hidden="true" style={{ color: '#dc2626' }}>&#9679;</span> Go live
                  </button>
                  {/* Only offer Rematch when the stored match resolves to a real sport; legacy id-only records would build /undefined/quick. */}
                  {getSportById(recentMatches[0].sport) && (
                    <button
                      type="button"
                      className="dash-action"
                      aria-label={`Rematch: ${recentMatches[0].team1} vs ${recentMatches[0].team2}`}
                      onClick={() => navigate(`/${recentMatches[0].sport}/quick`, { state: { teams: [recentMatches[0].team1, recentMatches[0].team2] } })}
                      style={{ ...bareButton, fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: t.blue, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', padding: '14px 10px', minHeight: 44 }}
                    >
                      Rematch &#9656;
                    </button>
                  )}
                </span>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate('/play')}
                style={{ ...bareButton, display: 'block', width: '100%', textAlign: 'left', padding: '14px 16px 12px', cursor: 'pointer' }}
              >
                <span style={{ display: 'block', fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: t.blue, letterSpacing: '0.06em', marginBottom: 8 }}>&#9679; READY</span>
                <span style={{ display: 'block', fontSize: '1.125rem', fontWeight: 900, letterSpacing: '-0.02em', color: t.text, lineHeight: 1.1 }}>Start your first match.</span>
                <span style={{ display: 'block', marginTop: 6, fontSize: '0.75rem', color: t.textMuted }}>Pick a sport below — scoring takes seconds.</span>
              </button>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', margin: '0 16px', borderTop: `1px solid ${t.divider}` }}>
                <button
                  type="button"
                  className="dash-action"
                  aria-label="Go live"
                  onClick={() => navigate(GO_LIVE_PATH)}
                  style={{ ...bareButton, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: t.text, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', padding: '14px 10px', marginRight: -10, minHeight: 44 }}
                >
                  <span aria-hidden="true" style={{ color: '#dc2626' }}>&#9679;</span> Go live
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Sports ── */}
      <div style={{ borderTop: `1px solid ${t.divider}`, marginTop: 28, paddingTop: 24, marginBottom: 36 }}>
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textMuted }}>01 / Sports</span>
        </div>

        <p style={{ margin: '0 0 14px', fontSize: '0.75rem', color: t.textMuted }}>
          Quick starts scoring now. Tournament builds a bracket.
        </p>

        {/* Featured tier — only when the user has favourites or recent play */}
        {featuredSports.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textFaint, display: 'block', marginBottom: 2 }}>{featuredLabel}</span>
            {featuredSports.map((sp, i) => (
              <div key={sp.id} className="dash-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: i < featuredSports.length - 1 ? `1px solid ${t.divider}` : 'none' }}>
                <SportIcon name={sp.name} size={22} color={t.text} />
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.9375rem', fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sp.name}</span>
                <button type="button" className="dash-action" onClick={() => navigate(`/${sp.id}/quick`)} style={{ ...bareButton, fontFamily: MONO, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.blue, cursor: 'pointer', padding: '14px 8px', minHeight: 44 }}>Quick &#9656;</button>
                <button type="button" className="dash-action" onClick={() => navigate(`/${sp.id}/tournament`)} style={{ ...bareButton, fontFamily: MONO, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.text, cursor: 'pointer', padding: '14px 8px', minHeight: 44 }}>Tournament</button>
              </div>
            ))}
          </div>
        )}

        {/* All sports — naked icon tiles, border appears on hover/press */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 6 }}>
          {visibleOthers.map(sp => (
            <button
              key={sp.id}
              type="button"
              className="dash-tile"
              aria-label={`Quick match: ${sp.name}`}
              onClick={() => navigate(`/${sp.id}/quick`)}
              style={{ ...bareButton, padding: '12px 4px 10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, borderRadius: 'var(--radius)' }}
            >
              <SportIcon name={sp.name} size={22} color={t.text} />
              <span style={{ width: '100%', fontSize: '0.625rem', fontWeight: 600, color: t.textSoft, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sp.name}</span>
            </button>
          ))}
          {otherSports.length > 7 && (
            <button
              type="button"
              className="dash-tile"
              onClick={() => setShowAllSports(!showAllSports)}
              style={{ ...bareButton, padding: '12px 4px 10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, borderRadius: 'var(--radius)' }}
            >
              <span aria-hidden="true" style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: '1.05rem', fontWeight: 800, color: t.blue, lineHeight: 1 }}>{showAllSports ? '−' : '+'}</span>
              <span style={{ width: '100%', fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.blue, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{showAllSports ? 'Less' : `${otherSports.length - 7} more`}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Recent matches ── */}
      {recentMatches.length > 0 && (
        <div style={{ borderTop: `1px solid ${t.divider}`, paddingTop: 24, marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textMuted }}>02 / Recent</span>
            <button type="button" onClick={() => navigate('/history')} style={{ ...bareButton, fontFamily: MONO, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.blue, cursor: 'pointer' }}>History &rarr;</button>
          </div>
          {recentMatches.map((qm, i) => {
            const sportConfig = getSportById(qm.sport);
            const sportName = sportConfig?.name || null;
            const team1Won = qm.winner === qm.team1;
            const team2Won = qm.winner === qm.team2;
            return (
              <div key={qm.id}>
                {i > 0 && <div style={{ height: 1, background: t.divider }} />}
                <button
                  type="button"
                  className="dash-row"
                  style={{ ...bareButton, width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', cursor: 'pointer' }}
                  onClick={() => navigate('/history')}
                >
                  <SportIcon name={sportName} size={18} color={t.textMuted} />
                  <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <span style={{ display: 'block', fontSize: '0.875rem', color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: team1Won ? 800 : 500 }}>{qm.team1}</span>
                      <span style={{ color: t.textFaint }}> vs </span>
                      <span style={{ fontWeight: team2Won ? 800 : 500 }}>{qm.team2}</span>
                    </span>
                    <span style={{ display: 'block', marginTop: 2, fontSize: '0.6875rem', color: t.textMuted }}>
                      {sportName ? `${sportName} · ` : ''}{qm.winner ? getWinnerLabel(qm.winner) : 'Completed'}
                    </span>
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: '1rem', fontWeight: 800, color: t.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{getScore(qm)}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tournaments ── */}
      {displayTournaments.length > 0 && (
        <div style={{ borderTop: `1px solid ${t.divider}`, paddingTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textMuted }}>03 / Tournaments</span>
            <button type="button" onClick={() => navigate('/play')} style={{ ...bareButton, fontFamily: MONO, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.blue, cursor: 'pointer' }}>View all &rarr;</button>
          </div>
          {displayTournaments.map((tr, i) => (
            <div key={tr.id}>
              {i > 0 && <div style={{ height: 1, background: t.divider }} />}
              <button
                type="button"
                onClick={() => navigate(`/${tr.sportId}/tournament/${tr.id}`)}
                style={{ ...bareButton, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius)', border: `1px solid ${t.border}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxSizing: 'border-box' }}>
                    <SportIcon name={tr.sportIcon} size={18} color={t.text} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: t.text }}>{tr.name}</div>
                    <div style={{ fontSize: '0.75rem', color: t.textMuted, marginTop: 2 }}>{tr.teams?.length || 0} teams &middot; {tr.sportName}</div>
                  </div>
                </div>
                <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.06em', padding: '4px 10px', borderRadius: 'var(--radius)', background: tr.isActive ? t.blueLight : t.greenLight, color: 'var(--accent-foreground)' }}>
                  {tr.isActive ? `${tr.completed}/${tr.total}` : 'DONE'}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Micro-interactions for rows, actions, and tiles */}
      <style>{`
        .dash-row { transition: background 150ms ease; }
        .dash-action { border-radius: var(--radius); transition: background 150ms ease, transform 120ms ease; }
        .dash-action:hover { background: var(--muted); transform: translateY(-1px); }
        .dash-action:active { transform: translateY(0); background: var(--accent); }
        .dash-tile { border: 1px solid transparent; transition: border-color 150ms ease, background 150ms ease, transform 120ms ease, box-shadow 150ms ease; }
        .dash-tile:hover { border-color: var(--border); background: var(--card); transform: translateY(-1px); box-shadow: var(--shadow-2xs); }
        .dash-tile:active { transform: translateY(0); box-shadow: none; background: var(--accent); border-color: var(--border); }
      `}</style>
    </div>
  );
}

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
  playedCount: PropTypes.number.isRequired,
  showAllSports: PropTypes.bool.isRequired,
  setShowAllSports: PropTypes.func.isRequired,
};

/* ─── Empty Dashboard (Variant A · Calm) ───
   Shown when there is zero saved data. Mirrors the real dashboard layout with a
   single brutal hero CTA, dimmed ghost rows, a get-started checklist, and featured
   quick tiles — so the home never collapses into the setup wizard. */
const GET_STARTED_STEPS = [
  { label: 'Play a match', sub: 'Pick a sport and start scoring' },
  { label: 'Save the result', sub: 'Finish to log it automatically' },
  { label: 'See your stats', sub: 'Track wins, streaks, and history' },
];

function EmptyDashboard({ navigate, isAuthenticated, user }) {
  const displayName = getDashboardDisplayName(user);

  /* Featured tier: real favourites first; else a few popular defaults so the row is never empty. */
  const favoriteIds = user?.favoriteGames || [];
  const favoriteSports = allSportsList.filter(sp => favoriteIds.includes(sp.id));
  const defaultSports = DEFAULT_FEATURED_SPORT_IDS
    .map(id => allSportsList.find(sp => sp.id === id))
    .filter(Boolean);
  const featuredSports = favoriteSports.length > 0 ? favoriteSports : defaultSports;
  const featuredLabel = favoriteSports.length > 0 ? 'Favourites' : 'Popular';

  return (
    <div style={{ maxWidth: 672, margin: '0 auto', padding: '20px 16px 96px' }}>
      {/* ── Typographic header — matches the returning dashboard's voice ── */}
      <header style={{ marginBottom: 24, position: 'relative' }}>
        <div aria-hidden="true" style={{ position: 'absolute', top: 30, right: 0, opacity: 0.12, transform: 'rotate(-8deg)', pointerEvents: 'none' }}>
          <SportIcon name={featuredSports[0]?.name || 'Cricket'} size={48} color={t.text} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textMuted }}>
            App dashboard
          </span>
          <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '5px 8px', borderRadius: 'var(--radius)', background: t.blueLight, color: 'var(--accent-foreground)', whiteSpace: 'nowrap' }}>
            {isAuthenticated ? 'Signed in' : 'Guest mode'}
          </span>
        </div>
        <h2 id="dashboard-welcome-title" style={{ fontSize: 'clamp(2rem, 9vw, 2.75rem)', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.04em', margin: 0, color: t.text }}>
          {displayName ? <>Welcome,<br />{displayName}.</> : <>Welcome.</>}
        </h2>
        <div aria-hidden="true" style={{ height: 2, background: t.text, marginTop: 16 }} />
      </header>

      {/* ── Hero — brutal scorecard CTA: the one decision moment on this screen ── */}
      <div style={{ position: 'relative', border: `1px solid ${t.border}`, borderRadius: 'var(--radius)', background: t.surface, boxShadow: `4px 4px 0 ${t.blue}`, boxSizing: 'border-box' }}>
        <CardCross top={3} left={6} />
        <CardCross top={3} right={6} />
        <CardCross bottom={3} left={6} />
        <CardCross bottom={3} right={6} />
        <button
          type="button"
          aria-label="Play your first match"
          onClick={() => navigate('/play')}
          style={{ ...bareButton, display: 'block', width: '100%', textAlign: 'left', padding: '16px 16px 14px', cursor: 'pointer' }}
        >
          <span style={{ display: 'block', fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: t.blue, letterSpacing: '0.06em', marginBottom: 8 }}>&#9679; READY</span>
          <span style={{ display: 'block', fontSize: '1.375rem', fontWeight: 900, letterSpacing: '-0.02em', color: t.text, lineHeight: 1.1 }}>Play your first match.</span>
          <span style={{ display: 'block', marginTop: 6, fontSize: '0.75rem', color: t.textMuted }}>Pick a sport and you are scoring in seconds.</span>
          <span style={{ display: 'inline-flex', marginTop: 14, ...btnPrimary }}>Start playing &rarr;</span>
        </button>
        {/* Secondary entry: start a match and broadcast it live to spectators. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', margin: '0 16px', borderTop: `1px solid ${t.divider}` }}>
          <button
            type="button"
            className="dash-action"
            aria-label="Go live"
            onClick={() => navigate(GO_LIVE_PATH)}
            style={{ ...bareButton, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: t.text, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', padding: '14px 10px', marginRight: -10, minHeight: 44 }}
          >
            <span aria-hidden="true" style={{ color: '#dc2626' }}>&#9679;</span> Go live
          </button>
        </div>
      </div>

      {/* ── Ghost recent rows — a preview of where matches will land ── */}
      <div style={{ borderTop: `1px solid ${t.divider}`, marginTop: 28, paddingTop: 24 }}>
        <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textMuted, display: 'block', marginBottom: 12 }}>Recent</span>
        <div aria-hidden="true">
          {[0, 1].map((row) => (
            <div key={row} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', opacity: 0.4, borderTop: row > 0 ? `1px solid ${t.divider}` : 'none' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: t.divider, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', height: 10, width: '60%', background: t.divider, borderRadius: 3 }} />
                <span style={{ display: 'block', marginTop: 6, height: 8, width: '35%', background: t.divider, borderRadius: 3 }} />
              </span>
              <span style={{ height: 14, width: 40, background: t.divider, borderRadius: 3, flexShrink: 0 }} />
            </div>
          ))}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: t.textMuted, textAlign: 'center' }}>Your matches will appear here</p>
      </div>

      {/* ── Get-started checklist ── */}
      <div style={{ borderTop: `1px solid ${t.divider}`, marginTop: 28, paddingTop: 24 }}>
        <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textMuted, display: 'block', marginBottom: 14 }}>Get started</span>
        {GET_STARTED_STEPS.map((step, i) => (
          <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i > 0 ? `1px solid ${t.divider}` : 'none' }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: MONO, fontSize: '0.6875rem', fontWeight: 800, color: t.text }}>{i + 1}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: MONO, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.text }}>{step.label}</span>
              <span style={{ display: 'block', marginTop: 2, fontSize: '0.75rem', color: t.textMuted }}>{step.sub}</span>
            </span>
          </div>
        ))}
      </div>

      {/* ── Featured sports — quick tiles, never empty ── */}
      <div style={{ borderTop: `1px solid ${t.divider}`, marginTop: 28, paddingTop: 24 }}>
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textMuted }}>01 / Sports</span>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: '0.75rem', color: t.textMuted }}>Tap a sport to start scoring now.</p>
        <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textFaint, display: 'block', marginBottom: 2 }}>{featuredLabel}</span>
        {featuredSports.map((sp, i) => (
          <div key={sp.id} className="dash-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: i < featuredSports.length - 1 ? `1px solid ${t.divider}` : 'none' }}>
            <SportIcon name={sp.name} size={22} color={t.text} />
            <span style={{ flex: 1, minWidth: 0, fontSize: '0.9375rem', fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sp.name}</span>
            <button type="button" className="dash-action" onClick={() => navigate(`/${sp.id}/quick`)} style={{ ...bareButton, fontFamily: MONO, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.blue, cursor: 'pointer', padding: '14px 8px', minHeight: 44 }}>Quick &#9656;</button>
            <button type="button" className="dash-action" onClick={() => navigate(`/${sp.id}/tournament`)} style={{ ...bareButton, fontFamily: MONO, fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.text, cursor: 'pointer', padding: '14px 8px', minHeight: 44 }}>Tournament</button>
          </div>
        ))}
      </div>

      <style>{`
        .dash-row { transition: background 150ms ease; }
        .dash-action { border-radius: var(--radius); transition: background 150ms ease, transform 120ms ease; }
        .dash-action:hover { background: var(--muted); transform: translateY(-1px); }
        .dash-action:active { transform: translateY(0); background: var(--accent); }
      `}</style>
    </div>
  );
}

EmptyDashboard.propTypes = {
  navigate: PropTypes.func.isRequired,
  isAuthenticated: PropTypes.bool.isRequired,
  user: PropTypes.shape({
    favoriteGames: PropTypes.arrayOf(PropTypes.string),
    username: PropTypes.string,
    name: PropTypes.string,
    displayName: PropTypes.string,
  }),
};

/* Read every persisted slice the dashboard needs in one synchronous pass.
   Called from lazy useState initializers so the first paint already has real
   data — no empty→populated flash from a post-mount effect. The underlying
   storage helpers swallow corrupt JSON and return their defaults, so this stays
   safe to run during render. */
function readDashboardState() {
  const sessions = getActiveSessions();
  const allTournaments = collectTournamentsBySport(getSportsList());

  const qm = loadData(QM_KEY, []);
  qm.sort((a, b) => new Date(b.completedAt || b.date || b.createdAt) - new Date(a.completedAt || a.date || a.createdAt));

  return {
    sessions,
    allTournaments,
    playedCount: qm.length,
    recentMatches: qm.slice(0, 3),
  };
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */
export default function DashboardLanding() {
  const navigate = useNavigate();
  const { cloudAuthAvailable, isAuthenticated, user } = useAuth();
  const [visible, setVisible] = useState(false);
  /* Lazy initializer: read every localStorage slice once, synchronously, before
     first paint — so the dashboard never flashes empty then re-renders populated. */
  const [{ sessions, allTournaments, recentMatches, playedCount }] = useState(readDashboardState);
  const [showAllSports, setShowAllSports] = useState(false);

  useEffect(() => {
    /* Mount-only fade-in trigger; data is already loaded via lazy init above. */
    requestAnimationFrame(() => setVisible(true));
  }, []);

  /* Zero data = no tournaments AND no quick matches AND no active sessions.
     The dashboard always renders; at zero data it shows the calm empty state
     (the guided wizard now lives on /play, not here). */
  const hasNoData = allTournaments.length === 0 && recentMatches.length === 0 && sessions.length === 0;
  return (
    <div style={{ fontFamily: SWISS, background: t.bg, color: t.text, minHeight: '100vh' }}
         className={`mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>
      <h1 className="sr-only">Dashboard</h1>

      {/* Public "live now" discovery rail (scoreeasy-3ws) — renders nothing when
          nothing is live. Isolated in an ErrorBoundary with a SILENT fallback so a
          backend hiccup (e.g. listLiveFeed not yet deployed during a rollout)
          degrades to "no strip" instead of crashing the whole home. */}
      <ErrorBoundary fallback={null} captureToSentry={false}>
        <LiveNowStrip />
      </ErrorBoundary>

      {hasNoData ? (
        <EmptyDashboard
          navigate={navigate}
          isAuthenticated={Boolean(isAuthenticated)}
          user={user}
        />
      ) : (
        <ExistingUserDashboard
          cloudAuthAvailable={Boolean(cloudAuthAvailable)}
          isAuthenticated={Boolean(isAuthenticated)}
          navigate={navigate}
          user={user}
          sessions={sessions}
          allTournaments={allTournaments}
          recentMatches={recentMatches}
          playedCount={playedCount}
          showAllSports={showAllSports}
          setShowAllSports={setShowAllSports}
        />
      )}

    </div>
  );
}



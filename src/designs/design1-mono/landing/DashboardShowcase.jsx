/**
 * Dashboard Showcase — /showcase/dashboard-variants
 * V1 Clean Production as the base layout.
 * Tabs switch between E0-E4 existing-user dashboard variations.
 */
import { useState } from 'react';
import SportIcon from './sportIcons';
import { MONO, SWISS } from './landingTheme';
import useIsMobile from './useIsMobile';

/* ─── Tokens ─── */
const t = {
  blue: '#0066ff', blueLight: '#e8f0ff',
  bg: '#fafafa', surface: '#ffffff', text: '#1a1a1a',
  textSoft: '#555', textMuted: '#888', textFaint: '#bbb',
  border: '#e8e8e8', borderMed: '#d0d0d0', borderStrong: '#1a1a1a',
  green: '#16a34a', greenLight: '#dcfce7',
  orange: '#ea580c', orangeLight: '#fff7ed',
  cardShadow: '0 1px 4px rgba(0,0,0,0.05)',
  r: 6,
};

const activateOnKeyboard = (handler) => (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handler(event);
  }
};

/* ─── Mock data ─── */
const allSports = [
  { id: 'cricket', name: 'Cricket', icon: 'Cricket' },
  { id: 'football', name: 'Football', icon: 'Football' },
  { id: 'volleyball', name: 'Volleyball', icon: 'Volleyball' },
  { id: 'tennis', name: 'Tennis', icon: 'Tennis' },
  { id: 'basketball', name: 'Basketball', icon: 'Basketball' },
  { id: 'badminton', name: 'Badminton', icon: 'Badminton' },
  { id: 'hockey', name: 'Hockey', icon: 'Hockey' },
  { id: 'tabletennis', name: 'Table Tennis', icon: 'Table Tennis' },
  { id: 'golf', name: 'Golf', icon: 'Golf' },
  { id: 'pool', name: 'Pool', icon: 'Pool' },
  { id: 'chess', name: 'Chess', icon: 'Chess' },
  { id: 'rugby', name: 'Rugby', icon: 'Rugby' },
  { id: 'frisbee', name: 'Frisbee', icon: 'Frisbee' },
  { id: 'handball', name: 'Handball', icon: 'Handball' },
];
const mockMatches = [
  { sport: 'Tennis', teams: 'Player 1 vs Player 2', score: '6 \u2014 4', winner: 'Player 1 won', date: '24.02', icon: 'Tennis' },
  { sport: 'Cricket', teams: 'India vs Australia', score: '186/4 vs 142/10', winner: 'India won', date: '23.02', icon: 'Cricket' },
  { sport: 'Football', teams: 'City vs United', score: '2 \u2014 1', winner: 'City won', date: '22.02', icon: 'Football' },
];
const mockTournaments = [
  { name: 'IPL League 2025', sport: 'Cricket', teams: 8, progress: '3/12', icon: 'Cricket', active: true },
  { name: 'Office VB Cup', sport: 'Volleyball', teams: 4, progress: '6/6', icon: 'Volleyball', active: false },
];

/* ═══════════════════════════════════════
   SHARED BUILDING BLOCKS
   ═══════════════════════════════════════ */

function Nav({ username, mobile }) {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: t.bg,
      borderBottom: '1.5px solid #1a1a1a',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: mobile ? '12px 16px' : '16px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: MONO, fontWeight: 800,
          fontSize: mobile ? '0.75rem' : '0.875rem',
          lineHeight: 1.1, letterSpacing: '-0.02em', color: t.text,
        }}>
          SCORE<br />EASY
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 12 : 24 }}>
          {!mobile && ['History', 'Statistics'].map(link => (
            <span key={link} style={{
              fontFamily: MONO, fontSize: '0.75rem', color: t.textMuted,
              textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer',
            }}>{link}</span>
          ))}
          <span style={{
            fontFamily: MONO, fontSize: mobile ? '0.625rem' : '0.75rem', fontWeight: 700,
            color: t.text, padding: mobile ? '6px 10px' : '8px 16px',
            border: '1.5px solid #1a1a1a', background: 'transparent',
          }}>
            @{username}
          </span>
        </div>
      </div>
    </nav>
  );
}

function Sec({ label, action, children, style: s }) {
  return (
    <div style={s}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textMuted }}>{label}</span>
        {action && <span style={{ fontSize: '0.6875rem', color: t.blue, cursor: 'pointer' }}>{action}</span>}
      </div>
      {children}
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontFamily: MONO, fontSize: '1.125rem', fontWeight: 700, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontSize: '0.6875rem', color: t.textMuted }}>{label}</span>
    </div>
  );
}

function LiveCard({ compact, r = t.r }) {
  const p = compact ? 16 : 20;
  const scoreSize = compact ? '1.75rem' : '2rem';
  return (
    <div style={{
      background: t.surface, border: `1.5px solid ${t.blue}`, borderRadius: r, padding: p,
      boxShadow: `0 0 0 3px ${t.blueLight}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: compact ? 10 : 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SportIcon name="Volleyball" size={compact ? 18 : 20} color={t.text} />
          <span style={{ fontSize: compact ? '0.75rem' : '0.8125rem', fontWeight: 600, color: t.text }}>Volleyball</span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: t.blue, background: t.blueLight, padding: '3px 10px', borderRadius: 10, letterSpacing: '0.06em' }}>LIVE</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', margin: `0 0 ${compact ? 10 : 14}px` }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: t.textMuted, marginBottom: 4 }}>Eagles</div>
          <div style={{ fontFamily: MONO, fontSize: scoreSize, fontWeight: 800, color: t.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>25</div>
        </div>
        <div style={{ fontSize: '0.6875rem', color: t.textFaint, fontWeight: 600 }}>vs</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: t.textMuted, marginBottom: 4 }}>Hawks</div>
          <div style={{ fontFamily: MONO, fontSize: scoreSize, fontWeight: 800, color: t.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>23</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${t.border}`, paddingTop: compact ? 10 : 12 }}>
        <span style={{ fontFamily: MONO, fontSize: '0.625rem', color: t.textMuted, letterSpacing: '0.06em' }}>Set 3 of 5 &mdash; Deuce</span>
        <span style={{ fontFamily: MONO, fontSize: '0.6875rem', fontWeight: 700, padding: '7px 18px', background: t.blue, color: '#fff', borderRadius: r, cursor: 'pointer', letterSpacing: '0.04em' }}>Resume &rarr;</span>
      </div>
    </div>
  );
}

function TRow({ tr, r = t.r }) {
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: r, padding: '14px 16px',
      boxShadow: t.cardShadow, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: r, background: tr.active ? t.blueLight : t.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SportIcon name={tr.icon} size={18} color={tr.active ? t.blue : t.green} />
        </div>
        <div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: t.text }}>{tr.name}</div>
          <div style={{ fontSize: '0.6875rem', color: t.textMuted }}>{tr.teams} teams &middot; {tr.sport}</div>
        </div>
      </div>
      <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 600, padding: '3px 8px', borderRadius: 10, background: tr.active ? t.blueLight : t.greenLight, color: tr.active ? t.blue : t.green }}>
        {tr.active ? tr.progress : 'DONE'}
      </span>
    </div>
  );
}

function MRow({ m, r = t.r }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: r, boxShadow: t.cardShadow,
    }}>
      <div style={{ width: 32, height: 32, borderRadius: r, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <SportIcon name={m.icon} size={16} color={t.textMuted} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.teams}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
          <span style={{ fontFamily: MONO, fontSize: '0.75rem', fontWeight: 700, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{m.score}</span>
          <span style={{ fontSize: '0.625rem', color: t.blue }}>{m.winner}</span>
        </div>
      </div>
      <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: t.textFaint, flexShrink: 0 }}>{m.date}</span>
    </div>
  );
}

function Tile({ sport, showButtons }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.r, padding: '12px 8px', textAlign: 'center', cursor: 'pointer', boxShadow: t.cardShadow }}>
      <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}><SportIcon name={sport.icon} size={24} color={t.text} /></div>
      <div style={{ fontFamily: MONO, fontSize: '0.5rem', fontWeight: 600, letterSpacing: '0.04em', color: t.textSoft }}>{sport.name.toUpperCase()}</div>
      {showButtons && (
        <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          <span style={{ flex: 1, fontFamily: MONO, fontSize: '0.5rem', fontWeight: 700, padding: '5px 2px', background: t.blue, color: '#fff', borderRadius: 4, textAlign: 'center', cursor: 'pointer' }}>TOURNEY</span>
          <span style={{ flex: 1, fontFamily: MONO, fontSize: '0.5rem', fontWeight: 700, padding: '5px 2px', border: `1px solid ${t.border}`, color: t.text, borderRadius: 4, textAlign: 'center', cursor: 'pointer' }}>QUICK</span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   EXISTING USER DASHBOARD
   Simple, clean layout inspired by the original homepage.
   Favorites-first sport grid, all sports clickable.
   Active game shown prominently when present.
   ═══════════════════════════════════════ */

/* Favorites determined by onboarding picks + play history + settings.
   In production this comes from Convex user profile. */
const favoriteSportNames = ['Cricket', 'Football', 'Tennis'];
const otherSportNames = allSports.filter(sp => !favoriteSportNames.includes(sp.name));

/* Layered style — stacked paper depth, dark card with blue plate peeking beneath */
const s = {
  card: { background: t.surface, border: 'none', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  row: { background: 'transparent', border: 'none', borderRadius: 0, boxShadow: 'none', borderBottom: `1px solid ${t.border}`, paddingBottom: 10, marginBottom: 10 },
  sportCard: { background: t.surface, border: 'none', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '16px 12px' },
  btn: { borderRadius: 6 },
  liveCard: { borderRadius: 0, border: `1.5px solid ${t.text}`, boxShadow: `6px 6px 0 -1.5px ${t.surface}, 6px 6px 0 0 ${t.blue}` },
  activeRow: { background: t.blueLight, border: 'none', borderRadius: 0, boxShadow: 'none' },
  nudge: { background: t.text, border: 'none', borderRadius: 0, color: '#fff', boxShadow: `3px 3px 0 ${t.blue}` },
  darkCard: {
    bg: '#1a1a1a', text: '#ffffff', muted: '#999', border: '#333',
    outer: { background: '#1a1a1a', border: `1.5px solid #444`, borderRadius: 0, boxShadow: `6px 6px 0 -1.5px #1a1a1a, 6px 6px 0 0 ${t.blue}` },
    badge: { background: `${t.blue}25`, color: t.blue },
    resumeBtn: { background: t.blue, color: '#fff', border: 'none' },
  },
};

function ExistingUser({ hasActive }) {
  const mobile = useIsMobile();
  const [showAllSports, setShowAllSports] = useState(false);
  const bg = t.bg;
  const d = s.darkCard;
  const activeTournaments = mockTournaments.filter(tr => tr.active);
  const doneTournaments = mockTournaments.filter(tr => !tr.active);

  /* Production-matching button styles */
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

  /* Divider matching production mono-divider */
  const divider = <div style={{ height: 1, background: t.border }} />;

  return (
    <div style={{ background: bg, minHeight: '100%' }}>

      {/* ── Content container ── */}
      <div style={{ maxWidth: 672, margin: '0 auto', padding: mobile ? '24px 16px 40px' : '40px 24px 56px' }}>

        {/* ── ACTIVE STATE: Dark live scorecard + active tournaments ── */}
        {hasActive && (
          <div style={{ marginBottom: 48 }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textMuted, display: 'block', marginBottom: 16 }}>Active</span>

            {/* Dark scorecard — variant-driven */}
            <div style={{
              padding: mobile ? 16 : 20,
              ...d.outer,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SportIcon name="Volleyball" size={20} color={d.text} />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: d.text }}>Volleyball</span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, padding: '3px 10px', borderRadius: 10, letterSpacing: '0.06em', ...d.badge }}>LIVE</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', margin: '0 0 14px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: d.muted, marginBottom: 4 }}>Eagles</div>
                  <div style={{ fontFamily: MONO, fontSize: '2rem', fontWeight: 800, color: d.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>25</div>
                </div>
                <div style={{ fontSize: '0.6875rem', color: d.muted, fontWeight: 600 }}>vs</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: d.muted, marginBottom: 4 }}>Hawks</div>
                  <div style={{ fontFamily: MONO, fontSize: '2rem', fontWeight: 800, color: d.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>23</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${d.border}`, paddingTop: 12 }}>
                <span style={{ fontFamily: MONO, fontSize: '0.625rem', color: d.muted, letterSpacing: '0.06em' }}>Set 3 of 5 &mdash; Deuce</span>
                <span style={{ fontFamily: MONO, fontSize: '0.6875rem', fontWeight: 700, padding: '8px 20px', borderRadius: s.btn.borderRadius, cursor: 'pointer', letterSpacing: '0.04em', ...d.resumeBtn }}>Resume &rarr;</span>
              </div>
            </div>

            {/* Active tournaments */}
            {activeTournaments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {activeTournaments.map(tr => (
                  <div key={tr.name} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                    cursor: 'pointer', ...s.activeRow,
                  }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.blueLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <SportIcon name={tr.icon} size={18} color={t.blue} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: t.text }}>{tr.name}</div>
                      <div style={{ fontFamily: MONO, fontSize: '0.6875rem', color: t.textMuted, marginTop: 2 }}>{tr.teams} teams &middot; {tr.progress} matches played</div>
                    </div>
                    <span style={{ ...btnPrimary, fontSize: '0.625rem', padding: '6px 14px' }}>Continue &rarr;</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── INACTIVE STATE ── */}
        {!hasActive && (
          <div style={{ textAlign: 'center', padding: mobile ? '40px 0 48px' : '56px 0 56px' }}>
            <p style={{ fontSize: '0.875rem', color: t.textMuted, margin: '0 0 20px' }}>
              No active games
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <span style={btnPrimary}>Start a game</span>
              <span style={btnSecondary}>New tournament</span>
            </div>
          </div>
        )}

        {/* ── Sports ── */}
        {(() => {
          const favSports = allSports.filter(sp => favoriteSportNames.includes(sp.name));
          const restSports = allSports.filter(sp => !favoriteSportNames.includes(sp.name));
          const visibleRest = showAllSports ? restSports : restSports.slice(0, mobile ? 4 : 3);

          return (
            <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 24, marginBottom: 48 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textMuted }}>Sports</span>
                {!showAllSports && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => setShowAllSports(true)}
                    onKeyDown={activateOnKeyboard(() => setShowAllSports(true))}
                    style={{ fontSize: '0.6875rem', color: t.blue, cursor: 'pointer' }}
                  >
                    Browse all &rarr;
                  </span>
                )}
                {showAllSports && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => setShowAllSports(false)}
                    onKeyDown={activateOnKeyboard(() => setShowAllSports(false))}
                    style={{ fontSize: '0.6875rem', color: t.textMuted, cursor: 'pointer' }}
                  >
                    Show less
                  </span>
                )}
              </div>

              {/* Favorite sports — full cards with actions */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${mobile ? 1 : favSports.length}, 1fr)`, gap: 12, marginBottom: 16 }}>
                {favSports.map(sp => (
                  <div key={sp.id} style={{ padding: '20px', cursor: 'pointer', ...s.sportCard }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <SportIcon name={sp.icon} size={28} color={t.text} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: t.text }}>{sp.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ ...btnPrimary, flex: 1, fontSize: '0.625rem', padding: '8px 8px' }}>Tournament</span>
                      <span style={{ ...btnSecondary, flex: 1, fontSize: '0.625rem', padding: '8px 8px' }}>Quick Match</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Other sports — compact icon + name cards */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${mobile ? 3 : 4}, 1fr)`, gap: 10 }}>
                {visibleRest.map(sp => (
                  <div key={sp.id} style={{ padding: '14px 10px', cursor: 'pointer', textAlign: 'center', ...s.sportCard }}>
                    <SportIcon name={sp.icon} size={20} color={t.textSoft} />
                    <div style={{ fontSize: '0.75rem', fontWeight: 500, color: t.text, marginTop: 6 }}>{sp.name}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Recent matches ── */}
        {mockMatches.length > 0 && (
          <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 24, marginBottom: 48 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textMuted }}>Recent</span>
              <span style={{ fontSize: '0.6875rem', color: t.blue, cursor: 'pointer' }}>History &rarr;</span>
            </div>
            {mockMatches.map((m, i) => (
              <div key={i}>
                {i > 0 && divider}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <SportIcon name={m.icon} size={16} color={t.textMuted} />
                    <span style={{ fontSize: '0.875rem', color: t.text }}>{m.teams}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontFamily: MONO, fontSize: '0.875rem', fontWeight: 700, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{m.score}</span>
                    {m.winner && <span style={{ fontSize: '0.6875rem', color: t.blue }}>{m.winner}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tournaments ── */}
        {(activeTournaments.length > 0 || doneTournaments.length > 0) && (
          <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textMuted }}>Tournaments</span>
              <span style={{ fontSize: '0.6875rem', color: t.blue, cursor: 'pointer' }}>View all &rarr;</span>
            </div>
            {mockTournaments.map((tr, i) => (
              <div key={i}>
                {i > 0 && divider}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: tr.active ? t.blueLight : t.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <SportIcon name={tr.icon} size={18} color={tr.active ? t.blue : t.green} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: t.text }}>{tr.name}</div>
                      <div style={{ fontSize: '0.75rem', color: t.textMuted, marginTop: 2 }}>{tr.teams} teams &middot; {tr.sport}</div>
                    </div>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 600, padding: '4px 10px', borderRadius: 10, background: tr.active ? t.blueLight : t.greenLight, color: tr.active ? t.blue : t.green }}>
                    {tr.active ? tr.progress : 'DONE'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

function StateBar({ isNew, setIsNew, hasActive, setHasActive }) {
  return (
    <div style={{ background: '#2a2a2a', padding: '8px 24px', display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontFamily: MONO, fontSize: '0.5rem', color: '#555', letterSpacing: '0.08em' }}>USER:</span>
      {['NEW USER', 'EXISTING'].map((lbl, i) => (
        <button key={lbl} onClick={() => setIsNew(i === 0)} style={{
          fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 600, padding: '5px 14px', border: 'none', cursor: 'pointer', borderRadius: 4,
          background: (i === 0 ? isNew : !isNew) ? t.blue : 'transparent', color: (i === 0 ? isNew : !isNew) ? '#fff' : '#888',
        }}>{lbl}</button>
      ))}
      {!isNew && (
        <>
          <span style={{ width: 1, height: 16, background: '#444' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={hasActive} onChange={e => setHasActive(e.target.checked)} style={{ accentColor: t.blue }} />
            <span style={{ fontFamily: MONO, fontSize: '0.5rem', color: hasActive ? t.blue : '#888', letterSpacing: '0.06em' }}>ACTIVE GAMES</span>
          </label>
        </>
      )}
    </div>
  );
}

/* ─── Shared helpers for new-user flow state ─── */
function useSportState() {
  const [selectedSport, setSelectedSport] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [tourneyTeams, setTourneyTeams] = useState(['', '', '']);
  const [tourneyName, setTourneyName] = useState('');

  const sportObj = selectedSport ? allSports.find(s => s.id === selectedSport) : null;
  const sportName = sportObj ? sportObj.name : '';
  const sportIcon = sportObj ? sportObj.icon : 'Volleyball';
  const isTourney = selectedMode === 'tournament';
  const filledTourneyTeams = tourneyTeams.filter(x => x.trim().length > 0).length;
  const teamsReady = isTourney
    ? tourneyName.trim().length > 0 && filledTourneyTeams >= 3
    : team1.trim().length > 0 && team2.trim().length > 0;
  const allReady = selectedSport && selectedMode && teamsReady;

  const resetTeams = () => { setTeam1(''); setTeam2(''); setTourneyTeams(['', '', '']); setTourneyName(''); };
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
  const removeTourneyTeam = (idx) => { if (tourneyTeams.length > 3) setTourneyTeams(tourneyTeams.filter((_, i) => i !== idx)); };
  const resetAll = () => { setSelectedSport(null); setSelectedMode(null); resetTeams(); };

  return {
    selectedSport, selectedMode, team1, setTeam1, team2, setTeam2,
    tourneyTeams, tourneyName, setTourneyName, sportName, sportIcon,
    isTourney, filledTourneyTeams, teamsReady, allReady,
    pickSport, pickMode, updateTourneyTeam, addTourneyTeam, removeTourneyTeam, resetAll,
  };
}

/* ─── Shared sub-components for team input and preview ─── */

function TournamentInput({ tourneyName, setTourneyName, tourneyTeams, filledTourneyTeams, updateTourneyTeam, removeTourneyTeam, addTourneyTeam, mobile }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.r, padding: 20, boxShadow: t.cardShadow }}>
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontFamily: MONO, fontSize: '0.5625rem', color: t.textMuted, letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>TOURNAMENT NAME</label>
        <input value={tourneyName} onChange={e => setTourneyName(e.target.value)} placeholder="e.g. Office Volleyball Cup"
          style={{ width: '100%', padding: '10px 12px', fontSize: '0.875rem', border: 'none', borderBottom: `2px solid ${tourneyName.trim() ? t.blue : t.border}`, background: 'transparent', outline: 'none', color: t.text, fontFamily: SWISS, transition: 'border-color 200ms ease', boxSizing: 'border-box' }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ fontFamily: MONO, fontSize: '0.5625rem', color: t.textMuted, letterSpacing: '0.06em' }}>TEAMS ({filledTourneyTeams}/{tourneyTeams.length})</label>
          <span style={{ fontFamily: MONO, fontSize: '0.5rem', color: filledTourneyTeams >= 3 ? t.green : t.textFaint, letterSpacing: '0.06em' }}>
            {filledTourneyTeams >= 3 ? 'MIN 3 MET' : `NEED ${3 - filledTourneyTeams} MORE`}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 8 }}>
          {tourneyTeams.map((tm, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: tm.trim() ? t.blue : t.textFaint, width: 18, textAlign: 'center', flexShrink: 0 }}>{idx + 1}</span>
              <input value={tm} onChange={e => updateTourneyTeam(idx, e.target.value)} placeholder={`Team ${idx + 1}`}
                style={{ flex: 1, padding: '8px 10px', fontSize: '0.8125rem', border: 'none', borderBottom: `1.5px solid ${tm.trim() ? t.blue : t.border}`, background: 'transparent', outline: 'none', color: t.text, fontFamily: SWISS, transition: 'border-color 200ms ease', boxSizing: 'border-box', minWidth: 0 }} />
              {tourneyTeams.length > 3 && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove team ${idx + 1}`}
                  onClick={() => removeTourneyTeam(idx)}
                  onKeyDown={activateOnKeyboard(() => removeTourneyTeam(idx))}
                  style={{ fontSize: '0.75rem', color: t.textFaint, cursor: 'pointer', padding: '4px 6px', lineHeight: 1 }}
                  title="Remove team"
                >
                  &times;
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      {tourneyTeams.length < 8 && (
        <div
          role="button"
          tabIndex={0}
          onClick={addTourneyTeam}
          onKeyDown={activateOnKeyboard(addTourneyTeam)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', border: `1px dashed ${t.border}`, borderRadius: t.r, cursor: 'pointer' }}
        >
          <span style={{ fontFamily: MONO, fontSize: '0.75rem', color: t.blue, fontWeight: 700 }}>+</span>
          <span style={{ fontFamily: MONO, fontSize: '0.625rem', color: t.textMuted, letterSpacing: '0.04em' }}>ADD TEAM ({tourneyTeams.length}/8)</span>
        </div>
      )}
      {tourneyTeams.length >= 8 && (
        <div style={{ fontFamily: MONO, fontSize: '0.5625rem', color: t.textMuted, textAlign: 'center', padding: '8px 0' }}>Maximum 8 teams reached</div>
      )}
    </div>
  );
}

function QuickMatchInput({ team1, setTeam1, team2, setTeam2, mobile }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.r, padding: 20, boxShadow: t.cardShadow }}>
      <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 12 : 16, alignItems: mobile ? 'stretch' : 'center' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontFamily: MONO, fontSize: '0.5625rem', color: t.textMuted, letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>PLAYER / TEAM 1</label>
          <input value={team1} onChange={e => setTeam1(e.target.value)} placeholder="e.g. Eagles"
            style={{ width: '100%', padding: '10px 12px', fontSize: '0.875rem', border: 'none', borderBottom: `2px solid ${team1 ? t.blue : t.border}`, background: 'transparent', outline: 'none', color: t.text, fontFamily: SWISS, transition: 'border-color 200ms ease', boxSizing: 'border-box' }} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: '0.625rem', color: t.textFaint, fontWeight: 600, padding: mobile ? '0' : '0 8px', alignSelf: mobile ? 'center' : 'flex-end', marginBottom: mobile ? 0 : 12 }}>VS</div>
        <div style={{ flex: 1 }}>
          <label style={{ fontFamily: MONO, fontSize: '0.5625rem', color: t.textMuted, letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>PLAYER / TEAM 2</label>
          <input value={team2} onChange={e => setTeam2(e.target.value)} placeholder="e.g. Hawks"
            style={{ width: '100%', padding: '10px 12px', fontSize: '0.875rem', border: 'none', borderBottom: `2px solid ${team2 ? t.blue : t.border}`, background: 'transparent', outline: 'none', color: t.text, fontFamily: SWISS, transition: 'border-color 200ms ease', boxSizing: 'border-box' }} />
        </div>
      </div>
    </div>
  );
}

function TournamentPreview({ sportIcon, sportName, tourneyName, tourneyTeams, mobile }) {
  const teams = tourneyTeams.filter(x => x.trim().length > 0);
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
      <div style={{ display: 'flex', gap: mobile ? 16 : 24, marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${t.border}` }}>
        {[{ v: teams.length, l: 'teams' }, { v: matchCount, l: 'matches' }, { v: 'Round Robin', l: 'format' }].map(s => (
          <div key={s.l}>
            <div style={{ fontFamily: MONO, fontSize: '1.125rem', fontWeight: 800, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
            <div style={{ fontFamily: MONO, fontSize: '0.5rem', color: t.textMuted, letterSpacing: '0.06em', marginTop: 2 }}>{s.l.toUpperCase()}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
        {teams.map((tm, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: t.bg, borderRadius: 4, border: `1px solid ${t.border}` }}>
            <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: t.blue }}>{i + 1}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tm}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: mobile ? 'stretch' : 'center', gap: mobile ? 12 : 0 }}>
        <span style={{ fontSize: '0.75rem', color: t.textMuted, textAlign: mobile ? 'center' : 'left' }}>Brackets and point table generated automatically.</span>
        <span style={{ fontFamily: MONO, fontSize: '0.8125rem', fontWeight: 700, padding: '10px 28px', background: t.blue, color: '#fff', borderRadius: t.r, cursor: 'pointer', letterSpacing: '0.04em', textAlign: 'center', flexShrink: 0 }}>Create tournament &rarr;</span>
      </div>
    </div>
  );
}

function QuickMatchPreview({ sportIcon, sportName, team1, team2, mobile }) {
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
      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 16, display: 'flex', flexDirection: mobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: mobile ? 'stretch' : 'center', gap: mobile ? 12 : 0 }}>
        <span style={{ fontSize: '0.75rem', color: t.textMuted, textAlign: mobile ? 'center' : 'left' }}>Score updates in real time.</span>
        <span style={{ fontFamily: MONO, fontSize: '0.8125rem', fontWeight: 700, padding: '10px 28px', background: t.blue, color: '#fff', borderRadius: t.r, cursor: 'pointer', letterSpacing: '0.04em', textAlign: 'center' }}>Start scoring &rarr;</span>
      </div>
    </div>
  );
}

function ModeCards({ selectedMode, pickMode, mobile }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 8 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => pickMode('tournament')}
        onKeyDown={activateOnKeyboard(() => pickMode('tournament'))}
        style={{
        background: selectedMode === 'tournament' ? t.text : t.surface,
        color: selectedMode === 'tournament' ? '#fff' : t.text,
        border: `1.5px solid ${selectedMode === 'tournament' ? t.text : t.border}`,
        borderRadius: t.r, padding: 20, cursor: 'pointer', transition: 'all 200ms ease', boxShadow: t.cardShadow,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: selectedMode === 'tournament' ? t.blue : t.blueLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 800, color: selectedMode === 'tournament' ? '#fff' : t.blue }}>T</span>
          </div>
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Tournament</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: selectedMode === 'tournament' ? '#aaa' : t.textMuted, margin: 0, lineHeight: 1.4 }}>3-8 teams. Round-robin or knockout brackets. Auto standings and point tables.</p>
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => pickMode('quick')}
        onKeyDown={activateOnKeyboard(() => pickMode('quick'))}
        style={{
        background: selectedMode === 'quick' ? t.text : t.surface,
        color: selectedMode === 'quick' ? '#fff' : t.text,
        border: `1.5px solid ${selectedMode === 'quick' ? t.text : t.border}`,
        borderRadius: t.r, padding: 20, cursor: 'pointer', transition: 'all 200ms ease', boxShadow: t.cardShadow,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: selectedMode === 'quick' ? t.orange : t.orangeLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 800, color: selectedMode === 'quick' ? '#fff' : t.orange }}>Q</span>
          </div>
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Quick Match</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: selectedMode === 'quick' ? '#aaa' : t.textMuted, margin: 0, lineHeight: 1.4 }}>2 teams, 1 game. Start scoring in under 10 seconds. No brackets needed.</p>
      </div>
    </div>
  );
}

function SportGrid({ selectedSport, pickSport, mobile, cols }) {
  const gridCols = cols || (mobile ? 3 : 4);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: mobile ? 8 : 6 }}>
      {allSports.map(s => (
        <div
          key={s.id}
          role="button"
          tabIndex={0}
          onClick={() => pickSport(s.id)}
          onKeyDown={activateOnKeyboard(() => pickSport(s.id))}
          style={{
          background: selectedSport === s.id ? t.text : t.surface,
          color: selectedSport === s.id ? '#fff' : t.text,
          border: `1.5px solid ${selectedSport === s.id ? t.text : t.border}`,
          borderRadius: t.r, padding: mobile ? '12px 6px' : '14px 8px', textAlign: 'center', cursor: 'pointer',
          transition: 'all 200ms ease', boxShadow: t.cardShadow,
        }}>
          <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'center' }}>
            <SportIcon name={s.icon} size={mobile ? 22 : 26} color={selectedSport === s.id ? t.blue : t.text} />
          </div>
          <div style={{ fontFamily: MONO, fontSize: mobile ? '0.375rem' : '0.4375rem', fontWeight: 600, letterSpacing: '0.04em' }}>{s.name.toUpperCase()}</div>
        </div>
      ))}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   SHOWCASE — V1 Clean Production only
   StateBar controls: NEW/EXISTING toggle, ACTIVE GAMES, dashboard variant tabs
   ═══════════════════════════════════════════════════════════════════ */
export default function DashboardShowcase() {
  const [isNew, setIsNew] = useState(true);
  const [hasActive, setHasActive] = useState(true);
  const [showExpanded, setShowExpanded] = useState(false);
  const mobile = useIsMobile();
  const st = useSportState();

  const StepHead = ({ num, title, sub, active, done, chip }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: done ? t.green : active ? t.blue : t.border,
        color: '#fff', fontFamily: MONO, fontSize: '0.875rem', fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 300ms ease',
      }}>
        {done ? '\u2713' : num}
      </div>
      <div>
        <div style={{ fontFamily: MONO, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', color: active || done ? t.text : t.textFaint, transition: 'color 300ms ease' }}>{title}</div>
        <div style={{ fontSize: '0.75rem', color: active ? t.textSoft : t.textFaint, transition: 'color 300ms ease' }}>{sub}</div>
      </div>
      {chip}
    </div>
  );

  return (
    <div style={{ fontFamily: SWISS, background: t.bg, color: t.text, minHeight: '100vh' }}>
      <StateBar isNew={isNew} setIsNew={setIsNew} hasActive={hasActive} setHasActive={setHasActive} />
      <Nav username="harsha" mobile={mobile} />

      {isNew ? (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: mobile ? '20px 16px' : '28px 24px' }}>
          {/* Progress bar */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
            {[1, 2, 3, 4].map(step => {
              const filled = step === 1 ? !!st.selectedSport : step === 2 ? !!st.selectedMode : step === 3 ? st.teamsReady : st.allReady;
              const current = step === 1 ? !st.selectedSport : step === 2 ? st.selectedSport && !st.selectedMode : step === 3 ? st.selectedMode && !st.teamsReady : st.teamsReady;
              return <div key={step} style={{ flex: 1, height: 3, borderRadius: 2, background: filled ? t.blue : current ? `${t.blue}40` : t.border, transition: 'background 400ms ease' }} />;
            })}
          </div>

          {/* STEP 1 */}
          <div style={{ marginBottom: 24 }}>
            <StepHead num="1" title="PICK A SPORT" sub={st.selectedSport ? `${st.sportName} selected` : 'What are you scoring today?'} active={!st.selectedSport} done={!!st.selectedSport}
              chip={st.selectedSport ? (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: t.blueLight, borderRadius: 20 }}>
                  <SportIcon name={st.sportIcon} size={16} color={t.blue} />
                  <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: t.blue }}>{st.sportName.toUpperCase()}</span>
                </div>
              ) : null} />
            {!st.selectedSport || showExpanded ? (
              <SportGrid selectedSport={st.selectedSport} pickSport={(id) => { st.pickSport(id); setShowExpanded(false); }} mobile={mobile} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowExpanded(true)}
                  onKeyDown={activateOnKeyboard(() => setShowExpanded(true))}
                  style={{ fontSize: '0.6875rem', color: t.blue, cursor: 'pointer' }}
                >
                  Change sport
                </span>
              </div>
            )}
          </div>

          {/* STEP 2 */}
          <div style={{ marginBottom: 24, opacity: st.selectedSport ? 1 : 0.25, pointerEvents: st.selectedSport ? 'auto' : 'none', transition: 'opacity 400ms ease' }}>
            <StepHead num="2" title="CHOOSE MODE"
              sub={st.selectedMode ? (st.isTourney ? 'Tournament mode' : 'Quick match mode') : st.selectedSport ? `How do you want to play ${st.sportName}?` : 'Select a sport first'}
              active={st.selectedSport && !st.selectedMode} done={!!st.selectedMode}
              chip={st.selectedMode ? (
                <div style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 20, background: st.isTourney ? t.blueLight : t.orangeLight }}>
                  <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, color: st.isTourney ? t.blue : t.orange }}>{st.selectedMode.toUpperCase()}</span>
                </div>
              ) : null} />
            <ModeCards selectedMode={st.selectedMode} pickMode={st.pickMode} mobile={mobile} />
          </div>

          {/* STEP 3 */}
          <div style={{ marginBottom: 24, opacity: st.selectedMode ? 1 : 0.25, pointerEvents: st.selectedMode ? 'auto' : 'none', transition: 'opacity 400ms ease' }}>
            <StepHead num="3" title={st.isTourney ? 'SET UP TOURNAMENT' : 'NAME THE PLAYERS'}
              sub={st.teamsReady ? (st.isTourney ? `${st.tourneyName} - ${st.filledTourneyTeams} teams` : `${st.team1} vs ${st.team2}`) : (st.isTourney ? 'Name your tournament and add teams' : 'Who is playing?')}
              active={st.selectedMode && !st.teamsReady} done={st.teamsReady} />
            {st.isTourney ? (
              <TournamentInput tourneyName={st.tourneyName} setTourneyName={st.setTourneyName} tourneyTeams={st.tourneyTeams} filledTourneyTeams={st.filledTourneyTeams} updateTourneyTeam={st.updateTourneyTeam} removeTourneyTeam={st.removeTourneyTeam} addTourneyTeam={st.addTourneyTeam} mobile={mobile} />
            ) : (
              <QuickMatchInput team1={st.team1} setTeam1={st.setTeam1} team2={st.team2} setTeam2={st.setTeam2} mobile={mobile} />
            )}
          </div>

          {/* STEP 4 */}
          <div style={{ opacity: st.teamsReady ? 1 : 0.25, pointerEvents: st.teamsReady ? 'auto' : 'none', transition: 'opacity 400ms ease' }}>
            <StepHead num="4" title="READY TO GO" sub={st.teamsReady ? (st.isTourney ? 'Tournament overview' : 'Your scorecard preview') : (st.isTourney ? 'Add teams first' : 'Name your teams first')} active={st.teamsReady} done={false} />
            {st.teamsReady && st.isTourney && <TournamentPreview sportIcon={st.sportIcon} sportName={st.sportName} tourneyName={st.tourneyName} tourneyTeams={st.tourneyTeams} mobile={mobile} />}
            {st.teamsReady && !st.isTourney && <QuickMatchPreview sportIcon={st.sportIcon} sportName={st.sportName} team1={st.team1} team2={st.team2} mobile={mobile} />}
          </div>

          {/* Reset */}
          {st.selectedSport && (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <span
                role="button"
                tabIndex={0}
                onClick={() => { st.resetAll(); setShowExpanded(false); }}
                onKeyDown={activateOnKeyboard(() => { st.resetAll(); setShowExpanded(false); })}
                style={{ fontSize: '0.6875rem', color: t.textMuted, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Start over
              </span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <ExistingUser hasActive={hasActive} />
        </div>
      )}
    </div>
  );
}

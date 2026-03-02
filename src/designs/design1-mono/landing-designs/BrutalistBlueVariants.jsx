/**
 * Brutalist Swiss — Blue Accent Variations
 * Same brutalist layout, 4 different approaches to using blue (#0066ff)
 * within the black/white framework.
 */
import { useState } from 'react';
import PropTypes from 'prop-types';

const sports = [
  { icon: '🏐', name: 'Volleyball' },
  { icon: '🏏', name: 'Cricket' },
  { icon: '🎾', name: 'Tennis' },
  { icon: '⚽', name: 'Football' },
  { icon: '🏀', name: 'Basketball' },
  { icon: '🏸', name: 'Badminton' },
  { icon: '🏑', name: 'Hockey' },
  { icon: '🏓', name: 'Table Tennis' },
  { icon: '⛳', name: 'Golf' },
  { icon: '🎱', name: 'Pool' },
  { icon: '♟️', name: 'Chess' },
  { icon: '🏈', name: 'Rugby' },
  { icon: '🥏', name: 'Frisbee' },
  { icon: '🤾', name: 'Handball' },
];

const features = [
  { title: 'Quick Match', desc: 'Start scoring any game in under 10 seconds. No signup required.', tag: 'CORE' },
  { title: 'Tournaments', desc: 'Round-robin and knockout brackets. Auto standings & point tables.', tag: 'ORGANIZE' },
  { title: 'Live Scoring', desc: 'Real-time score entry with set tracking, deuce rules, and timers.', tag: 'TRACK' },
  { title: 'Statistics', desc: 'Win rates, match history, player performance across all sports.', tag: 'ANALYZE' },
  { title: 'Team Management', desc: 'Create teams, invite players, manage rosters across tournaments.', tag: 'MANAGE' },
  { title: '14 Sports', desc: 'Volleyball, cricket, tennis, football, and 10 more with sport-specific rules.', tag: 'PLAY' },
];

/*
 * VARIANT DEFINITIONS
 * Each variant defines WHERE blue appears and how it's used.
 * Everything not specified defaults to black/white.
 */
export const BLUE_VARIANTS = {
  surgical: {
    name: 'Surgical Blue',
    desc: 'Blue only where you tap. Links, focus rings, active inputs. Everything else is pure black & white.',
    // Where blue shows up:
    navSignInColor: '#111',         // black sign-in button
    navSignInBorder: '#111',
    navSignInBg: 'transparent',
    heroCTABg: '#111',              // black primary CTA
    heroCTAColor: '#fff',
    heroCTABorder: '#111',
    linkColor: '#0066ff',           // blue links
    linkHoverColor: '#0052cc',
    featureHoverBg: '#111',         // black card hover
    featureHoverColor: '#fff',
    featureTagBorder: '#aaa',
    featureTagHoverBorder: '#fff',
    sportHoverBg: '#111',           // black sport hover
    sportHoverColor: '#fff',
    tickerBg: '#111',
    tickerColor: '#fff',
    ctaSectionBg: '#111',
    ctaSectionColor: '#fff',
    ctaBtnBg: '#fff',
    ctaBtnColor: '#111',
    ctaBtnOutlineBorder: '#fff',
    ctaBtnOutlineColor: '#fff',
    stepBorderColor: '#111',
    stepNumColor: '#ddd',
    mockupBorder: '#111',
    liveDotColor: '#dc2626',
    // Blue-specific signals
    inputFocusBorder: '#0066ff',
    scoreBtnHoverColor: '#0066ff',
    selectedBorder: '#111',         // no blue on selected cards
  },

  underline: {
    name: 'Blue Underline',
    desc: 'Blue appears as underlines and accent lines — never as fills. Thin blue stripes give rhythm to the black structure.',
    navSignInColor: '#111',
    navSignInBorder: '#111',
    navSignInBg: 'transparent',
    heroCTABg: '#111',
    heroCTAColor: '#fff',
    heroCTABorder: '#111',
    linkColor: '#0066ff',
    linkHoverColor: '#0052cc',
    featureHoverBg: '#111',
    featureHoverColor: '#fff',
    featureTagBorder: '#0066ff',    // blue tag borders
    featureTagHoverBorder: '#fff',
    sportHoverBg: '#111',
    sportHoverColor: '#fff',
    tickerBg: '#0066ff',            // blue ticker stripe
    tickerColor: '#fff',
    ctaSectionBg: '#111',
    ctaSectionColor: '#fff',
    ctaBtnBg: '#fff',
    ctaBtnColor: '#111',
    ctaBtnOutlineBorder: '#fff',
    ctaBtnOutlineColor: '#fff',
    stepBorderColor: '#0066ff',     // blue step borders
    stepNumColor: '#cce0ff',        // light blue step numbers
    mockupBorder: '#111',
    liveDotColor: '#0066ff',        // blue live dot
    inputFocusBorder: '#0066ff',
    scoreBtnHoverColor: '#0066ff',
    selectedBorder: '#0066ff',
  },

  signal: {
    name: 'Blue Signal',
    desc: 'Blue is the "action" color — the ONE primary CTA, the live badge, and the sign-in button. Maximum clarity on what to tap.',
    navSignInColor: '#fff',
    navSignInBorder: '#0066ff',
    navSignInBg: '#0066ff',         // blue sign-in button
    heroCTABg: '#0066ff',           // blue hero CTA
    heroCTAColor: '#fff',
    heroCTABorder: '#0066ff',
    linkColor: '#0066ff',
    linkHoverColor: '#0052cc',
    featureHoverBg: '#111',
    featureHoverColor: '#fff',
    featureTagBorder: '#aaa',
    featureTagHoverBorder: '#fff',
    sportHoverBg: '#111',
    sportHoverColor: '#fff',
    tickerBg: '#111',
    tickerColor: '#fff',
    ctaSectionBg: '#0066ff',        // blue CTA section
    ctaSectionColor: '#fff',
    ctaBtnBg: '#fff',
    ctaBtnColor: '#0066ff',
    ctaBtnOutlineBorder: '#fff',
    ctaBtnOutlineColor: '#fff',
    stepBorderColor: '#111',
    stepNumColor: '#ddd',
    mockupBorder: '#111',
    liveDotColor: '#0066ff',        // blue live indicator
    inputFocusBorder: '#0066ff',
    scoreBtnHoverColor: '#0066ff',
    selectedBorder: '#0066ff',
  },

  duotone: {
    name: 'Blue Duotone',
    desc: 'Black is structure, blue is data. Score numbers, stats, tags — anything numeric or data-driven gets blue. Text stays black.',
    navSignInColor: '#111',
    navSignInBorder: '#111',
    navSignInBg: 'transparent',
    heroCTABg: '#111',
    heroCTAColor: '#fff',
    heroCTABorder: '#111',
    linkColor: '#0066ff',
    linkHoverColor: '#0052cc',
    featureHoverBg: '#111',
    featureHoverColor: '#fff',
    featureTagBorder: '#0066ff',    // blue tags (they're metadata)
    featureTagHoverBorder: '#fff',
    featureTagColor: '#0066ff',     // blue tag text
    sportHoverBg: '#0066ff',        // blue sport hover (data = blue)
    sportHoverColor: '#fff',
    tickerBg: '#111',
    tickerColor: '#fff',
    ctaSectionBg: '#111',
    ctaSectionColor: '#fff',
    ctaBtnBg: '#0066ff',            // blue in CTA (action = blue)
    ctaBtnColor: '#fff',
    ctaBtnOutlineBorder: '#fff',
    ctaBtnOutlineColor: '#fff',
    stepBorderColor: '#111',
    stepNumColor: '#0066ff',        // blue step numbers (data = blue)
    mockupBorder: '#111',
    mockupScoreColor: '#0066ff',    // blue scores in mockup
    liveDotColor: '#0066ff',
    inputFocusBorder: '#0066ff',
    scoreBtnHoverColor: '#0066ff',
    selectedBorder: '#0066ff',
  },
};

export default function BrutalistBlueVariant({ variant = 'surgical' }) {
  const v = BLUE_VARIANTS[variant] || BLUE_VARIANTS.surgical;
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [hoveredSport, setHoveredSport] = useState(null);

  const mono = "'JetBrains Mono', monospace";
  const swiss = "'Inter', system-ui, sans-serif";
  const blue = '#0066ff';

  return (
    <div style={{ fontFamily: swiss, background: '#fafafa', color: '#111', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ═══ NAV ═══ */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fafafa', borderBottom: '2px solid #111' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: mono, fontWeight: 800, fontSize: '0.875rem', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            SCORE<br/>EASY
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="#features" style={{ fontFamily: mono, fontSize: '0.75rem', color: '#666', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Features</a>
            <a href="#sports" style={{ fontFamily: mono, fontSize: '0.75rem', color: '#666', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sports</a>
            <a href="#how" style={{ fontFamily: mono, fontSize: '0.75rem', color: '#666', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.08em' }}>How</a>
            <a href="/login" style={{
              fontFamily: mono, fontSize: '0.75rem', fontWeight: 700,
              color: v.navSignInColor, textDecoration: 'none',
              padding: '8px 16px',
              border: `2px solid ${v.navSignInBorder}`,
              background: v.navSignInBg,
            }}>
              Sign in →
            </a>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section style={{ padding: '80px 32px 60px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            <p style={{ fontFamily: mono, fontSize: '0.6875rem', letterSpacing: '0.15em', color: '#888', marginBottom: 16 }}>
              UNIVERSAL SCORE TRACKER
            </p>
            <h1 style={{ fontWeight: 900, fontSize: 'clamp(3rem, 7vw, 5.5rem)', lineHeight: 0.9, letterSpacing: '-0.04em', margin: '0 0 24px 0' }}>
              SCORE<br/>ANY<br/>GAME.
            </h1>
            <p style={{ fontSize: '1.0625rem', lineHeight: 1.6, color: '#555', marginBottom: 32 }}>
              Tournaments. Quick matches. Live scoring.<br/>
              14 sports. Zero friction. Free forever.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <a href="/play" style={{
                fontFamily: mono, fontSize: '0.8125rem', fontWeight: 700,
                padding: '14px 28px', letterSpacing: '0.05em', textDecoration: 'none',
                background: v.heroCTABg, color: v.heroCTAColor, border: `2px solid ${v.heroCTABorder}`,
              }}>
                START SCORING
              </a>
              <a href="/signup" style={{
                fontFamily: mono, fontSize: '0.8125rem', fontWeight: 700,
                padding: '14px 28px', letterSpacing: '0.05em', textDecoration: 'none',
                background: 'transparent', color: '#111', border: '2px solid #111',
              }}>
                CREATE ACCOUNT
              </a>
            </div>
          </div>

          {/* MOCKUP */}
          <div>
            <div style={{ border: `2px solid ${v.mockupBorder}`, padding: 24, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontFamily: mono, fontSize: '0.6875rem', color: v.liveDotColor, fontWeight: 700 }}>● LIVE</span>
                <span style={{ fontFamily: mono, fontSize: '0.6875rem', color: '#888', letterSpacing: '0.1em' }}>VOLLEYBALL</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontFamily: mono, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em' }}>EAGLES</span>
                  <span style={{ fontFamily: mono, fontSize: '3rem', fontWeight: 800, lineHeight: 1, color: v.mockupScoreColor || '#111' }}>25</span>
                </div>
                <div style={{ fontFamily: mono, fontSize: '0.75rem', color: '#aaa' }}>VS</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontFamily: mono, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em' }}>HAWKS</span>
                  <span style={{ fontFamily: mono, fontSize: '3rem', fontWeight: 800, lineHeight: 1, color: v.mockupScoreColor || '#111' }}>23</span>
                </div>
              </div>
              <div style={{ fontFamily: mono, fontSize: '0.6875rem', color: '#888', textAlign: 'center', letterSpacing: '0.1em', paddingTop: 12, borderTop: '1px solid #eee' }}>
                SET 3 OF 5 — DEUCE
              </div>
            </div>
            <div style={{ border: '2px solid #ddd', padding: 24, background: '#fff', marginTop: 12, opacity: 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontFamily: mono, fontSize: '0.6875rem', color: '#888', fontWeight: 700 }}>● FINAL</span>
                <span style={{ fontFamily: mono, fontSize: '0.6875rem', color: '#888', letterSpacing: '0.1em' }}>CRICKET</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.5rem' }}>
                <span style={{ fontFamily: mono, fontWeight: 700, color: v.mockupScoreColor || '#111' }}>187/6</span>
                <span style={{ color: '#888', fontSize: '0.75rem' }}>vs</span>
                <span style={{ fontFamily: mono, fontWeight: 700, color: v.mockupScoreColor || '#111' }}>184/9</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TICKER ═══ */}
      <div style={{ background: v.tickerBg, color: v.tickerColor, padding: '14px 0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 40, whiteSpace: 'nowrap', justifyContent: 'center' }}>
          {['14 SPORTS', 'TOURNAMENTS', 'QUICK MATCHES', 'LIVE SCORING', 'STATISTICS', 'FREE FOREVER'].map((t, i) => (
            <span key={i} style={{ fontFamily: mono, fontSize: '0.75rem', letterSpacing: '0.12em', fontWeight: 600 }}>
              {t}<span style={{ margin: '0 20px', opacity: 0.3 }}>◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* ═══ FEATURES ═══ */}
      <section id="features" style={{ padding: '80px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
          <p style={{ fontFamily: mono, fontSize: '0.6875rem', letterSpacing: '0.12em', color: '#aaa', marginBottom: 12 }}>01 / FEATURES</p>
          <h2 style={{ fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 0.95, letterSpacing: '-0.03em', margin: '0 0 40px 0' }}>
            EVERYTHING<br/>YOU NEED.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            {features.map((f, i) => {
              const isHovered = hoveredFeature === i;
              return (
                <div
                  key={i}
                  style={{
                    border: `2px solid ${isHovered ? v.featureHoverBg : '#ddd'}`,
                    padding: 28, cursor: 'default', transition: 'all 200ms ease',
                    background: isHovered ? v.featureHoverBg : 'transparent',
                    color: isHovered ? v.featureHoverColor : '#111',
                  }}
                  onMouseEnter={() => setHoveredFeature(i)}
                  onMouseLeave={() => setHoveredFeature(null)}
                >
                  <span style={{
                    fontFamily: mono, fontSize: '0.625rem', letterSpacing: '0.12em',
                    padding: '4px 10px', display: 'inline-block', marginBottom: 16,
                    border: `1px solid ${isHovered ? v.featureTagHoverBorder : v.featureTagBorder}`,
                    color: isHovered ? (v.featureHoverColor) : (v.featureTagColor || '#888'),
                  }}>{f.tag}</span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.01em' }}>{f.title}</h3>
                  <p style={{ fontSize: '0.875rem', lineHeight: 1.5, margin: 0, color: isHovered ? '#ccc' : '#666' }}>{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ SPORTS ═══ */}
      <section id="sports" style={{ padding: '80px 0', background: '#fff', borderTop: '2px solid #111', borderBottom: '2px solid #111' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
          <p style={{ fontFamily: mono, fontSize: '0.6875rem', letterSpacing: '0.12em', color: '#aaa', marginBottom: 12 }}>02 / SPORTS</p>
          <h2 style={{ fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 0.95, letterSpacing: '-0.03em', margin: '0 0 40px 0' }}>
            14 SPORTS.<br/>ONE APP.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {sports.map((sp, i) => {
              const isHovered = hoveredSport === i;
              return (
                <div
                  key={i}
                  style={{
                    border: '2px solid #111', padding: '20px 12px', textAlign: 'center',
                    cursor: 'default', transition: 'all 150ms ease',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    background: isHovered ? v.sportHoverBg : '#fff',
                    color: isHovered ? v.sportHoverColor : '#111',
                  }}
                  onMouseEnter={() => setHoveredSport(i)}
                  onMouseLeave={() => setHoveredSport(null)}
                >
                  <span style={{ fontSize: '2rem' }}>{sp.icon}</span>
                  <span style={{ fontFamily: mono, fontSize: '0.625rem', letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>{sp.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how" style={{ padding: '80px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
          <p style={{ fontFamily: mono, fontSize: '0.6875rem', letterSpacing: '0.12em', color: '#aaa', marginBottom: 12 }}>03 / PROCESS</p>
          <h2 style={{ fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 0.95, letterSpacing: '-0.03em', margin: '0 0 40px 0' }}>
            THREE STEPS.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
            {[
              { num: '01', title: 'PICK SPORT', desc: 'Choose from 14 sports. Tournament or quick match.' },
              { num: '02', title: 'ADD TEAMS', desc: 'Name your match. Add 2–8 teams. Set the format.' },
              { num: '03', title: 'SCORE LIVE', desc: 'Tap to score. Auto standings. Instant results.' },
            ].map((step, i) => (
              <div key={i} style={{ borderLeft: `2px solid ${v.stepBorderColor}`, padding: '0 28px' }}>
                <span style={{ fontFamily: mono, fontSize: '3rem', fontWeight: 800, color: v.stepNumColor, lineHeight: 1, display: 'block', marginBottom: 12 }}>{step.num}</span>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '0.02em', margin: '0 0 8px 0', textTransform: 'uppercase' }}>{step.title}</h3>
                <p style={{ fontSize: '0.875rem', color: '#666', lineHeight: 1.5, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section style={{ background: v.ctaSectionBg, color: v.ctaSectionColor, padding: '80px 0', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 32px' }}>
          <h2 style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em', margin: '0 0 16px 0' }}>READY?</h2>
          <p style={{ fontSize: '1rem', color: v.ctaSectionBg === '#111' ? '#888' : 'rgba(255,255,255,0.7)', marginBottom: 32 }}>No account needed. Start scoring right now.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <a href="/play" style={{
              fontFamily: mono, fontSize: '0.8125rem', fontWeight: 700,
              padding: '14px 28px', textDecoration: 'none', letterSpacing: '0.05em',
              background: v.ctaBtnBg, color: v.ctaBtnColor,
            }}>
              START SCORING →
            </a>
            <a href="/signup" style={{
              fontFamily: mono, fontSize: '0.8125rem', fontWeight: 700,
              padding: '14px 28px', textDecoration: 'none', letterSpacing: '0.05em',
              background: 'transparent', color: v.ctaBtnOutlineColor,
              border: `2px solid ${v.ctaBtnOutlineBorder}`,
            }}>
              SIGN UP FREE
            </a>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee' }}>
        <span style={{ fontFamily: mono, fontSize: '0.6875rem', color: '#aaa', letterSpacing: '0.08em' }}>SCORE EASY © 2025</span>
        <span style={{ fontFamily: mono, fontSize: '0.6875rem', color: '#aaa' }}>scoreeasy.app</span>
      </footer>
    </div>
  );
}

BrutalistBlueVariant.propTypes = {
  variant: PropTypes.oneOf(Object.keys(BLUE_VARIANTS)),
};

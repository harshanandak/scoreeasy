/**
 * Design A: "BRUTALIST SWISS"
 * Raw, typographic, grid-heavy. Exposed structure.
 * Massive type, hard edges, monospaced accents, no padding guilt.
 * Accepts a `theme` prop to render in different color schemes.
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

// ─── COLOR THEMES ─────────────────────────────────────────
export const THEMES = {
  black: {
    name: 'Jet Black',
    desc: 'The original. Pure black on white. Maximum contrast.',
    primary: '#111111',
    primaryHover: '#000000',
    bg: '#fafafa',
    surface: '#ffffff',
    text: '#111111',
    textSecondary: '#555555',
    textMuted: '#888888',
    textFaint: '#aaaaaa',
    border: '#111111',
    borderLight: '#dddddd',
    borderFaint: '#eeeeee',
    live: '#dc2626',
    ctaBg: '#111111',
    ctaText: '#ffffff',
    tickerBg: '#111111',
    tickerText: '#ffffff',
  },
  blue: {
    name: 'Electric Blue',
    desc: 'Your current Mono blue. Familiar, confident, digital.',
    primary: '#0066ff',
    primaryHover: '#0052cc',
    bg: '#fafafa',
    surface: '#ffffff',
    text: '#111111',
    textSecondary: '#555555',
    textMuted: '#888888',
    textFaint: '#aaaaaa',
    border: '#0066ff',
    borderLight: '#cce0ff',
    borderFaint: '#e8f0fe',
    live: '#dc2626',
    ctaBg: '#0066ff',
    ctaText: '#ffffff',
    tickerBg: '#0066ff',
    tickerText: '#ffffff',
  },
  forest: {
    name: 'Forest Green',
    desc: 'Earthy, grounded, sporty. Think turf and fields.',
    primary: '#15803d',
    primaryHover: '#166534',
    bg: '#f8faf8',
    surface: '#ffffff',
    text: '#14291e',
    textSecondary: '#4a6352',
    textMuted: '#6b8a76',
    textFaint: '#9cb3a5',
    border: '#15803d',
    borderLight: '#bbdfc8',
    borderFaint: '#e6f4ea',
    live: '#dc2626',
    ctaBg: '#15803d',
    ctaText: '#ffffff',
    tickerBg: '#15803d',
    tickerText: '#ffffff',
  },
  tomato: {
    name: 'Tomato Red',
    desc: 'Bold, energetic, competitive. The color of scoreboard LEDs.',
    primary: '#dc2626',
    primaryHover: '#b91c1c',
    bg: '#fefaf9',
    surface: '#ffffff',
    text: '#1c1111',
    textSecondary: '#5c3a3a',
    textMuted: '#8a6666',
    textFaint: '#b39999',
    border: '#dc2626',
    borderLight: '#f5c6c6',
    borderFaint: '#fdeaea',
    live: '#dc2626',
    ctaBg: '#dc2626',
    ctaText: '#ffffff',
    tickerBg: '#dc2626',
    tickerText: '#ffffff',
  },
  purple: {
    name: 'Deep Purple',
    desc: 'Premium, modern, distinctive. Stands out from every sports app.',
    primary: '#7c3aed',
    primaryHover: '#6d28d9',
    bg: '#faf8ff',
    surface: '#ffffff',
    text: '#1a1128',
    textSecondary: '#4a3d5e',
    textMuted: '#7a6b94',
    textFaint: '#a99bc0',
    border: '#7c3aed',
    borderLight: '#d4bbff',
    borderFaint: '#ede5ff',
    live: '#dc2626',
    ctaBg: '#7c3aed',
    ctaText: '#ffffff',
    tickerBg: '#7c3aed',
    tickerText: '#ffffff',
  },
  midnight: {
    name: 'Midnight Inverse',
    desc: 'Dark mode brutalist. White type on near-black. High drama.',
    primary: '#e4e4e7',
    primaryHover: '#ffffff',
    bg: '#0c0c0f',
    surface: '#18181b',
    text: '#e4e4e7',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    textFaint: '#52525b',
    border: '#e4e4e7',
    borderLight: '#3f3f46',
    borderFaint: '#27272a',
    live: '#ef4444',
    ctaBg: '#e4e4e7',
    ctaText: '#0c0c0f',
    tickerBg: '#e4e4e7',
    tickerText: '#0c0c0f',
  },
};

export default function LandingDesignA({ theme: themeKey = 'black' }) {
  const t = THEMES[themeKey] || THEMES.black;
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [hoveredSport, setHoveredSport] = useState(null);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: t.bg, color: t.text, minHeight: '100vh', overflowX: 'hidden' }}>
      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: t.bg, borderBottom: `2px solid ${t.border}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: '0.875rem', lineHeight: 1.1, letterSpacing: '-0.02em', color: t.text }}>
            SCORE<br/>EASY
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="#features" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: t.textMuted, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Features</a>
            <a href="#sports" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: t.textMuted, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sports</a>
            <a href="#how" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: t.textMuted, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.08em' }}>How</a>
            <a href="/login" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: t.text, textDecoration: 'none', fontWeight: 700, padding: '8px 16px', border: `2px solid ${t.border}` }}>
              Sign in →
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: '80px 32px 60px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', letterSpacing: '0.15em', color: t.textMuted, marginBottom: 16 }}>
              UNIVERSAL SCORE TRACKER
            </p>
            <h1 style={{ fontWeight: 900, fontSize: 'clamp(3rem, 7vw, 5.5rem)', lineHeight: 0.9, letterSpacing: '-0.04em', margin: '0 0 24px 0', color: t.text }}>
              SCORE<br/>ANY<br/>GAME.
            </h1>
            <p style={{ fontSize: '1.0625rem', lineHeight: 1.6, color: t.textSecondary, marginBottom: 32 }}>
              Tournaments. Quick matches. Live scoring.<br/>
              14 sports. Zero friction. Free forever.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <a href="/play" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem', fontWeight: 700, padding: '14px 28px', background: t.primary, color: t.ctaText, textDecoration: 'none', letterSpacing: '0.05em', border: `2px solid ${t.primary}` }}>
                START SCORING
              </a>
              <a href="/signup" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem', fontWeight: 700, padding: '14px 28px', background: 'transparent', color: t.text, textDecoration: 'none', letterSpacing: '0.05em', border: `2px solid ${t.border}` }}>
                CREATE ACCOUNT
              </a>
            </div>
          </div>
          <div>
            {/* Live scoreboard mockup */}
            <div style={{ border: `2px solid ${t.border}`, padding: 24, background: t.surface }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: t.live, fontWeight: 700 }}>● LIVE</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: t.textMuted, letterSpacing: '0.1em' }}>VOLLEYBALL</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', color: t.text }}>EAGLES</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '3rem', fontWeight: 800, lineHeight: 1, color: t.text }}>25</span>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: t.textFaint }}>VS</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', color: t.text }}>HAWKS</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '3rem', fontWeight: 800, lineHeight: 1, color: t.text }}>23</span>
                </div>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: t.textMuted, textAlign: 'center', letterSpacing: '0.1em', paddingTop: 12, borderTop: `1px solid ${t.borderFaint}` }}>
                SET 3 OF 5 — DEUCE
              </div>
            </div>

            <div style={{ border: `2px solid ${t.borderLight}`, padding: 24, background: t.surface, marginTop: 12, opacity: 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: t.textMuted, fontWeight: 700 }}>● FINAL</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: t.textMuted, letterSpacing: '0.1em' }}>CRICKET</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.5rem' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: t.text }}>187/6</span>
                <span style={{ color: t.textMuted, fontSize: '0.75rem' }}>vs</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: t.text }}>184/9</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS TICKER */}
      <div style={{ background: t.tickerBg, color: t.tickerText, padding: '14px 0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 40, whiteSpace: 'nowrap', justifyContent: 'center' }}>
          {['14 SPORTS', 'TOURNAMENTS', 'QUICK MATCHES', 'LIVE SCORING', 'STATISTICS', 'FREE FOREVER'].map((txt, i) => (
            <span key={i} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', letterSpacing: '0.12em', fontWeight: 600 }}>
              {txt}<span style={{ margin: '0 20px', opacity: 0.3 }}>◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" style={{ padding: '80px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', letterSpacing: '0.12em', color: t.textFaint, marginBottom: 12 }}>01 / FEATURES</p>
          <h2 style={{ fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 0.95, letterSpacing: '-0.03em', margin: '0 0 40px 0', color: t.text }}>
            EVERYTHING<br/>YOU NEED.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            {features.map((f, i) => (
              <div
                key={i}
                style={{
                  border: `2px solid ${hoveredFeature === i ? t.primary : t.borderLight}`,
                  padding: 28,
                  cursor: 'default',
                  transition: 'all 200ms ease',
                  background: hoveredFeature === i ? t.primary : 'transparent',
                  color: hoveredFeature === i ? t.ctaText : t.text,
                }}
                onMouseEnter={() => setHoveredFeature(i)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.625rem',
                  letterSpacing: '0.12em',
                  padding: '4px 10px',
                  border: `1px solid ${hoveredFeature === i ? t.ctaText : t.textFaint}`,
                  display: 'inline-block',
                  marginBottom: 16,
                  color: hoveredFeature === i ? t.ctaText : t.textMuted,
                }}>{f.tag}</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.01em' }}>{f.title}</h3>
                <p style={{ fontSize: '0.875rem', lineHeight: 1.5, margin: 0, color: hoveredFeature === i ? (themeKey === 'midnight' ? t.textMuted : '#ccc') : t.textSecondary }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SPORTS GRID */}
      <section id="sports" style={{ padding: '80px 0', background: t.surface, borderTop: `2px solid ${t.border}`, borderBottom: `2px solid ${t.border}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', letterSpacing: '0.12em', color: t.textFaint, marginBottom: 12 }}>02 / SPORTS</p>
          <h2 style={{ fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 0.95, letterSpacing: '-0.03em', margin: '0 0 40px 0', color: t.text }}>
            14 SPORTS.<br/>ONE APP.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {sports.map((sp, i) => (
              <div
                key={i}
                style={{
                  border: `2px solid ${t.border}`,
                  padding: '20px 12px',
                  textAlign: 'center',
                  cursor: 'default',
                  transition: 'all 150ms ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  background: hoveredSport === i ? t.primary : t.surface,
                  color: hoveredSport === i ? t.ctaText : t.text,
                }}
                onMouseEnter={() => setHoveredSport(i)}
                onMouseLeave={() => setHoveredSport(null)}
              >
                <span style={{ fontSize: '2rem' }}>{sp.icon}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.625rem', letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>{sp.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ padding: '80px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', letterSpacing: '0.12em', color: t.textFaint, marginBottom: 12 }}>03 / PROCESS</p>
          <h2 style={{ fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 0.95, letterSpacing: '-0.03em', margin: '0 0 40px 0', color: t.text }}>
            THREE STEPS.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
            {[
              { num: '01', title: 'PICK SPORT', desc: 'Choose from 14 sports. Tournament or quick match.' },
              { num: '02', title: 'ADD TEAMS', desc: 'Name your match. Add 2–8 teams. Set the format.' },
              { num: '03', title: 'SCORE LIVE', desc: 'Tap to score. Auto standings. Instant results.' },
            ].map((step, i) => (
              <div key={i} style={{ borderLeft: `2px solid ${t.border}`, padding: '0 28px' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '3rem', fontWeight: 800, color: t.borderLight, lineHeight: 1, display: 'block', marginBottom: 12 }}>{step.num}</span>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '0.02em', margin: '0 0 8px 0', textTransform: 'uppercase', color: t.text }}>{step.title}</h3>
                <p style={{ fontSize: '0.875rem', color: t.textSecondary, lineHeight: 1.5, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: t.ctaBg, color: t.ctaText, padding: '80px 0', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 32px' }}>
          <h2 style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em', margin: '0 0 16px 0' }}>READY?</h2>
          <p style={{ fontSize: '1rem', color: themeKey === 'midnight' ? t.textMuted : '#888', marginBottom: 32 }}>No account needed. Start scoring right now.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <a href="/play" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem', fontWeight: 700, padding: '14px 28px', background: t.bg, color: t.text, textDecoration: 'none', letterSpacing: '0.05em' }}>
              START SCORING →
            </a>
            <a href="/signup" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem', fontWeight: 700, padding: '14px 28px', background: 'transparent', color: t.ctaText, textDecoration: 'none', letterSpacing: '0.05em', border: `2px solid ${t.ctaText}` }}>
              SIGN UP FREE
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${t.borderFaint}` }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: t.textFaint, letterSpacing: '0.08em' }}>SCORE EASY © 2025</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: t.textFaint }}>scoreeasy.app</span>
      </footer>
    </div>
  );
}

LandingDesignA.propTypes = {
  theme: PropTypes.oneOf(Object.keys(THEMES)),
};

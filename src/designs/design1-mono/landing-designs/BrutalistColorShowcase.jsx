/**
 * Brutalist Swiss — Color Comparison Showcase
 * View the same Brutalist Swiss design in 6 different color palettes.
 * Accessible at /showcase/brutalist-colors
 */
import { useState, useRef, lazy, Suspense } from 'react';

const LandingDesignA = lazy(() => import('./LandingDesignA').then(mod => ({ default: mod.default })));

// Import THEMES statically for the palette display
const themes = [
  {
    key: 'black',
    name: 'Jet Black',
    desc: 'The original. Pure black on white. Maximum contrast, zero distraction.',
    primary: '#111111',
    bg: '#fafafa',
    surface: '#ffffff',
  },
  {
    key: 'blue',
    name: 'Electric Blue',
    desc: 'Your current Mono accent. Familiar, digital, confident.',
    primary: '#0066ff',
    bg: '#fafafa',
    surface: '#ffffff',
  },
  {
    key: 'forest',
    name: 'Forest Green',
    desc: 'Earthy, grounded, sporty. Think turf and grass fields.',
    primary: '#15803d',
    bg: '#f8faf8',
    surface: '#ffffff',
  },
  {
    key: 'tomato',
    name: 'Tomato Red',
    desc: 'Bold, energetic, competitive. Scoreboard LED vibes.',
    primary: '#dc2626',
    bg: '#fefaf9',
    surface: '#ffffff',
  },
  {
    key: 'purple',
    name: 'Deep Purple',
    desc: 'Premium, modern, distinctive. Unlike any other sports app.',
    primary: '#7c3aed',
    bg: '#faf8ff',
    surface: '#ffffff',
  },
  {
    key: 'midnight',
    name: 'Midnight Inverse',
    desc: 'Dark mode brutalist. White on black. Maximum drama.',
    primary: '#e4e4e7',
    bg: '#0c0c0f',
    surface: '#18181b',
  },
];

export default function BrutalistColorShowcase() {
  const [activeTheme, setActiveTheme] = useState('black');
  const [viewMode, setViewMode] = useState('gallery');
  const previewRef = useRef(null);

  const scrollToPreview = () => {
    setTimeout(() => {
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const selectTheme = (key) => {
    setActiveTheme(key);
    scrollToPreview();
  };

  if (viewMode === 'fullscreen') {
    const theme = themes.find(t => t.key === activeTheme);
    return (
      <div style={{ minHeight: '100vh' }}>
        <div style={styles.floatingBar}>
          <div style={styles.floatingInner}>
            <span style={styles.floatingLabel}>
              Brutalist Swiss — {theme.name}
            </span>
            <div style={styles.floatingBtns}>
              {themes.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTheme(t.key)}
                  style={{
                    ...styles.floatingColorBtn,
                    background: t.primary,
                    outline: activeTheme === t.key ? '2px solid #fff' : 'none',
                    outlineOffset: 2,
                  }}
                  title={t.name}
                />
              ))}
              <button onClick={() => setViewMode('gallery')} style={styles.floatingBtnExit}>
                ✕ Exit
              </button>
            </div>
          </div>
        </div>
        <div style={{ paddingTop: 0 }}>
          <Suspense fallback={<LoadingState />}>
            <LandingDesignA theme={activeTheme} />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <a href="/showcase/landing-designs" style={styles.backLink}>← Back to all designs</a>
          <h1 style={styles.headerTitle}>Brutalist Swiss — Color Palettes</h1>
          <p style={styles.headerSub}>
            Same brutalist layout, 6 different color personalities. Pick the one that feels right.
          </p>
        </div>
      </header>

      {/* COLOR PICKER CARDS */}
      <section style={styles.pickerSection}>
        <div style={styles.pickerGrid}>
          {themes.map(t => {
            const isActive = activeTheme === t.key;
            const isDark = t.key === 'midnight';
            return (
              <button
                key={t.key}
                onClick={() => selectTheme(t.key)}
                style={{
                  ...styles.pickerCard,
                  borderColor: isActive ? t.primary : '#e5e5e5',
                  boxShadow: isActive ? `0 0 0 2px ${t.primary}30, 0 8px 24px rgba(0,0,0,0.08)` : '0 2px 8px rgba(0,0,0,0.03)',
                }}
              >
                {/* Color swatch bar */}
                <div style={{ display: 'flex', gap: 0, height: 48, marginBottom: 14, border: `1px solid ${isActive ? t.primary : '#eee'}` }}>
                  <div style={{ flex: 2, background: t.primary }}></div>
                  <div style={{ flex: 3, background: t.bg }}></div>
                  <div style={{ flex: 1, background: isDark ? '#e4e4e7' : t.primary, opacity: 0.5 }}></div>
                </div>
                <h3 style={styles.pickerName}>{t.name}</h3>
                <p style={styles.pickerDesc}>{t.desc}</p>
                {/* Hex values */}
                <div style={styles.hexRow}>
                  <span style={{ ...styles.hexChip, background: t.primary, color: isDark ? '#111' : '#fff' }}>
                    {t.primary}
                  </span>
                  <span style={{ ...styles.hexChip, background: t.bg, color: isDark ? '#e4e4e7' : '#555', border: `1px solid ${isDark ? '#333' : '#eee'}` }}>
                    {t.bg}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* PREVIEW */}
      {activeTheme && (
        <section ref={previewRef} style={styles.previewSection}>
          <div style={styles.previewHeader}>
            <div>
              <h2 style={styles.previewTitle}>
                {themes.find(t => t.key === activeTheme).name}
              </h2>
              <p style={styles.previewSub}>
                {themes.find(t => t.key === activeTheme).desc}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {/* Quick switch buttons */}
              {themes.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTheme(t.key)}
                  style={{
                    width: 28,
                    height: 28,
                    background: t.primary,
                    border: activeTheme === t.key ? '2px solid #111' : '2px solid #ddd',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  title={t.name}
                />
              ))}
              <button onClick={() => setViewMode('fullscreen')} style={styles.fullscreenBtn}>
                Fullscreen →
              </button>
            </div>
          </div>
          <div style={styles.previewFrame}>
            <div style={styles.browserBar}>
              <div style={styles.browserDots}>
                <span style={{ ...styles.browserDot, background: '#ff5f57' }}></span>
                <span style={{ ...styles.browserDot, background: '#febc2e' }}></span>
                <span style={{ ...styles.browserDot, background: '#28c840' }}></span>
              </div>
              <span style={styles.browserUrl}>scoreeasy.app</span>
              <div></div>
            </div>
            <div style={styles.browserContent}>
              <Suspense fallback={<LoadingState />}>
                <LandingDesignA theme={activeTheme} />
              </Suspense>
            </div>
          </div>
        </section>
      )}

      {/* SIDE-BY-SIDE SWATCHES */}
      <section style={styles.compSection}>
        <h3 style={styles.compTitle}>Full Palette Comparison</h3>
        <div style={styles.compGrid}>
          {themes.map(t => {
            const isDark = t.key === 'midnight';
            return (
              <div key={t.key} style={styles.compCard}>
                <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: 10 }}>{t.name}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 20, background: t.primary, border: '1px solid #eee' }}></div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: '#888' }}>Primary {t.primary}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 20, background: t.bg, border: '1px solid #eee' }}></div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: '#888' }}>Background {t.bg}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 20, background: t.surface, border: '1px solid #eee' }}></div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6875rem', color: '#888' }}>Surface {t.surface}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ padding: 60, textAlign: 'center', color: '#999', fontSize: '0.875rem' }}>
      Loading design...
    </div>
  );
}

const styles = {
  root: {
    fontFamily: "'Inter', system-ui, sans-serif",
    background: '#fafafa',
    color: '#111',
    minHeight: '100vh',
  },

  // HEADER
  header: {
    background: '#fff',
    borderBottom: '1px solid #eee',
    padding: '40px 0 32px',
  },
  headerInner: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '0 32px',
  },
  backLink: {
    fontSize: '0.8125rem',
    color: '#0066ff',
    textDecoration: 'none',
    display: 'inline-block',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: '2rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    margin: '0 0 8px 0',
  },
  headerSub: {
    fontSize: '1rem',
    color: '#888',
    margin: 0,
  },

  // PICKER
  pickerSection: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '32px',
  },
  pickerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 12,
  },
  pickerCard: {
    background: '#fff',
    border: '2px solid #e5e5e5',
    padding: 16,
    cursor: 'pointer',
    transition: 'all 200ms ease',
    textAlign: 'left',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  pickerName: {
    fontSize: '0.875rem',
    fontWeight: 700,
    margin: '0 0 4px 0',
  },
  pickerDesc: {
    fontSize: '0.6875rem',
    color: '#888',
    lineHeight: 1.4,
    margin: '0 0 10px 0',
  },
  hexRow: {
    display: 'flex',
    gap: 4,
  },
  hexChip: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.5625rem',
    padding: '2px 6px',
    fontWeight: 600,
  },

  // PREVIEW
  previewSection: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '0 32px 48px',
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    margin: '0 0 4px 0',
  },
  previewSub: {
    fontSize: '0.8125rem',
    color: '#888',
    margin: 0,
  },
  fullscreenBtn: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#fff',
    background: '#111',
    border: 'none',
    padding: '8px 18px',
    cursor: 'pointer',
    fontFamily: "'Inter', system-ui, sans-serif",
    marginLeft: 12,
  },
  previewFrame: {
    border: '1px solid #e5e5e5',
    borderRadius: 10,
    overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
  },
  browserBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    background: '#f5f5f5',
    borderBottom: '1px solid #eee',
  },
  browserDots: {
    display: 'flex',
    gap: 6,
  },
  browserDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    display: 'inline-block',
  },
  browserUrl: {
    fontSize: '0.6875rem',
    color: '#aaa',
    fontFamily: "'JetBrains Mono', monospace",
  },
  browserContent: {
    maxHeight: 700,
    overflowY: 'auto',
    overflowX: 'hidden',
  },

  // FLOATING BAR
  floatingBar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    background: 'rgba(0,0,0,0.9)',
    backdropFilter: 'blur(12px)',
    padding: '10px 0',
  },
  floatingInner: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingLabel: {
    fontSize: '0.8125rem',
    color: '#fff',
    fontWeight: 600,
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  floatingBtns: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  floatingColorBtn: {
    width: 24,
    height: 24,
    border: '2px solid rgba(255,255,255,0.3)',
    cursor: 'pointer',
    padding: 0,
    transition: 'all 150ms ease',
  },
  floatingBtnExit: {
    fontSize: '0.75rem',
    color: '#fff',
    background: '#dc2626',
    border: 'none',
    padding: '6px 14px',
    cursor: 'pointer',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: 600,
    marginLeft: 8,
  },

  // COMPARISON
  compSection: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '0 32px 60px',
  },
  compTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    marginBottom: 16,
  },
  compGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 10,
  },
  compCard: {
    background: '#fff',
    border: '1px solid #eee',
    padding: 14,
  },
};

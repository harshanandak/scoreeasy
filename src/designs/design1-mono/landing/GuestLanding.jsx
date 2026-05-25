import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import SportIcon from './sportIcons';
import { sports, sportDetails, features, steps, tickerItems, heroScoreCards, experienceStats, trustNotes } from './landingData';
import finalTheme, { MONO, SWISS } from './landingTheme';
import useIsMobile from './useIsMobile';
import { getReadableTextColor, getSportAccent, prioritySports, sportsTokens } from '../theme/sportsTokens';

const heroSportPriority = new Map([
  ['Cricket', 0],
  ['Football', 1],
  ['Volleyball', 2],
]);

const sportIdByName = new Map([
  ['Badminton', 'badminton'],
  ['Basketball', 'basketball'],
  ['Cricket', 'cricket'],
  ['Football', 'football'],
  ['Futsal', 'futsal'],
  ['Handball', 'handball'],
  ['Hockey', 'hockey'],
  ['Kabaddi', 'kabaddi'],
  ['Pickleball', 'pickleball'],
  ['Rugby', 'rugby'],
  ['Squash', 'squash'],
  ['Table Tennis', 'tabletennis'],
  ['Tennis', 'tennis'],
  ['Volleyball', 'volleyball'],
]);

function sportPlayPath(sport) {
  const sportId = sportIdByName.get(sport);
  return sportId ? `/play?sport=${sportId}` : '/play';
}

const PRODUCTION_SIGNUP_URL = 'https://scoreeasy.app/signup';
const MOBILE_TAP_TARGET = 44;
const softMix = (color, amount = 12) => `color-mix(in oklch, ${color} ${amount}%, var(--se-color-surface))`;

export default function GuestLanding() {
  const { cloudAuthAvailable } = useAuth();
  const t = finalTheme;
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [hoveredExperienceStat, setHoveredExperienceStat] = useState(null);
  const [hoveredTrustNote, setHoveredTrustNote] = useState(null);
  const [hoveredSport, setHoveredSport] = useState(null);
  const [hoveredStep, setHoveredStep] = useState(null);
  const [activeHeroSport, setActiveHeroSport] = useState(0);
  const [tickerPaused, setTickerPaused] = useState(false);
  const tickerRef = useRef(null);
  const tickerOffset = useRef(0);
  const tickerAnimId = useRef(null);
  const mobile = useIsMobile();
  const orderedHeroScoreCards = [...heroScoreCards].sort((a, b) => (
    (heroSportPriority.get(a.sport) ?? heroScoreCards.length) - (heroSportPriority.get(b.sport) ?? heroScoreCards.length)
  ));
  const px = mobile ? 16 : 32;

  const interactionHandlers = (index, setter, current) => ({
    onMouseEnter: () => setter(index),
    onMouseLeave: () => setter(null),
    onClick: () => setter(current === index ? null : index),
  });

  /* Ticker animation — requestAnimationFrame for pause/nudge control */
  const tickerSpeed = useRef(0.5);
  useEffect(() => {
    const el = tickerRef.current;
    if (!el) return;
    const halfWidth = el.scrollWidth / 2;
    const animate = () => {
      if (!tickerPaused) {
        tickerOffset.current += tickerSpeed.current;
        if (tickerOffset.current >= halfWidth) tickerOffset.current -= halfWidth;
        if (tickerOffset.current < 0) tickerOffset.current += halfWidth;
        el.style.transform = `translateX(-${tickerOffset.current}px)`;
      }
      tickerAnimId.current = requestAnimationFrame(animate);
    };
    tickerAnimId.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(tickerAnimId.current);
  }, [tickerPaused]);

  const handleTickerClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const nudge = 120;
    if (clickX < rect.width / 2) {
      tickerOffset.current -= nudge;
    } else {
      tickerOffset.current += nudge;
    }
  }, []);

  const heroCardHandlers = (index) => ({
    onMouseEnter: () => setActiveHeroSport(index),
    onClick: () => setActiveHeroSport(index),
  });
  const activeCard = orderedHeroScoreCards[activeHeroSport];
  const activeSportId = sportIdByName.get(activeCard.sport);
  const activeAccent = getSportAccent(activeSportId);
  const activeAccentText = getReadableTextColor(activeAccent.primary);
  const activeStartLabel = `START ${activeCard.sport.toUpperCase()}`;
  const signupPath = cloudAuthAvailable ? '/signup' : PRODUCTION_SIGNUP_URL;
  const heroActions = [
    { label: activeStartLabel, tone: 'primary', to: sportPlayPath(activeCard.sport) },
    { label: 'CHOOSE SPORT', tone: 'secondary', to: '/play' },
  ];
  const stepActions = [
    { label: 'CHOOSE SPORT', to: '/play' },
    { label: `SET UP ${activeCard.sport.toUpperCase()}`, to: sportPlayPath(activeCard.sport) },
    { label: 'START SCORING', to: sportPlayPath(activeCard.sport) },
  ];
  const heroActionStyle = (action, mode) => {
    const compact = mode === 'compact';
    const primary = action.tone === 'primary';
    return {
      fontFamily: MONO,
      fontSize: compact ? 'clamp(0.5625rem, 2.5vw, 0.6875rem)' : '0.8125rem',
      fontWeight: 700,
      padding: compact ? '12px 14px' : '14px 28px',
      letterSpacing: '0.05em',
      textDecoration: 'none',
      background: primary ? activeAccent.primary : 'transparent',
      color: primary ? activeAccentText : t.text,
      border: `${t.borderWeight} solid ${primary ? activeAccent.primary : (!compact ? t.text : t.border)}`,
      borderRadius: sportsTokens.component.button.radius,
      textAlign: 'center',
      minWidth: 0,
      minHeight: compact ? MOBILE_TAP_TARGET : 48,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      whiteSpace: 'nowrap',
    };
  };
  const stepActionStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MOBILE_TAP_TARGET,
    padding: '10px 14px',
    marginTop: mobile ? 16 : 20,
    border: `${t.borderWeight} solid ${activeAccent.primary}`,
    borderRadius: sportsTokens.component.button.radius,
    background: activeAccent.primary,
    color: activeAccentText,
    fontFamily: MONO,
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    lineHeight: 1.1,
    textDecoration: 'none',
    textAlign: 'center',
    boxSizing: 'border-box',
    width: mobile ? '100%' : 'auto',
  };
  const ctaActionStyle = (primary) => ({
    fontFamily: MONO,
    fontSize: mobile ? '0.75rem' : '0.8125rem',
    fontWeight: 700,
    padding: mobile ? '12px 24px' : '14px 28px',
    letterSpacing: '0.05em',
    textDecoration: 'none',
    background: primary ? activeAccent.primary : 'transparent',
    color: primary ? activeAccentText : activeAccent.primary,
    border: `2px solid ${activeAccent.primary}`,
    borderRadius: sportsTokens.component.button.radius,
    width: mobile ? '100%' : 'auto',
    textAlign: 'center',
    maxWidth: mobile ? 280 : 'none',
    minHeight: mobile ? 48 : 50,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
  });

  const renderTag = (text, isHovered, tagColor) => {
    const accent = tagColor || t.blue;
    const base = { fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.1em', transition: `all ${t.transitionSpeed} ease` };
    if (t.tagStyle === 'filled') {
      return (
        <span style={{
          ...base, padding: '3px 10px',
          background: isHovered ? 'transparent' : softMix(accent, 10),
          color: isHovered ? sportsTokens.color.actionSoft : accent,
          border: `1px solid ${accent}`,
        }}>{text}</span>
      );
    }
    return (
      <span style={{
        ...base, padding: '3px 8px',
        border: `1px solid ${accent}`,
        color: accent,
      }}>{text}</span>
    );
  };

  const Cross = ({ top, left, right, bottom, color }) => (
    <span style={{
      position: 'absolute',
      fontFamily: MONO,
      fontSize: '0.5rem',
      color: color || t.textFaint,
      lineHeight: 1,
      top,
      left,
      right,
      bottom,
      userSelect: 'none',
      pointerEvents: 'none',
    }}>+</span>
  );

  return (
    <div style={{ fontFamily: SWISS, background: t.bg, color: t.text, minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ═══ NAV ═══ */}
      <nav aria-hidden="true" style={{ display: 'none' }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: mobile ? '12px 16px' : '16px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: mobile ? '0.75rem' : '0.875rem', lineHeight: 1.1, letterSpacing: '-0.02em', color: t.text }}>
            SCORE<br />EASY
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 12 : 24 }}>
            {!mobile && ['Features', 'Experience', 'Sports', 'How'].map(link => (
              <a key={link} href={`#${link.toLowerCase()}`} className="nav-link" style={{ fontFamily: MONO, fontSize: '0.75rem', color: t.textMuted, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.08em', transition: 'color 150ms ease' }}>{link}</a>
            ))}
            {cloudAuthAvailable && (
              <Link to="/login" className="nav-signin" style={{
                fontFamily: MONO, fontSize: mobile ? '0.625rem' : '0.75rem', fontWeight: 700,
                color: t.text, textDecoration: 'none',
                padding: mobile ? '6px 10px' : '8px 16px',
                border: `${t.borderWeight} solid ${t.borderStrong}`, background: 'transparent',
                transition: 'background 150ms ease, color 150ms ease',
              }}>
                Sign in &rarr;
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section style={{ padding: mobile ? '0' : '80px 32px 60px', maxWidth: 1200, margin: '0 auto' }}>
        {mobile ? (
          <div style={{ padding: '28px 16px 0' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: -4, right: 0, opacity: t.iconDecoOpacity, transform: 'rotate(-6deg)' }}>
                <SportIcon name="Cricket" size={44} color={t.text} />
              </div>
              <p style={{ fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.15em', color: t.textMuted, marginBottom: 8 }}>
                {activeCard.sport.toUpperCase()} SCOREKEEPER
              </p>
              <h1 style={{ fontWeight: 900, fontSize: 'clamp(2.2rem, 11vw, 3rem)', lineHeight: 0.9, letterSpacing: '-0.04em', margin: '0 0 12px 0', color: t.text }}>
                START<br />A MATCH.
              </h1>
              <p style={{ fontSize: '0.9375rem', lineHeight: 1.45, color: t.textSoft, marginBottom: 16, maxWidth: 320 }}>
                Play instantly as a guest. Keep scoring when offline. Create an account only when you want sync.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {heroActions.map((action) => (
                  <Link key={action.label} to={action.to} style={heroActionStyle(action, 'compact')}>
                    {action.label}
                  </Link>
                ))}
              </div>
              <Link to={signupPath} style={{
                display: 'inline-block', marginTop: 12, fontFamily: MONO, fontSize: '0.625rem',
                color: t.textMuted, textDecoration: 'none', letterSpacing: '0.06em',
              }}>
                Create account for sync and history
              </Link>
            </div>

            {/* Sport pill selector + dynamic scorecard mockup */}
            <div style={{ marginTop: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {orderedHeroScoreCards.map((card, i) => (
                  <button key={card.sport} {...heroCardHandlers(i)} style={{
                    minHeight: MOBILE_TAP_TARGET, padding: '8px 12px', border: 'none', cursor: 'pointer',
                    fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.06em',
                    background: activeHeroSport === i ? getSportAccent(sportIdByName.get(card.sport)).primary : t.surface,
                    color: activeHeroSport === i ? activeAccentText : t.textMuted,
                    transition: 'all 200ms ease',
                    borderRadius: 0,
                    borderBottom: activeHeroSport === i ? `2px solid ${getSportAccent(sportIdByName.get(card.sport)).primary}` : `2px solid transparent`,
                  }}>
                    {card.sport.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ border: `${t.borderWeight} solid ${sportsTokens.color.lineStrong}`, borderRadius: 0, boxSizing: 'border-box', padding: 14, background: t.surface, position: 'relative', overflow: 'hidden', boxShadow: `4px 4px 0 ${activeAccent.primary}` }}>
                <div key={activeCard.sport} style={{ animation: 'card-fade 300ms ease' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: sportsTokens.color.actionStrong, fontWeight: 800 }}>&#9679; LIVE</span>
                    <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: sportsTokens.color.inkSoft, fontWeight: 800, letterSpacing: '0.1em' }}>{activeCard.sport.toUpperCase()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center', minWidth: 0 }}>
                      <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.08em', display: 'block', color: sportsTokens.color.inkSoft }}>{activeCard.teamA}</span>
                      <span style={{ fontFamily: MONO, fontSize: activeCard.suffixA ? '1.5rem' : '1.75rem', fontWeight: 900, lineHeight: 1, color: sportsTokens.color.actionStrong }}>
                        {activeCard.scoreA}{activeCard.suffixA && <span style={{ fontSize: '0.75rem', fontWeight: 800, color: sportsTokens.color.inkSoft }}>{activeCard.suffixA}</span>}
                      </span>
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: '0.625rem', fontWeight: 800, color: sportsTokens.color.inkMuted }}>VS</span>
                    <div style={{ textAlign: 'center', minWidth: 0 }}>
                      <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.08em', display: 'block', color: sportsTokens.color.inkSoft }}>{activeCard.teamB}</span>
                      <span style={{ fontFamily: MONO, fontSize: activeCard.suffixB ? '1.5rem' : '1.75rem', fontWeight: 900, lineHeight: 1, color: sportsTokens.color.actionStrong }}>
                        {activeCard.scoreB}{activeCard.suffixB && <span style={{ fontSize: '0.75rem', fontWeight: 800, color: sportsTokens.color.inkSoft }}>{activeCard.suffixB}</span>}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 800, color: sportsTokens.color.inkSoft, textAlign: 'center', marginTop: 10, paddingTop: 8, borderTop: `1px solid ${sportsTokens.color.line}` }}>
                    {activeCard.footer}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ─── DESKTOP HERO ─── */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: -20, right: 40, transform: 'rotate(-5deg)', opacity: t.iconDecoOpacity }}>
                <SportIcon name="Football" size={72} color={t.text} />
              </div>
              <div style={{ position: 'absolute', top: 90, right: -10, transform: 'rotate(8deg)', opacity: t.iconDecoOpacity * 0.8 }}>
                <SportIcon name="Tennis" size={60} color={t.text} />
              </div>
              <div style={{ position: 'absolute', bottom: 10, right: 80, transform: 'rotate(-3deg)', opacity: t.iconDecoOpacity * 0.6 }}>
                <SportIcon name="Cricket" size={52} color={t.text} />
              </div>

              <p style={{ fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.15em', color: t.textMuted, marginBottom: 16 }}>
                UNIVERSAL SCORE TRACKER
              </p>
              <h1 style={{ fontWeight: 900, fontSize: 'clamp(3rem, 7vw, 5.5rem)', lineHeight: 0.9, letterSpacing: '-0.04em', margin: '0 0 24px 0', color: t.text }}>
                SCORE<br />ANY<br />GAME.
              </h1>
              <p style={{ fontSize: '1.0625rem', lineHeight: 1.6, color: t.textSoft, marginBottom: 32 }}>
                Tournaments. Quick matches. Live scoring.<br />
                Guest scoring. Local history. Optional sync.<br />
                Built for web, Android, and iOS.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                {heroActions.map((action) => (
                  <Link key={action.label} to={action.to} style={heroActionStyle(action, 'desktop')}>
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Blueprint-style mockup with sport switcher */}
            <div style={{ position: 'relative' }}>
              {[{ t: -8, l: -8 }, { t: -8, r: -8 }, { b: -8, l: -8 }, { b: -8, r: -8 }].map((pos, idx) => (
                <div key={idx} style={{ position: 'absolute', top: pos.t, bottom: pos.b, left: pos.l, right: pos.r, width: 16, height: 16 }}>
                  <div style={{ position: 'absolute', [pos.t !== undefined ? 'top' : 'bottom']: 7, left: 0, width: 16, borderTop: `1px solid ${t.textFaint}` }} />
                  <div style={{ position: 'absolute', top: 0, [pos.l !== undefined ? 'left' : 'right']: 7, height: 16, borderLeft: `1px solid ${t.textFaint}` }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {orderedHeroScoreCards.map((card, i) => (
                  <button key={card.sport} {...heroCardHandlers(i)} style={{
                    flex: 1, padding: '8px 4px', border: 'none', cursor: 'pointer',
                    fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.04em',
                    background: activeHeroSport === i ? getSportAccent(sportIdByName.get(card.sport)).primary : t.surface,
                    color: activeHeroSport === i ? activeAccentText : t.textMuted,
                    transition: 'all 200ms ease',
                    borderBottom: activeHeroSport === i ? `2px solid ${getSportAccent(sportIdByName.get(card.sport)).primary}` : `2px solid ${t.border}`,
                  }}>
                    {card.sport.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ border: `${t.borderWeight} solid ${sportsTokens.color.lineStrong}`, borderRadius: 0, boxSizing: 'border-box', padding: 24, background: t.surface, boxShadow: `4px 4px 0 ${activeAccent.primary}`, position: 'relative', overflow: 'hidden' }}>
                <div key={activeCard.sport} style={{ animation: 'card-fade 300ms ease' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: sportsTokens.color.actionStrong, fontWeight: 800 }}>&#9679; LIVE</span>
                    <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: sportsTokens.color.inkSoft, fontWeight: 800, letterSpacing: '0.1em' }}>{activeCard.sport.toUpperCase()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontFamily: MONO, fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.08em', color: sportsTokens.color.inkSoft }}>{activeCard.teamA}</span>
                      <span style={{ fontFamily: MONO, fontSize: activeCard.suffixA ? '2.25rem' : '3rem', fontWeight: 900, lineHeight: 1, color: sportsTokens.color.actionStrong }}>
                        {activeCard.scoreA}{activeCard.suffixA && <span style={{ fontSize: '1.25rem', fontWeight: 800, color: sportsTokens.color.inkSoft }}>{activeCard.suffixA}</span>}
                      </span>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: '0.75rem', fontWeight: 800, color: sportsTokens.color.inkMuted }}>VS</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontFamily: MONO, fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.08em', color: sportsTokens.color.inkSoft }}>{activeCard.teamB}</span>
                      <span style={{ fontFamily: MONO, fontSize: activeCard.suffixB ? '2.25rem' : '3rem', fontWeight: 900, lineHeight: 1, color: sportsTokens.color.actionStrong }}>
                        {activeCard.scoreB}{activeCard.suffixB && <span style={{ fontSize: '1.25rem', fontWeight: 800, color: sportsTokens.color.inkSoft }}>{activeCard.suffixB}</span>}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: '0.6875rem', fontWeight: 800, color: sportsTokens.color.inkSoft, textAlign: 'center', letterSpacing: '0.1em', paddingTop: 12, borderTop: `1px solid ${sportsTokens.color.line}` }}>
                    {activeCard.footer}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ═══ TICKER ═══ */}
      <div
        style={{
          display: mobile ? 'none' : 'block',
          background: 'color-mix(in oklch, var(--se-color-ink) 92%, var(--se-color-surface))',
          color: sportsTokens.color.actionSoft,
          borderTop: `${t.borderWeight} solid ${t.borderStrong}`,
          borderBottom: `${t.borderWeight} solid ${t.borderStrong}`,
          padding: '14px 0',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
        onMouseEnter={() => setTickerPaused(true)}
        onMouseLeave={() => setTickerPaused(false)}
        onClick={handleTickerClick}
      >
        <div ref={tickerRef} style={{ display: 'flex', whiteSpace: 'nowrap', width: 'max-content' }}>
          {[0, 1].map(copy => (
            <div key={copy} style={{ display: 'flex', gap: mobile ? 16 : 40, paddingRight: mobile ? 16 : 40 }}>
              {tickerItems.map((item) => (
                <span key={`${copy}-${item}`} style={{ fontFamily: MONO, fontSize: mobile ? '0.625rem' : '0.75rem', letterSpacing: '0.12em', fontWeight: 800, flexShrink: 0 }}>
                  {item}<span style={{ margin: mobile ? '0 8px' : '0 20px', color: sportsTokens.color.inverse, opacity: 0.42 }}>&#9670;</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* APP EXPERIENCE */}
      <section id="experience" style={{ padding: mobile ? '32px 0' : '56px 0', borderBottom: `${t.borderWeight} solid ${t.borderStrong}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: `0 ${px}px` }}>
          <p style={{ fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.12em', color: t.textFaint, marginBottom: mobile ? 8 : 12 }}>01 / APP EXPERIENCE</p>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '0.8fr 1.2fr', gap: mobile ? 18 : 28, alignItems: 'start' }}>
            <h2 style={{ fontWeight: 900, fontSize: mobile ? 'clamp(1.65rem, 7vw, 2.15rem)' : 'clamp(2rem, 4vw, 2.875rem)', lineHeight: 1, letterSpacing: '0', margin: 0, color: t.text }}>
              START FIRST.<br />SAVE LATER.
            </h2>
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: mobile ? 10 : 14, marginBottom: mobile ? 12 : 14 }}>
                {experienceStats.map((item, i) => {
                  const isHovered = hoveredExperienceStat === i;
                  return (
                  <div
                    key={item.label}
                    style={{
                    border: `1px solid ${isHovered ? sportsTokens.color.action : `color-mix(in oklch, ${sportsTokens.color.action} 28%, ${t.border})`}`,
                    borderRadius: sportsTokens.component.card.radius,
                    padding: mobile ? '18px 22px' : '22px 24px',
                    background: t.surface,
                    minHeight: mobile ? 112 : 0,
                    boxShadow: isHovered ? `3px 3px 0 ${sportsTokens.color.action}` : `0 0 0 1px color-mix(in oklch, ${sportsTokens.color.action} 8%, transparent), ${t.cardShadow}`,
                    transform: isHovered ? 'translate(-1px, -1px)' : 'translate(0, 0)',
                    transition: 'border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease',
                  }}
                    {...interactionHandlers(i, setHoveredExperienceStat, hoveredExperienceStat)}
                  >
                    <strong style={{ display: 'block', fontFamily: MONO, fontSize: mobile ? '1.5rem' : '2rem', lineHeight: 1, color: sportsTokens.color.action, transform: isHovered ? 'translateY(-1px)' : 'translateY(0)', transition: 'transform 120ms ease' }}>{item.value}</strong>
                    <span style={{ display: 'block', fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '8px 0', color: t.text }}>{item.label}</span>
                    <p style={{ fontSize: '0.8125rem', lineHeight: 1.45, color: t.textSoft, margin: 0 }}>{item.detail}</p>
                  </div>
                  );
                })}
              </div>
              <ul style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: mobile ? 8 : 12, padding: 0, margin: 0, listStyle: 'none' }}>
                {trustNotes.map((note, i) => {
                  const isHovered = hoveredTrustNote === i;
                  return (
                  <li
                    key={note}
                    style={{
                    border: `1px solid ${isHovered ? sportsTokens.color.action : 'color-mix(in oklch, var(--se-color-line) 32%, var(--se-color-surface))'}`,
                    borderRadius: 0,
                    background: isHovered ? 'color-mix(in oklch, var(--se-color-action) 8%, var(--se-color-surface))' : t.bg,
                    padding: mobile ? '12px 14px' : '14px 16px',
                    color: isHovered ? t.text : t.textSoft,
                    fontSize: mobile ? '0.8125rem' : '0.875rem',
                    lineHeight: 1.45,
                    transition: 'border-color 120ms ease, background 120ms ease, color 120ms ease',
                  }}
                    {...interactionHandlers(i, setHoveredTrustNote, hoveredTrustNote)}
                  >
                    <span style={{ display: 'block', fontFamily: MONO, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', color: sportsTokens.color.action, marginBottom: 6 }}>
                      APP 0{i + 1}
                    </span>
                    {note}
                  </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" style={{ padding: mobile ? '36px 0' : '80px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: `0 ${px}px` }}>
          <p style={{ fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.12em', color: t.textFaint, marginBottom: mobile ? 8 : 12 }}>02 / FEATURES</p>
          <h2 style={{ fontWeight: 900, fontSize: mobile ? 'clamp(1.75rem, 7vw, 2.25rem)' : 'clamp(2rem, 4vw, 3rem)', lineHeight: 1, letterSpacing: '0', margin: mobile ? '0 0 24px 0' : '0 0 40px 0', color: t.text }}>
            EVERYTHING<br />YOU NEED.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: mobile ? 10 : 14 }}>
            {features.map((f, i) => {
              const isHovered = hoveredFeature === i;
              const fBg = t.featureBg || t.surface;
              const fBorder = t.featureBorder || t.border;
              const fHoverBg = t.featureHoverBg || t.text;
              const fHoverColor = t.featureHoverColor || '#fff';
              const fHoverTextSoft = t.featureHoverTextSoft || '#ccc';
              const fHoverBorder = t.featureHoverBorder || fHoverBg;
              const fTextColor = t.featureTextColor || t.text;
              const fTextSoft = t.featureTextSoft || t.textSoft;
              return (
                <div
                  key={f.tag}
                  style={{
                    border: `${t.borderWeight} solid ${isHovered ? fHoverBorder : fBorder}`,
                    padding: mobile ? 20 : 28, cursor: 'default',
                    borderRadius: 0,
                    transition: `border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease, background 120ms ease, color 120ms ease`,
                    background: isHovered ? fHoverBg : fBg,
                    color: isHovered ? fHoverColor : fTextColor,
                    position: 'relative', overflow: 'hidden',
                    boxShadow: isHovered ? `3px 3px 0 ${t.borderStrong}` : 'none',
                    transform: isHovered ? 'translate(-1px, -1px)' : 'translate(0, 0)',
                  }}
                  {...interactionHandlers(i, setHoveredFeature, hoveredFeature)}
                >
                  <div style={{
                    position: 'absolute', bottom: mobile ? -10 : -15, right: mobile ? -10 : -15,
                    opacity: isHovered ? (t.iconWatermarkHover || 0.28) : (t.iconWatermarkOpacity || 0.07),
                    transition: 'opacity 400ms ease', transform: 'rotate(-5deg)',
                  }}>
                    <SportIcon name={f.icon} size={mobile ? 80 : 120} color={isHovered ? sportsTokens.color.actionSoft : t.text} />
                  </div>
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ marginBottom: 12 }}>
                      {renderTag(f.tag, isHovered, t.featureTagColor)}
                    </div>
                    <h3 style={{ fontWeight: 800, fontSize: mobile ? '1rem' : '1.125rem', letterSpacing: '-0.01em', margin: '0 0 6px 0' }}>{f.title}</h3>
                    <p style={{ fontSize: mobile ? '0.8125rem' : '0.875rem', lineHeight: 1.5, color: isHovered ? fHoverTextSoft : fTextSoft, margin: 0, transition: `color ${t.transitionSpeed} ease` }}>{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ SPORTS ═══ */}
      <section id="sports" style={{ padding: mobile ? '32px 0 40px' : '60px 0 80px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: `0 ${px}px` }}>
          <p style={{ fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.12em', color: t.textFaint, marginBottom: mobile ? 8 : 12 }}>03 / SPORTS</p>
          <h2 style={{ fontWeight: 900, fontSize: mobile ? 'clamp(1.75rem, 7vw, 2.25rem)' : 'clamp(2rem, 4vw, 3rem)', lineHeight: 1, letterSpacing: '0', margin: mobile ? '0 0 24px 0' : '0 0 40px 0', color: t.text }}>
            14 SPORTS.<br />YOUR RULES.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, 1fr)', gap: mobile ? 8 : 12 }}>
            {sports.map((sp, i) => {
              const detail = sportDetails[sp];
              const isHovered = hoveredSport === i;
              const sBg = t.sportBg || t.surface;
              const sHoverBg = t.sportHoverBg || t.text;
              const sHoverColor = t.sportHoverColor || sportsTokens.color.inverse;
              const sHoverTextSoft = t.sportHoverTextSoft || 'color-mix(in oklch, var(--se-color-inverse) 72%, var(--se-color-ink))';
              const sIconColor = t.sportIconColor || t.text;
              const sHoverIconColor = t.sportHoverIconColor || sportsTokens.color.actionSoft;
              const sTextColor = t.sportTextColor || t.text;
              const sBorderStyle = t.sportBorderStyle || 'dashed';
              const sBorderColor = t.sportBorderColor || '#d0d0d0';
              const sportId = sportIdByName.get(sp);
              const sportAccent = getSportAccent(sportId);
              const hoverBorderColor = t.sportHoverBorder || sportAccent.primary;
              const sportCardHandlers = {
                ...interactionHandlers(i, setHoveredSport, hoveredSport),
                onFocus: () => setHoveredSport(i),
                onBlur: () => setHoveredSport(null),
              };
              const sportCardText = isHovered ? sHoverColor : sTextColor;
              const sportCardIcon = isHovered ? sHoverIconColor : sIconColor;
              const detailColor = isHovered ? sHoverTextSoft : (mobile ? t.textSoft : t.textMuted);
              return (
                <Link
                  key={sp}
                  to={sportPlayPath(sp)}
                  aria-label={`Start ${sp} from sports`}
                  style={{
                    display: 'block',
                    position: 'relative',
                    border: `1.5px ${isHovered ? 'solid' : sBorderStyle} ${isHovered ? hoverBorderColor : sBorderColor}`,
                    borderRadius: 0,
                    padding: mobile ? '16px 10px' : '20px 14px',
                    minHeight: 0,
                    textAlign: 'center',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    transition: `border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease`,
                    background: isHovered ? sHoverBg : sBg,
                    color: sportCardText,
                    boxShadow: isHovered ? `4px 4px 0 ${hoverBorderColor}` : 'none',
                    transform: isHovered ? 'translate(-1px, -1px)' : 'translate(0, 0)',
                  }}
                  {...sportCardHandlers}
                >
                  <Cross top={2} left={4} color={isHovered ? hoverBorderColor : t.textFaint} />
                  <Cross top={2} right={4} color={isHovered ? hoverBorderColor : t.textFaint} />
                  <Cross bottom={2} left={4} color={isHovered ? hoverBorderColor : t.textFaint} />
                  <Cross bottom={2} right={4} color={isHovered ? hoverBorderColor : t.textFaint} />
                  <div style={{ marginBottom: mobile ? 6 : 10, display: 'flex', justifyContent: 'center' }}>
                    <span style={{
                      display: 'inline-flex',
                      transition: 'transform 120ms ease',
                      transform: isHovered ? 'translateY(-2px) rotate(-4deg)' : 'translateY(0) rotate(0deg)',
                    }}>
                      <SportIcon name={sp} size={mobile ? 32 : 40} color={sportCardIcon} />
                    </span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontFamily: MONO, fontSize: mobile ? '0.625rem' : '0.5625rem', letterSpacing: '0.06em', lineHeight: 1.2, fontWeight: 800 }}>
                      {sp.toUpperCase()}
                    </span>
                    {detail && (
                      <span style={{ display: 'block', marginTop: 8, fontSize: '0.6875rem', lineHeight: 1.35, color: detailColor }}>
                        {detail.duration}<br />{detail.players}<br />{detail.rules}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ THREE STEPS ═══ */}
      <section id="how" style={{ padding: mobile ? '36px 0' : '80px 0', borderTop: `${t.borderWeight} solid ${t.borderStrong}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: `0 ${px}px` }}>
          <p style={{ fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.12em', color: t.textFaint, marginBottom: mobile ? 8 : 12 }}>04 / HOW IT WORKS</p>
          <h2 style={{ fontWeight: 900, fontSize: mobile ? 'clamp(1.75rem, 7vw, 2.25rem)' : 'clamp(2rem, 4vw, 3rem)', lineHeight: 1, letterSpacing: '0', margin: mobile ? '0 0 24px 0' : '0 0 40px 0', color: t.text }}>
            THREE STEPS.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: mobile ? 8 : 14 }}>
            {steps.map((step, i) => {
              const isHovered = hoveredStep === i;
              const restTransform = t.stepIconRest || 'rotate(6deg) scale(1)';
              const hoverTransform = t.stepIconHover || 'rotate(6deg) scale(1.3)';
              const restOpacity = t.iconDecoOpacity * 1.8;
              const hoverOpacity = t.stepIconOpacityHover || 0.45;
              const iconColor = isHovered && t.stepIconColorHover ? t.stepIconColorHover : t.text;
              const action = stepActions[i];
              return (
                <div
                  key={step.num}
                  style={{
                    border: `${t.borderWeight} solid ${isHovered ? activeAccent.primary : t.borderStrong}`,
                    borderRadius: 0,
                    padding: mobile ? 20 : 32,
                    position: 'relative',
                    overflow: 'hidden',
                    background: t.surface,
                    boxShadow: isHovered ? `3px 3px 0 ${activeAccent.primary}` : 'none',
                    cursor: 'default',
                    transition: `border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease`,
                    transform: isHovered ? 'translate(-1px, -1px)' : 'translate(0, 0)',
                  }}
                  {...interactionHandlers(i, setHoveredStep, hoveredStep)}
                >
                  <div style={{
                    position: 'absolute', top: mobile ? -6 : -10, right: mobile ? -6 : -10,
                    opacity: isHovered ? hoverOpacity : restOpacity,
                    transform: isHovered ? hoverTransform : restTransform,
                    transition: `all ${t.transitionSpeed} ease`,
                  }}>
                    <SportIcon name={step.icon} size={mobile ? 44 : 64} color={iconColor} />
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: mobile ? t.stepNumSizeMobile : t.stepNumSize, fontWeight: 900, color: activeAccent.primary, lineHeight: 1, display: 'block' }}>{step.num}</span>
                  <h3 style={{ fontFamily: MONO, fontSize: mobile ? '0.75rem' : '0.875rem', fontWeight: 700, letterSpacing: '0.06em', margin: mobile ? '12px 0 6px 0' : '16px 0 8px 0', color: t.text }}>{step.title}</h3>
                  <p style={{ fontSize: mobile ? '0.8125rem' : '0.875rem', lineHeight: 1.5, color: t.textSoft, margin: 0 }}>{step.desc}</p>
                  <Link to={action.to} style={stepActionStyle}>
                    {action.label}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section style={{ background: t.bg, color: t.text, padding: mobile ? '34px 16px' : '56px 32px', textAlign: 'center', borderTop: `${t.borderWeight} solid ${t.borderStrong}` }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: mobile ? '8px 0' : '12px 0' }}>
        <h2 style={{ fontWeight: 900, fontSize: mobile ? 'clamp(2rem, 10vw, 3rem)' : 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1, letterSpacing: '0', margin: '0 0 20px 0', color: t.text }}>
          READY?
        </h2>
        <div style={{ display: 'flex', gap: mobile ? 10 : 16, justifyContent: 'center', flexDirection: mobile ? 'column' : 'row', alignItems: 'center' }}>
          <Link to={sportPlayPath(activeCard.sport)} style={ctaActionStyle(true)}>
            {activeStartLabel}
          </Link>
          <Link to={signupPath} style={ctaActionStyle(false)}>
            SIGN UP FREE
          </Link>
        </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{
        padding: mobile ? '16px' : '24px 32px', borderTop: `${t.borderWeight} solid ${t.borderStrong}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        maxWidth: 1200, margin: '0 auto',
      }}>
        <span style={{ fontFamily: MONO, fontSize: mobile ? '0.625rem' : '0.75rem', fontWeight: 700, color: t.text }}>SCORE EASY</span>
        <div style={{ display: 'flex', gap: mobile ? 10 : 16, flexWrap: 'wrap', justifyContent: mobile ? 'flex-end' : 'center' }}>
          {['Privacy', 'Terms', 'Contact'].map((label) => (
            <Link key={label} to={`/${label.toLowerCase()}`} style={{ fontFamily: MONO, fontSize: mobile ? '0.5625rem' : '0.6875rem', color: t.textMuted, textDecoration: 'none' }}>
              {label}
            </Link>
          ))}
        </div>
        <span style={{ fontFamily: MONO, fontSize: mobile ? '0.5625rem' : '0.6875rem', color: t.textMuted }}>&copy; 2026</span>
      </footer>

      {/* Keyframes + nav hover styles */}
      <style>{`
        @keyframes card-fade {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .nav-link:hover { color: ${t.text} !important; }
        .nav-signin:hover { background: ${t.text} !important; color: ${t.bg} !important; }
      `}</style>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import SportIcon from './sportIcons';
import { sports, features, steps, tickerItems, heroScoreCards } from './landingData';
import finalTheme, { MONO, SWISS } from './landingTheme';
import useIsMobile from './useIsMobile';

export default function GuestLanding() {
  const { cloudAuthAvailable } = useAuth();
  const t = finalTheme;
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [hoveredSport, setHoveredSport] = useState(null);
  const [hoveredStep, setHoveredStep] = useState(null);
  const [activeHeroSport, setActiveHeroSport] = useState(0);
  const [tickerPaused, setTickerPaused] = useState(false);
  const tickerRef = useRef(null);
  const tickerOffset = useRef(0);
  const tickerAnimId = useRef(null);
  const mobile = useIsMobile();
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
  const activeCard = heroScoreCards[activeHeroSport];

  const renderTag = (text, isHovered, tagColor) => {
    const accent = tagColor || t.blue;
    const base = { fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.1em', transition: `all ${t.transitionSpeed} ease` };
    if (t.tagStyle === 'filled') {
      return (
        <span style={{
          ...base, padding: '3px 10px',
          background: isHovered ? 'rgba(255,255,255,0.15)' : `${accent}18`,
          color: isHovered ? '#fff' : accent,
          border: `1px solid ${isHovered ? 'rgba(255,255,255,0.3)' : `${accent}35`}`,
        }}>{text}</span>
      );
    }
    return (
      <span style={{
        ...base, padding: '3px 8px',
        border: `1px solid ${isHovered ? '#fff' : accent}`,
        color: isHovered ? '#fff' : accent,
      }}>{text}</span>
    );
  };

  const Cross = ({ top, left, right, bottom }) => (
    <span style={{
      position: 'absolute', fontFamily: MONO, fontSize: '0.5rem', color: t.textFaint, lineHeight: 1,
      top, left, right, bottom, userSelect: 'none',
    }}>+</span>
  );

  return (
    <div style={{ fontFamily: SWISS, background: t.bg, color: t.text, minHeight: '100vh' }}>

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
            {!mobile && ['Features', 'Sports', 'How'].map(link => (
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
                POPULAR GAME SCOREKEEPER
              </p>
              <h1 style={{ fontWeight: 900, fontSize: 'clamp(2.2rem, 11vw, 3rem)', lineHeight: 0.9, letterSpacing: '-0.04em', margin: '0 0 12px 0', color: t.text }}>
                START<br />A MATCH.
              </h1>
              <p style={{ fontSize: '0.875rem', lineHeight: 1.5, color: t.textSoft, marginBottom: 16 }}>
                Start with cricket or football first, with volleyball and the rest of the catalog ready when needed.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to="/play" style={{
                  fontFamily: MONO, fontSize: '0.6875rem', fontWeight: 700,
                  padding: '10px 16px', letterSpacing: '0.05em', textDecoration: 'none',
                  background: t.text, color: t.bg, border: `${t.borderWeight} solid ${t.text}`,
                  flex: 1, textAlign: 'center',
                }}>
                  START SCORING
                </Link>
                <Link to="/cricket/quick?format=T20" style={{
                  fontFamily: MONO, fontSize: '0.6875rem', fontWeight: 700,
                  padding: '10px 16px', letterSpacing: '0.05em', textDecoration: 'none',
                  background: 'transparent', color: t.text, border: `${t.borderWeight} solid ${t.border}`,
                  flex: 1, textAlign: 'center',
                }}>
                  QUICK CRICKET
                </Link>
              </div>
              {cloudAuthAvailable && (
                <Link to="/signup" style={{
                  display: 'inline-block', marginTop: 12, fontFamily: MONO, fontSize: '0.625rem',
                  color: t.textMuted, textDecoration: 'none', letterSpacing: '0.06em',
                }}>
                  Create account for sync and history
                </Link>
              )}
            </div>

            {/* Sport pill selector + dynamic scorecard mockup */}
            <div style={{ marginTop: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {heroScoreCards.map((card, i) => (
                  <button key={card.sport} {...heroCardHandlers(i)} style={{
                    minHeight: 32, padding: '6px 10px', border: 'none', cursor: 'pointer',
                    fontFamily: MONO, fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.06em',
                    background: activeHeroSport === i ? t.text : t.surface,
                    color: activeHeroSport === i ? t.bg : t.textMuted,
                    transition: 'all 200ms ease',
                    borderBottom: activeHeroSport === i ? `2px solid ${t.blue}` : `2px solid transparent`,
                  }}>
                    {card.sport.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ border: `${t.borderWeight} solid ${t.borderStrong}`, padding: 14, background: t.surface, position: 'relative', overflow: 'hidden' }}>
                <div key={activeCard.sport} style={{ animation: 'card-fade 300ms ease' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: t.blue, fontWeight: 700 }}>&#9679; LIVE</span>
                    <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: t.textMuted, letterSpacing: '0.1em' }}>{activeCard.sport.toUpperCase()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.08em', display: 'block', color: t.textMuted }}>{activeCard.teamA}</span>
                      <span style={{ fontFamily: MONO, fontSize: activeCard.suffixA ? '1.5rem' : '1.75rem', fontWeight: 800, lineHeight: 1, color: t.blue }}>
                        {activeCard.scoreA}{activeCard.suffixA && <span style={{ fontSize: '0.75rem', fontWeight: 600, color: t.textMuted }}>{activeCard.suffixA}</span>}
                      </span>
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: '0.625rem', color: t.textFaint }}>VS</span>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 600, letterSpacing: '0.08em', display: 'block', color: t.textMuted }}>{activeCard.teamB}</span>
                      <span style={{ fontFamily: MONO, fontSize: activeCard.suffixB ? '1.5rem' : '1.75rem', fontWeight: 800, lineHeight: 1, color: t.blue }}>
                        {activeCard.scoreB}{activeCard.suffixB && <span style={{ fontSize: '0.75rem', fontWeight: 600, color: t.textMuted }}>{activeCard.suffixB}</span>}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: '0.5625rem', color: t.textMuted, textAlign: 'center', marginTop: 10, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
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
                <SportIcon name="Volleyball" size={72} color={t.text} />
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
                14 sports. Zero friction. Free forever.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <Link to="/play" style={{
                  fontFamily: MONO, fontSize: '0.8125rem', fontWeight: 700,
                  padding: '14px 28px', letterSpacing: '0.05em', textDecoration: 'none',
                  background: t.text, color: t.bg, border: `${t.borderWeight} solid ${t.text}`,
                }}>
                  START SCORING
                </Link>
                <Link to="/signup" style={{
                  fontFamily: MONO, fontSize: '0.8125rem', fontWeight: 700,
                  padding: '14px 28px', letterSpacing: '0.05em', textDecoration: 'none',
                  background: 'transparent', color: t.text, border: `${t.borderWeight} solid ${t.text}`,
                }}>
                  CREATE ACCOUNT
                </Link>
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
                {heroScoreCards.map((card, i) => (
                  <button key={card.sport} {...heroCardHandlers(i)} style={{
                    flex: 1, padding: '8px 4px', border: 'none', cursor: 'pointer',
                    fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.04em',
                    background: activeHeroSport === i ? t.text : t.surface,
                    color: activeHeroSport === i ? t.bg : t.textMuted,
                    transition: 'all 200ms ease',
                    borderBottom: activeHeroSport === i ? `2px solid ${t.blue}` : `2px solid ${t.border}`,
                  }}>
                    {card.sport.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ border: `${t.borderWeight} solid ${t.borderStrong}`, padding: 24, background: t.surface, boxShadow: t.cardShadow, position: 'relative', overflow: 'hidden' }}>
                <div key={activeCard.sport} style={{ animation: 'card-fade 300ms ease' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: t.blue, fontWeight: 700 }}>&#9679; LIVE</span>
                    <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: t.textMuted, letterSpacing: '0.1em' }}>{activeCard.sport.toUpperCase()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontFamily: MONO, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', color: t.textMuted }}>{activeCard.teamA}</span>
                      <span style={{ fontFamily: MONO, fontSize: activeCard.suffixA ? '2.25rem' : '3rem', fontWeight: 800, lineHeight: 1, color: t.blue }}>
                        {activeCard.scoreA}{activeCard.suffixA && <span style={{ fontSize: '1.25rem', fontWeight: 600, color: t.textMuted }}>{activeCard.suffixA}</span>}
                      </span>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: '0.75rem', color: t.textFaint }}>VS</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontFamily: MONO, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', color: t.textMuted }}>{activeCard.teamB}</span>
                      <span style={{ fontFamily: MONO, fontSize: activeCard.suffixB ? '2.25rem' : '3rem', fontWeight: 800, lineHeight: 1, color: t.blue }}>
                        {activeCard.scoreB}{activeCard.suffixB && <span style={{ fontSize: '1.25rem', fontWeight: 600, color: t.textMuted }}>{activeCard.suffixB}</span>}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: '0.6875rem', color: t.textMuted, textAlign: 'center', letterSpacing: '0.1em', paddingTop: 12, borderTop: `1px solid ${t.border}` }}>
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
        style={{ background: t.borderStrong, color: t.bg, padding: mobile ? '10px 0' : '14px 0', overflow: 'hidden', cursor: 'pointer' }}
        onMouseEnter={() => setTickerPaused(true)}
        onMouseLeave={() => setTickerPaused(false)}
        onClick={handleTickerClick}
      >
        <div ref={tickerRef} style={{ display: 'flex', whiteSpace: 'nowrap', width: 'max-content' }}>
          {[0, 1].map(copy => (
            <div key={copy} style={{ display: 'flex', gap: mobile ? 16 : 40, paddingRight: mobile ? 16 : 40 }}>
              {tickerItems.map((item) => (
                <span key={`${copy}-${item}`} style={{ fontFamily: MONO, fontSize: mobile ? '0.625rem' : '0.75rem', letterSpacing: '0.12em', fontWeight: 600, flexShrink: 0 }}>
                  {item}<span style={{ margin: mobile ? '0 8px' : '0 20px', opacity: 0.3 }}>&#9670;</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ FEATURES ═══ */}
      <section id="features" style={{ padding: mobile ? '36px 0' : '80px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: `0 ${px}px` }}>
          <p style={{ fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.12em', color: t.textFaint, marginBottom: mobile ? 8 : 12 }}>01 / FEATURES</p>
          <h2 style={{ fontWeight: 900, fontSize: mobile ? 'clamp(1.75rem, 8vw, 2.5rem)' : 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 0.95, letterSpacing: '-0.03em', margin: mobile ? '0 0 24px 0' : '0 0 40px 0', color: t.text }}>
            EVERYTHING<br />YOU NEED.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: 2 }}>
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
              const fIconColor = t.featureIconColor || t.text;
              const fIconHoverColor = t.featureIconHoverColor || t.blue;
              return (
                <div
                  key={f.tag}
                  style={{
                    border: `${t.borderWeight} solid ${isHovered ? fHoverBorder : fBorder}`,
                    padding: mobile ? 20 : 28, cursor: 'default',
                    transition: `all ${t.transitionSpeed} ease`,
                    background: isHovered ? fHoverBg : fBg,
                    color: isHovered ? fHoverColor : fTextColor,
                    position: 'relative', overflow: 'hidden',
                    boxShadow: t.cardShadow,
                  }}
                  {...interactionHandlers(i, setHoveredFeature, hoveredFeature)}
                >
                  <div style={{
                    position: 'absolute', bottom: mobile ? -10 : -15, right: mobile ? -10 : -15,
                    opacity: isHovered ? (t.iconWatermarkHover || 0.6) : (t.iconWatermarkOpacity || 0.07),
                    transition: 'opacity 400ms ease', transform: 'rotate(-5deg)',
                  }}>
                    <SportIcon name={f.icon} size={mobile ? 80 : 120} color={isHovered ? fIconHoverColor : fIconColor} />
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
          <p style={{ fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.12em', color: t.textFaint, marginBottom: mobile ? 8 : 12 }}>02 / SPORTS</p>
          <h2 style={{ fontWeight: 900, fontSize: mobile ? 'clamp(1.75rem, 8vw, 2.5rem)' : 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 0.95, letterSpacing: '-0.03em', margin: mobile ? '0 0 24px 0' : '0 0 40px 0', color: t.text }}>
            14 SPORTS.<br />YOUR RULES.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)', gap: mobile ? 2 : 4 }}>
            {sports.map((sp, i) => {
              const isHovered = hoveredSport === i;
              const sBg = t.sportBg || t.surface;
              const sHoverBg = t.sportHoverBg || t.blue;
              const sHoverColor = t.sportHoverColor || '#fff';
              const sIconColor = t.sportIconColor || t.text;
              const sHoverIconColor = t.sportHoverIconColor || '#fff';
              const sTextColor = t.sportTextColor || t.text;
              const sBorderStyle = t.sportBorderStyle || 'dashed';
              const sBorderColor = t.sportBorderColor || '#d0d0d0';
              return (
                <div
                  key={sp}
                  style={{
                    position: 'relative',
                    border: `1.5px ${sBorderStyle} ${isHovered ? sHoverBg : sBorderColor}`,
                    padding: mobile ? '14px 8px' : '20px 14px', textAlign: 'center', cursor: 'default',
                    transition: `all ${t.transitionSpeed} ease`,
                    background: isHovered ? sHoverBg : sBg,
                    color: isHovered ? sHoverColor : sTextColor,
                  }}
                  {...interactionHandlers(i, setHoveredSport, hoveredSport)}
                >
                  <Cross top={2} left={4} />
                  <Cross top={2} right={4} />
                  <Cross bottom={2} left={4} />
                  <Cross bottom={2} right={4} />
                  <div style={{ marginBottom: mobile ? 6 : 10, display: 'flex', justifyContent: 'center' }}>
                    <SportIcon name={sp} size={mobile ? 28 : 40} color={isHovered ? sHoverIconColor : sIconColor} />
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: mobile ? '0.5rem' : '0.5625rem', letterSpacing: '0.08em', fontWeight: 600 }}>
                    {sp.toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ THREE STEPS ═══ */}
      <section id="how" style={{ padding: mobile ? '36px 0' : '80px 0', borderTop: `${t.borderWeight} solid ${t.borderStrong}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: `0 ${px}px` }}>
          <p style={{ fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.12em', color: t.textFaint, marginBottom: mobile ? 8 : 12 }}>03 / HOW IT WORKS</p>
          <h2 style={{ fontWeight: 900, fontSize: mobile ? 'clamp(1.75rem, 8vw, 2.5rem)' : 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 0.95, letterSpacing: '-0.03em', margin: mobile ? '0 0 24px 0' : '0 0 40px 0', color: t.text }}>
            THREE STEPS.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: 2 }}>
            {steps.map((step, i) => {
              const isHovered = hoveredStep === i;
              const restTransform = t.stepIconRest || 'rotate(6deg) scale(1)';
              const hoverTransform = t.stepIconHover || 'rotate(6deg) scale(1.3)';
              const restOpacity = t.iconDecoOpacity * 1.8;
              const hoverOpacity = t.stepIconOpacityHover || 0.45;
              const iconColor = isHovered && t.stepIconColorHover ? t.stepIconColorHover : t.text;
              return (
                <div
                  key={step.num}
                  style={{
                    border: `${t.borderWeight} solid ${t.borderStrong}`, padding: mobile ? 20 : 32,
                    position: 'relative', overflow: 'hidden', boxShadow: t.cardShadow, cursor: 'default',
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
                  <span style={{ fontFamily: MONO, fontSize: mobile ? t.stepNumSizeMobile : t.stepNumSize, fontWeight: 900, color: t.blue, lineHeight: 1, display: 'block' }}>{step.num}</span>
                  <h3 style={{ fontFamily: MONO, fontSize: mobile ? '0.75rem' : '0.875rem', fontWeight: 700, letterSpacing: '0.06em', margin: mobile ? '12px 0 6px 0' : '16px 0 8px 0', color: t.text }}>{step.title}</h3>
                  <p style={{ fontSize: mobile ? '0.8125rem' : '0.875rem', lineHeight: 1.5, color: t.textSoft, margin: 0 }}>{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section style={{ background: t.borderStrong, color: t.bg, padding: mobile ? '48px 16px' : '80px 32px', textAlign: 'center' }}>
        <h2 style={{ fontWeight: 900, fontSize: mobile ? 'clamp(2.5rem, 12vw, 4rem)' : 'clamp(3rem, 7vw, 6rem)', lineHeight: 0.9, letterSpacing: '-0.04em', margin: '0 0 24px 0' }}>
          READY?
        </h2>
        <div style={{ display: 'flex', gap: mobile ? 10 : 16, justifyContent: 'center', flexDirection: mobile ? 'column' : 'row', alignItems: 'center' }}>
          <Link to="/play" style={{
            fontFamily: MONO, fontSize: mobile ? '0.75rem' : '0.8125rem', fontWeight: 700,
            padding: mobile ? '12px 24px' : '14px 28px', letterSpacing: '0.05em', textDecoration: 'none',
            background: t.blue, color: '#fff', border: `2px solid ${t.blue}`,
            width: mobile ? '100%' : 'auto', textAlign: 'center', maxWidth: mobile ? 280 : 'none',
          }}>
            START SCORING
          </Link>
          {cloudAuthAvailable && (
            <Link to="/signup" style={{
              fontFamily: MONO, fontSize: mobile ? '0.75rem' : '0.8125rem', fontWeight: 700,
              padding: mobile ? '12px 24px' : '14px 28px', letterSpacing: '0.05em', textDecoration: 'none',
              background: 'transparent', color: t.bg, border: `2px solid ${t.bg}`,
              width: mobile ? '100%' : 'auto', textAlign: 'center', maxWidth: mobile ? 280 : 'none',
            }}>
              SIGN UP FREE
            </Link>
          )}
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{
        padding: mobile ? '16px' : '24px 32px', borderTop: `${t.borderWeight} solid ${t.borderStrong}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        maxWidth: 1200, margin: '0 auto',
      }}>
        <span style={{ fontFamily: MONO, fontSize: mobile ? '0.625rem' : '0.75rem', fontWeight: 700, color: t.text }}>SCORE EASY</span>
        <span style={{ fontFamily: MONO, fontSize: mobile ? '0.5625rem' : '0.6875rem', color: t.textMuted }}>&copy; 2025</span>
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

export const fontStacks = {
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

export const prioritySports = ['cricket', 'football', 'volleyball'];

export const sportAccents = {
  cricket: {
    name: 'Cricket',
    primary: '#0066ff',
    soft: '#eaf2ff',
    field: '#16a34a',
  },
  football: {
    name: 'Football',
    primary: '#14b8a6',
    soft: '#e6fffb',
    field: '#15803d',
  },
  volleyball: {
    name: 'Volleyball',
    primary: '#f97316',
    soft: '#fff3e8',
    field: '#0ea5e9',
  },
  racquet: {
    name: 'Racquet Sports',
    primary: '#7c3aed',
    soft: '#f3edff',
    field: '#2563eb',
  },
};

export const sportsTokens = {
  color: {
    action: sportAccents.cricket.primary,
    actionSoft: sportAccents.cricket.soft,
    actionStrong: '#004fd6',
    canvas: '#fbfcf8',
    surface: '#ffffff',
    surfaceWarm: '#f7faf2',
    ink: '#1a1a1a',
    inkStrong: '#111111',
    inkSoft: '#666666',
    inkMuted: '#8a8a8a',
    inkFaint: '#b8b8b8',
    line: '#deded6',
    lineStrong: '#1a1a1a',
    success: '#15803d',
    successSoft: '#e8f7ed',
    warning: '#f97316',
    warningSoft: '#fff3e8',
    court: '#16a34a',
    courtSoft: '#eff8e9',
    sky: '#0ea5e9',
    skySoft: '#e8f7ff',
    inverse: '#ffffff',
  },
  border: {
    hairline: '1px',
    standard: '1.5px',
    heavy: '2px',
    strongStyle: '1.5px solid #1a1a1a',
    subtleStyle: '1px solid #deded6',
  },
  radius: {
    none: '0',
    xs: '4px',
    sm: '6px',
    md: '8px',
    pill: '999px',
  },
  shadow: {
    card: '0 1px 3px rgba(17, 24, 39, 0.06)',
    lifted: '0 14px 32px rgba(17, 24, 39, 0.10)',
    hard: '5px 5px 0 #1a1a1a',
  },
  space: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  type: {
    label: {
      family: fontStacks.mono,
      letterSpacing: '0.08em',
      weight: 800,
    },
    body: {
      family: fontStacks.sans,
      letterSpacing: '0',
      weight: 400,
    },
  },
  motion: {
    fast: '150ms',
    standard: '250ms',
    slow: '360ms',
    ease: 'cubic-bezier(0.2, 0, 0, 1)',
  },
  component: {
    appShell: {
      background: '#fbfcf8',
      chrome: '#ffffff',
      navHeight: '64px',
    },
    button: {
      height: '52px',
      minTouchTarget: '44px',
      radius: '0',
    },
    card: {
      radius: '0',
      border: '1px solid #deded6',
      shadow: '0 1px 3px rgba(17, 24, 39, 0.06)',
    },
    scoreTile: {
      radius: '6px',
      border: '1.5px solid #1a1a1a',
      activeShadow: '5px 5px 0 #1a1a1a',
    },
  },
};

export function getSportAccent(sportId) {
  return sportAccents[sportId] ?? {
    name: 'Sport',
    primary: sportsTokens.color.action,
    soft: sportsTokens.color.actionSoft,
    field: sportsTokens.color.court,
  };
}

export const sportsCssVariables = {
  '--se-font-mono': fontStacks.mono,
  '--se-font-sans': fontStacks.sans,
  '--se-color-action': sportsTokens.color.action,
  '--se-color-action-soft': sportsTokens.color.actionSoft,
  '--se-color-action-strong': sportsTokens.color.actionStrong,
  '--se-color-canvas': sportsTokens.color.canvas,
  '--se-color-surface': sportsTokens.color.surface,
  '--se-color-ink': sportsTokens.color.ink,
  '--se-color-ink-strong': sportsTokens.color.inkStrong,
  '--se-color-ink-soft': sportsTokens.color.inkSoft,
  '--se-color-ink-muted': sportsTokens.color.inkMuted,
  '--se-color-ink-faint': sportsTokens.color.inkFaint,
  '--se-color-line': sportsTokens.color.line,
  '--se-color-line-strong': sportsTokens.color.lineStrong,
  '--se-color-inverse': sportsTokens.color.inverse,
  '--se-border-standard': sportsTokens.border.standard,
  '--se-shadow-card': sportsTokens.shadow.card,
  '--se-shadow-hard': sportsTokens.shadow.hard,
  '--se-motion-standard': sportsTokens.motion.standard,
};

export const landingTokenBridge = {
  blue: sportsTokens.color.action,
  blueLight: sportsTokens.color.actionSoft,
  green: sportsTokens.color.success,
  greenLight: sportsTokens.color.successSoft,
  orange: sportsTokens.color.warning,
  orangeLight: sportsTokens.color.warningSoft,
  bg: sportsTokens.color.canvas,
  surface: sportsTokens.color.surface,
  text: sportsTokens.color.ink,
  textSoft: sportsTokens.color.inkSoft,
  textMuted: sportsTokens.color.inkMuted,
  textFaint: sportsTokens.color.inkFaint,
  border: sportsTokens.color.line,
  borderStrong: sportsTokens.color.lineStrong,
  borderWeight: sportsTokens.border.standard,
  iconDecoOpacity: 0.14,
  tagStyle: 'filled',
  stepNumSize: '2.75rem',
  stepNumSizeMobile: '2rem',
  transitionSpeed: sportsTokens.motion.standard,
  cardShadow: sportsTokens.shadow.card,
  r: sportsTokens.radius.sm,
};

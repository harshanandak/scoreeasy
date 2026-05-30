export const fontStacks = {
  mono: "'JetBrains Mono', ui-monospace, monospace",
  sans: "Inter, ui-sans-serif, sans-serif, system-ui",
  serif: "Merriweather, ui-serif, serif",
};

export const prioritySports = ['cricket', 'football', 'volleyball'];

const palette = {
  fieldGreen: 'oklch(0.6230 0.1688 149.1777)',
  fieldGreenSoft: 'oklch(0.9231 0.0773 156.7494)',
  fieldGreenStrong: 'oklch(0.4104 0.1066 149.9393)',
  pitchBrown: 'oklch(0.6082 0.1213 58.2537)',
  pitchBrownSoft: 'oklch(0.9398 0.0035 145.5478)',
  pitchBrownDeep: 'oklch(0 0 0)',
  warmWhite: 'oklch(0.9782 0.0039 145.5458)',
  chalkWhite: 'oklch(0.9855 0.0026 145.5558)',
};

export const sportAccents = {
  cricket: {
    name: 'Cricket',
    primary: palette.fieldGreen,
    soft: palette.fieldGreenSoft,
    field: palette.pitchBrown,
  },
  football: {
    name: 'Football',
    primary: palette.fieldGreen,
    soft: palette.fieldGreenSoft,
    field: palette.pitchBrown,
  },
  volleyball: {
    name: 'Volleyball',
    primary: palette.fieldGreen,
    soft: palette.fieldGreenSoft,
    field: palette.pitchBrown,
  },
  racquet: {
    name: 'Racquet Sports',
    primary: palette.pitchBrown,
    soft: palette.pitchBrownSoft,
    field: palette.fieldGreen,
  },
};

export const sportsTokens = {
  color: {
    action: sportAccents.cricket.primary,
    actionSoft: sportAccents.cricket.soft,
    actionStrong: palette.fieldGreenStrong,
    canvas: palette.warmWhite,
    surface: palette.chalkWhite,
    surfaceWarm: palette.pitchBrownSoft,
    ink: palette.pitchBrownDeep,
    inkStrong: 'oklch(0 0 0)',
    inkSoft: 'oklch(0.3211 0 0)',
    inkMuted: 'oklch(0.5103 0 0)',
    inkFaint: 'oklch(0.5103 0 0)',
    line: 'oklch(0 0 0)',
    lineStrong: palette.pitchBrownDeep,
    success: palette.fieldGreen,
    successSoft: palette.fieldGreenSoft,
    danger: 'oklch(0.5308 0.2178 29.2339)',
    dangerSoft: 'oklch(0.932 0.043 28.6)',
    warning: palette.pitchBrown,
    warningSoft: palette.pitchBrownSoft,
    court: palette.fieldGreen,
    courtSoft: palette.fieldGreenSoft,
    sky: palette.pitchBrown,
    skySoft: palette.pitchBrownSoft,
    inverse: palette.chalkWhite,
  },
  border: {
    hairline: '1px',
    standard: '1px',
    heavy: '2px',
    strongStyle: `1.5px solid ${palette.pitchBrownDeep}`,
    subtleStyle: '1px solid oklch(0 0 0)',
  },
  radius: {
    none: '0',
    xs: '4px',
    sm: '4px',
    md: '6px',
    lg: '8px',
    pill: '999px',
  },
  shadow: {
    card: '3px 3px 0px 0.5px hsl(0 0% 0% / 0.35)',
    lifted: '3px 3px 0px 0.5px hsl(0 0% 0% / 0.70), 3px 2px 4px -0.5px hsl(0 0% 0% / 0.70)',
    hard: '3px 3px 0px 0.5px hsl(0 0% 0% / 0.70)',
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
      background: palette.warmWhite,
      chrome: palette.chalkWhite,
      navHeight: '64px',
    },
    button: {
      height: '52px',
      minTouchTarget: '44px',
      radius: 'calc(var(--radius) + 4px)',
    },
    card: {
      radius: 'calc(var(--radius) + 4px)',
      border: '1px solid oklch(0 0 0)',
      shadow: '3px 3px 0px 0.5px hsl(0 0% 0% / 0.35)',
    },
    scoreTile: {
      radius: '8px',
      border: `1.5px solid ${palette.pitchBrownDeep}`,
      activeShadow: `5px 5px 0 ${palette.pitchBrownDeep}`,
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

function getRelativeLuminanceFromHex(hexColor) {
  const clean = String(hexColor || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null;

  const [red, green, blue] = [0, 2, 4].map((index) => {
    const channel = Number.parseInt(clean.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function getRelativeLuminanceFromOklch(color) {
  const value = String(color || '').trim();
  if (!value.toLowerCase().startsWith('oklch(') || !value.endsWith(')')) return null;

  const channels = value.slice(6, -1).split('/')[0].trim().split(/\s+/);
  if (channels.length !== 3) return null;

  const [lightnessValue, chromaValue, hueValue] = channels;
  if (!/^\d+(\.\d+)?%?$/.test(lightnessValue)) return null;
  if (!/^\d+(\.\d+)?$/.test(chromaValue)) return null;
  if (!/^\d+(\.\d+)?(deg)?$/i.test(hueValue)) return null;

  const lightness = lightnessValue.endsWith('%') ? Number.parseFloat(lightnessValue) / 100 : Number.parseFloat(lightnessValue);
  const chroma = Number.parseFloat(chromaValue);
  const hueRadians = Number.parseFloat(hueValue.replace(/deg$/i, '')) * (Math.PI / 180);

  if (![lightness, chroma, hueRadians].every(Number.isFinite)) return null;

  const a = chroma * Math.cos(hueRadians);
  const b = chroma * Math.sin(hueRadians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const red = Math.min(Math.max(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, 0), 1);
  const green = Math.min(Math.max(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, 0), 1);
  const blue = Math.min(Math.max(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s, 0), 1);

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function getReadableTextColor(color) {
  const luminance = getRelativeLuminanceFromHex(color) ?? getRelativeLuminanceFromOklch(color);
  if (luminance === null) return sportsTokens.color.inverse;

  const contrastWithInk = (luminance + 0.05) / 0.05;
  const contrastWithInverse = 1.05 / (luminance + 0.05);

  return contrastWithInk >= contrastWithInverse ? sportsTokens.color.inkStrong : sportsTokens.color.inverse;
}

export const sportsCssVariables = {
  '--se-font-mono': fontStacks.mono,
  '--se-font-sans': fontStacks.sans,
  '--se-color-action': sportsTokens.color.action,
  '--se-color-action-soft': sportsTokens.color.actionSoft,
  '--se-color-action-strong': sportsTokens.color.actionStrong,
  '--se-color-canvas': sportsTokens.color.canvas,
  '--se-color-surface': sportsTokens.color.surface,
  '--se-color-surface-warm': sportsTokens.color.surfaceWarm,
  '--se-color-ink': sportsTokens.color.ink,
  '--se-color-ink-strong': sportsTokens.color.inkStrong,
  '--se-color-ink-soft': sportsTokens.color.inkSoft,
  '--se-color-ink-muted': sportsTokens.color.inkMuted,
  '--se-color-ink-faint': sportsTokens.color.inkFaint,
  '--se-color-line': sportsTokens.color.line,
  '--se-color-line-strong': sportsTokens.color.lineStrong,
  '--se-color-warning': sportsTokens.color.warning,
  '--se-color-warning-soft': sportsTokens.color.warningSoft,
  '--se-color-danger': sportsTokens.color.danger,
  '--se-color-danger-soft': sportsTokens.color.dangerSoft,
  '--se-color-inverse': sportsTokens.color.inverse,
  '--se-border-standard': sportsTokens.border.standard,
  '--se-radius-button': sportsTokens.component.button.radius,
  '--se-radius-card': sportsTokens.component.card.radius,
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
  r: sportsTokens.radius.lg,
};

import { fontStacks, landingTokenBridge } from '../theme/sportsTokens';

export const MONO = fontStacks.mono;
export const SWISS = fontStacks.sans;

const winningColors = {
  featureBg: landingTokenBridge.surface,
  featureBorder: landingTokenBridge.border,
  featureHoverBg: 'color-mix(in oklch, var(--se-color-ink) 90%, var(--se-color-surface))',
  featureHoverColor: landingTokenBridge.inverse,
  featureHoverTextSoft: 'color-mix(in oklch, var(--se-color-inverse) 72%, var(--se-color-ink))',
  featureHoverBorder: landingTokenBridge.borderStrong,
  featureIconColor: landingTokenBridge.text,
  featureIconHoverColor: landingTokenBridge.blue,
  iconWatermarkOpacity: 0.07,
  iconWatermarkHover: 0.28,
  sportBg: landingTokenBridge.surface,
  sportBorderStyle: 'dashed',
  sportBorderColor: 'color-mix(in oklch, var(--se-color-line) 32%, var(--se-color-surface))',
  sportHoverBg: 'color-mix(in oklch, var(--se-color-action-soft) 34%, var(--se-color-surface))',
  sportHoverBorder: landingTokenBridge.blue,
  sportHoverColor: landingTokenBridge.text,
  sportHoverTextSoft: landingTokenBridge.textMuted,
  sportIconColor: landingTokenBridge.text,
  sportHoverIconColor: landingTokenBridge.blue,
  sportTextColor: landingTokenBridge.text,
};

const finalTheme = {
  ...landingTokenBridge,
  ...winningColors,
  stepIconRest: 'rotate(6deg) translateY(0) scale(1)',
  stepIconHover: 'rotate(0deg) translateY(-6px) scale(1.12)',
  stepIconOpacityHover: 0.22,
  stepIconColorHover: landingTokenBridge.blue,
};

export default finalTheme;

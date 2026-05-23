import { fontStacks, landingTokenBridge } from '../theme/sportsTokens';

export const MONO = fontStacks.mono;
export const SWISS = fontStacks.sans;

const winningColors = {
  featureBg: landingTokenBridge.surface,
  featureBorder: landingTokenBridge.border,
  featureHoverBg: landingTokenBridge.text,
  featureHoverColor: '#fff',
  featureHoverTextSoft: '#ccc',
  featureHoverBorder: landingTokenBridge.text,
  featureIconColor: landingTokenBridge.text,
  featureIconHoverColor: landingTokenBridge.blue,
  iconWatermarkOpacity: 0.07,
  iconWatermarkHover: 0.6,
  sportBg: landingTokenBridge.surface,
  sportBorderStyle: 'dashed',
  sportBorderColor: landingTokenBridge.border,
  sportHoverBg: landingTokenBridge.text,
  sportHoverColor: '#fff',
  sportIconColor: landingTokenBridge.text,
  sportHoverIconColor: landingTokenBridge.blue,
  sportTextColor: landingTokenBridge.text,
};

const finalTheme = {
  ...landingTokenBridge,
  ...winningColors,
  stepIconRest: 'rotate(6deg) translateY(0) scale(1)',
  stepIconHover: 'rotate(0deg) translateY(-8px) scale(1.25)',
  stepIconOpacityHover: 0.6,
  stepIconColorHover: null,
};

export default finalTheme;

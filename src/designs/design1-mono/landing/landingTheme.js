export const MONO = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
export const SWISS = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const warmBase = {
  blue: '#0066ff',
  bg: '#fafafa',
  surface: '#ffffff',
  text: '#1a1a1a',
  textSoft: '#666',
  textMuted: '#999',
  textFaint: '#bbb',
  border: '#e0e0e0',
  borderStrong: '#1a1a1a',
  borderWeight: '1.5px',
  iconDecoOpacity: 0.14,
  tagStyle: 'filled',
  stepNumSize: '2.75rem',
  stepNumSizeMobile: '2rem',
  transitionSpeed: '250ms',
  cardShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const winningColors = {
  featureBg: warmBase.surface,
  featureBorder: warmBase.border,
  featureHoverBg: '#1a1a1a',
  featureHoverColor: '#fff',
  featureHoverTextSoft: '#ccc',
  featureHoverBorder: '#1a1a1a',
  featureIconColor: warmBase.text,
  featureIconHoverColor: '#0066ff',
  iconWatermarkOpacity: 0.07,
  iconWatermarkHover: 0.6,
  sportBg: warmBase.surface,
  sportBorderStyle: 'dashed',
  sportBorderColor: '#d0d0d0',
  sportHoverBg: '#1a1a1a',
  sportHoverColor: '#fff',
  sportIconColor: warmBase.text,
  sportHoverIconColor: '#0066ff',
  sportTextColor: warmBase.text,
};

const finalTheme = {
  ...warmBase,
  ...winningColors,
  stepIconRest: 'rotate(6deg) translateY(0) scale(1)',
  stepIconHover: 'rotate(0deg) translateY(-8px) scale(1.25)',
  stepIconOpacityHover: 0.6,
  stepIconColorHover: null,
};

export default finalTheme;

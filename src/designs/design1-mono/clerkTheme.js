// Clerk appearance themed to the Kit (the look of Home, setup and the boards), so the sign-in and
// sign-up cards read as part of the app and not as a foreign widget.
//
// `variables` take literal colours (Clerk derives shades from them), so they carry the light Kit
// values. Every `elements` rule uses the --se-* tokens instead, so a dark theme is a token swap
// and the card follows the page. The frame (MonoAuthPageFrame) supplies the surface, so Clerk's
// own card is transparent, flat and full width.
const GO_GREEN = '#007c34'; // --se-color-action-hi, the Go gradient's lit edge
const INK = '#0b0b0d'; // --foreground
const INK_SOFT = '#4a4b52'; // --se-color-ink-soft
const SURFACE = '#ffffff'; // --card

const HAIRLINE = 'inset 0 0 0 1px color-mix(in srgb, var(--se-color-ink) 16%, transparent)';
const FOCUS_RING = '0 0 0 3px var(--se-color-canvas), 0 0 0 5px var(--se-color-ink)';

/* The same edge, lift and radius as .se-ctl, for Clerk's own buttons. */
const controlEdge = {
  border: 'var(--se-ctl-border) solid var(--se-color-ink) !important',
  borderRadius: 'var(--se-ctl-radius)',
  boxShadow: 'var(--se-ctl-shadow) !important',
  minHeight: '48px',
  color: 'var(--se-color-ink)',
  backgroundColor: 'var(--se-ctl-bg)',
  fontWeight: 700,
  "&:hover": { backgroundColor: 'var(--se-color-surface-warm)' },
  "&:focus-visible": { boxShadow: `${FOCUS_RING} !important` },
  "&:active": { transform: 'translate(2px, 2px)', boxShadow: 'var(--se-ctl-shadow-press) !important' },
};

export const monoClerkAppearance = {
  variables: {
    colorPrimary: GO_GREEN,
    colorDanger: '#b42318',
    colorText: INK,
    colorTextSecondary: INK_SOFT,
    colorBackground: SURFACE,
    colorInputBackground: SURFACE,
    colorInputText: INK,
    borderRadius: '0.875rem',
    fontFamily: 'var(--se-font-sans)',
    fontSize: '1rem',
  },
  elements: {
    rootBox: {
      width: '100%',
    },
    cardBox: {
      width: '100%',
      maxWidth: '100%',
      border: '0',
      borderRadius: '0',
      boxShadow: 'none',
      backgroundColor: 'transparent',
    },
    card: {
      width: '100%',
      maxWidth: '100%',
      padding: '20px 16px 8px',
      border: '0',
      borderRadius: '0',
      boxShadow: 'none',
      backgroundColor: 'transparent',
      color: 'var(--se-color-ink)',
    },
    header: {
      display: 'none',
    },
    headerTitle: {
      display: 'none',
    },
    headerSubtitle: {
      display: 'none',
    },
    socialButtonsBlockButton: {
      ...controlEdge,
      padding: '0 12px',
      fontSize: '1rem',
    },
    socialButtonsBlockButtonText: {
      fontWeight: 700,
      color: 'var(--se-color-ink)',
    },
    dividerLine: {
      backgroundColor: 'var(--se-color-line-soft)',
    },
    dividerText: {
      color: 'var(--se-color-ink-soft)',
      fontSize: '0.85rem',
      fontWeight: 600,
    },
    formFieldLabel: {
      color: 'var(--se-color-ink)',
      fontSize: '0.9rem',
      fontWeight: 700,
    },
    formFieldInput: {
      minHeight: '48px',
      padding: '0 14px',
      border: '0',
      borderRadius: '14px',
      boxShadow: HAIRLINE,
      backgroundColor: 'var(--se-color-surface)',
      color: 'var(--se-color-ink)',
      fontSize: '1rem',
      fontWeight: 550,
      "&::placeholder": { color: 'var(--se-color-ink-muted)' },
      "&:focus": { boxShadow: FOCUS_RING },
    },
    formFieldInputShowPasswordButton: {
      color: 'var(--se-color-ink-soft)',
    },
    formFieldHintText: {
      color: 'var(--se-color-ink-soft)',
    },
    formFieldErrorText: {
      color: 'var(--se-color-danger)',
      fontWeight: 600,
    },
    // The Go: same gradient, edge and lift as the app's primary button.
    formButtonPrimary: {
      minHeight: '56px',
      border: 'var(--se-ctl-border) solid var(--se-go-edge) !important',
      borderRadius: 'var(--se-ctl-radius)',
      boxShadow: 'var(--se-ctl-shadow) !important',
      background: 'linear-gradient(168deg, var(--se-color-action-hi), var(--se-color-action) 55%, var(--se-color-action-strong))',
      color: 'var(--se-color-inverse)',
      fontSize: '1.06rem',
      fontWeight: 800,
      textTransform: 'none',
      "&:hover": { background: 'linear-gradient(168deg, var(--se-color-action-hi), var(--se-color-action) 55%, var(--se-color-action-strong))', filter: 'brightness(1.06)' },
      "&:focus-visible": { boxShadow: `${FOCUS_RING} !important` },
      "&:active": { transform: 'translate(2px, 2px)', boxShadow: 'var(--se-ctl-shadow-press) !important' },
    },
    footer: {
      backgroundColor: 'transparent',
      backgroundImage: 'none',
    },
    footerAction: {
      backgroundColor: 'transparent',
    },
    footerActionText: {
      color: 'var(--se-color-ink-soft)',
      fontWeight: 550,
    },
    footerActionLink: {
      color: 'var(--se-color-ink)',
      fontWeight: 800,
      textDecoration: 'underline',
      textUnderlineOffset: '3px',
      "&:hover": { color: 'var(--se-color-action)' },
    },
    footerPages: {
      color: 'var(--se-color-ink-soft)',
    },
    identityPreview: {
      border: '0',
      borderRadius: '14px',
      boxShadow: HAIRLINE,
      backgroundColor: 'var(--se-color-surface)',
    },
    identityPreviewText: {
      color: 'var(--se-color-ink)',
    },
    identityPreviewEditButton: {
      color: 'var(--se-color-ink)',
      fontWeight: 700,
    },
    alert: {
      borderRadius: '14px',
    },
    badge: {
      borderRadius: '999px',
    },
  },
};

// Clerk appearance config themed to match the Mono design system
const ACTION = "oklch(0.6230 0.1688 149.1777)";
const ACTION_HOVER = "oklch(0.4104 0.1066 149.9393)";
const ACTION_SOFT = "oklch(0.9231 0.0773 156.7494)";
const SURFACE = "oklch(0.9855 0.0026 145.5558)";
const CANVAS = "oklch(0.9782 0.0039 145.5458)";
const INK = "oklch(0 0 0)";
const MUTED = "oklch(0.5103 0 0)";

export const monoClerkAppearance = {
  variables: {
    colorPrimary: ACTION,
    colorDanger: "#dc2626",
    colorText: INK,
    colorTextSecondary: MUTED,
    colorBackground: SURFACE,
    colorInputBackground: SURFACE,
    colorInputText: INK,
    borderRadius: "4px",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "14px",
  },
  elements: {
    rootBox: {
      width: "100%",
    },
    card: {
      boxShadow: "none",
      border: "0",
      borderRadius: "8px",
      padding: "32px",
    },
    headerTitle: {
      display: "none",
    },
    headerSubtitle: {
      display: "none",
    },
    formButtonPrimary: {
      backgroundColor: ACTION,
      borderRadius: "4px",
      fontWeight: "500",
      textTransform: "none",
      fontSize: "14px",
      padding: "12px 16px",
      "&:hover": {
        backgroundColor: ACTION_HOVER,
      },
    },
    formFieldInput: {
      borderRadius: "4px",
      borderColor: INK,
      padding: "10px 12px",
      backgroundColor: CANVAS,
      "&:focus": {
        borderColor: ACTION,
        boxShadow: `0 0 0 3px ${ACTION_SOFT}`,
      },
    },
    formFieldLabel: {
      fontSize: "12px",
      fontWeight: "400",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: MUTED,
    },
    socialButtonsBlockButton: {
      borderRadius: "4px",
      border: `1px solid ${INK}`,
      padding: "12px 16px",
      fontSize: "14px",
      "&:hover": {
        backgroundColor: CANVAS,
      },
    },
    dividerLine: {
      backgroundColor: "#eeeeee",
    },
    dividerText: {
      color: MUTED,
      fontSize: "12px",
      textTransform: "lowercase",
    },
    footerActionLink: {
      color: ACTION,
      "&:hover": {
        color: ACTION_HOVER,
      },
    },
    footer: {
      "& + div": {
        display: "none",
      },
    },
    identityPreview: {
      borderRadius: "4px",
    },
    badge: {
      borderRadius: "4px",
    },
  },
};

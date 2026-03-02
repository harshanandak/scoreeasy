// Clerk appearance config themed to match the Mono design system
export const monoClerkAppearance = {
  variables: {
    colorPrimary: "#0066ff",
    colorDanger: "#dc2626",
    colorText: "#111111",
    colorTextSecondary: "#888888",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#111111",
    borderRadius: "0px",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "14px",
  },
  elements: {
    rootBox: {
      width: "100%",
    },
    card: {
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      border: "1px solid #eeeeee",
      borderRadius: "0",
      padding: "32px",
    },
    headerTitle: {
      display: "none",
    },
    headerSubtitle: {
      display: "none",
    },
    formButtonPrimary: {
      backgroundColor: "#0066ff",
      borderRadius: "0",
      fontWeight: "500",
      textTransform: "none",
      fontSize: "14px",
      padding: "12px 16px",
      "&:hover": {
        backgroundColor: "#0052cc",
      },
    },
    formFieldInput: {
      borderRadius: "0",
      borderColor: "#dddddd",
      padding: "10px 12px",
      "&:focus": {
        borderColor: "#0066ff",
        boxShadow: "none",
      },
    },
    formFieldLabel: {
      fontSize: "12px",
      fontWeight: "400",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "#888888",
    },
    socialButtonsBlockButton: {
      borderRadius: "0",
      border: "1px solid #dddddd",
      padding: "12px 16px",
      fontSize: "14px",
      "&:hover": {
        backgroundColor: "#f5f5f5",
      },
    },
    dividerLine: {
      backgroundColor: "#eeeeee",
    },
    dividerText: {
      color: "#888888",
      fontSize: "12px",
      textTransform: "lowercase",
    },
    footerActionLink: {
      color: "#0066ff",
      "&:hover": {
        color: "#0052cc",
      },
    },
    footer: {
      "& + div": {
        display: "none",
      },
    },
    identityPreview: {
      borderRadius: "0",
    },
    badge: {
      borderRadius: "0",
    },
  },
};

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
    card: {
      boxShadow: "none",
      border: "1px solid #eeeeee",
      borderRadius: "0",
    },
    headerTitle: {
      fontSize: "12px",
      fontWeight: "400",
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      color: "#888888",
    },
    headerSubtitle: {
      color: "#888888",
      fontSize: "13px",
    },
    formButtonPrimary: {
      backgroundColor: "#0066ff",
      borderRadius: "0",
      fontWeight: "500",
      textTransform: "none",
      "&:hover": {
        backgroundColor: "#0052cc",
      },
    },
    formFieldInput: {
      borderRadius: "0",
      borderColor: "#dddddd",
      "&:focus": {
        borderColor: "#0066ff",
        boxShadow: "none",
      },
    },
    socialButtonsBlockButton: {
      borderRadius: "0",
      border: "1px solid #dddddd",
      "&:hover": {
        backgroundColor: "#f5f5f5",
      },
    },
    dividerLine: {
      backgroundColor: "#dddddd",
    },
    dividerText: {
      color: "#888888",
      fontSize: "12px",
    },
    footerActionLink: {
      color: "#0066ff",
      "&:hover": {
        color: "#0052cc",
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

import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".worktrees/**",
      "convex/_generated/**",
      "android/**/build/**",
      "android/app/src/main/assets/public/**",
      "ios/App/App/public/**"
    ]
  },
  {
    files: ["**/*.{js,jsx}"],
    plugins: {
      "react-hooks": reactHooks
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    }
  }
];

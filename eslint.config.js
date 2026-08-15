import convex from "@convex-dev/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
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
      "ios/App/App/public/**",
      // Forge workflow definitions, not app source: run by the workflow
      // engine with a top-level `return`, which is a parse error for eslint.
      "docs/plans/**/*.workflow.js"
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
  },
  {
    // convex/ is the only TypeScript in the repo (src/ stays JS/JSX).
    files: ["convex/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module"
    },
    plugins: {
      "@convex-dev": convex
    },
    rules: {
      "@convex-dev/no-old-registered-function-syntax": "error",
      "@convex-dev/require-args-validator": "error",
      "@convex-dev/no-schema-import-cycle": "error",
      // TODO: raise to "error" once the 5 existing db.get/db.patch call sites
      // in matches.ts and users.ts pass an explicit table name.
      "@convex-dev/explicit-table-ids": "warn",
      "@convex-dev/no-filter-in-query": "warn",
      "@convex-dev/no-top-of-hour-crons": "warn"
    }
  }
];

import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      ".playwright/**",
      "data/**",
      "test-results/**",
      "docs/**",
      ".next-static/**",
      ".export-tmp/**",
      "out/**",
      "playwright-report/**",
      "next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: { globals: { process: "readonly" } },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      globals: { require: "readonly", process: "readonly", module: "readonly" },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);

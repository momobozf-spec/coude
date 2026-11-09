import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "src/generated/**", "node_modules/**", "coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // `any` is een ontsnapping uit het typesysteem; wie hem nodig heeft moet
      // dat expliciet motiveren met een eslint-disable-regel.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["error", { allow: ["error"] }],
      eqeqeq: ["error", "smart"],
    },
  },
  {
    // De CLI is per definitie een console-applicatie.
    files: ["src/cli/**/*.ts", "prisma/seed.ts"],
    rules: { "no-console": "off" },
  },
);

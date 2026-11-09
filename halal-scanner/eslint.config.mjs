/**
 * ESLint (flat config).
 *
 * `next lint` is in Next 16 verwijderd; het bestaande script viel terug op
 * "lint" als mapnaam en faalde stil — er werd dus feitelijk nooit gelint.
 * ESLint wordt hier rechtstreeks aangestuurd.
 *
 * `eslint-config-next/core-web-vitals` levert in v16 al een flat-config-array
 * (inclusief next/typescript en de react-hooks-regels), dus die wordt direct
 * gespreid; de FlatCompat-laag is niet nodig en werkt niet met ESLint 10.
 *
 * De twee regels die er in dit domein het meest toe doen staan op `error`:
 * een `any` die een halal-status ongemerkt van type verandert, en een
 * `console.log` die langs de gestructureerde logger met redactie heen gaat.
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import next from "eslint-config-next/core-web-vitals";

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "src/generated/**",
      "coverage/**",
      "next-env.d.ts",
      "**/*.tsbuildinfo",
    ],
  },
  js.configs.recommended,
  ...next,
  // Registreert de @typescript-eslint-plugin onder die naam. De Next-config
  // brengt de regels wel mee maar niet onder deze plugin-naam, waardoor
  // losse `@typescript-eslint/...`-overrides anders niet oplosbaar zijn.
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
    rules: {
      // `any` is een ontsnapping uit het typesysteem. In een applicatie die een
      // halal-status bepaalt is "het compileerde toevallig" geen argument.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // Alles hoort via de gestructureerde logger te gaan; die redigeert.
      "no-console": ["error", { allow: ["error", "warn"] }],
      eqeqeq: ["error", "smart"],
    },
  },
  {
    // Seed en scripts zijn per definitie console-tooling.
    files: ["prisma/**/*.ts", "scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },
  {
    // De logger ís de plek waar naar de console geschreven wordt. Elders is dat
    // een fout, hier is het de implementatie.
    files: ["src/lib/logger.ts"],
    rules: { "no-console": "off" },
  },
);

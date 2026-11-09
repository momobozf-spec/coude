import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        emerald: { DEFAULT: "#1a6b4a", dark: "#125037", light: "#e8f2ed" },
        gold: { DEFAULT: "#c9920a", light: "#fdf6e3" },
      },
      fontFamily: {
        sans: ["var(--font-nunito)", "Nunito", "system-ui", "sans-serif"],
        arabic: ["var(--font-amiri)", "Amiri", "serif"],
      },
      borderRadius: {
        card: "1.25rem",
      },
      boxShadow: {
        card: "0 2px 10px rgba(18, 80, 55, 0.08)",
        lift: "0 8px 24px rgba(18, 80, 55, 0.14)",
      },
      keyframes: {
        pulseOk: {
          "0%": { transform: "scale(1)" },
          "45%": { transform: "scale(1.06)" },
          "100%": { transform: "scale(1)" },
        },
        shakeBad: {
          "0%,100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
        popIn: {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "pulse-ok": "pulseOk 420ms ease-out",
        "shake-bad": "shakeBad 380ms ease-in-out",
        "pop-in": "popIn 220ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;

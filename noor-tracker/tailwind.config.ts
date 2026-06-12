import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        emerald: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#1a6b4a",
          800: "#155e3a",
          900: "#0f4a2e",
          950: "#082f1d",
        },
        gold: {
          50: "#fefce8",
          100: "#fef9c3",
          200: "#fef08a",
          300: "#fde047",
          400: "#facc15",
          500: "#c9920a",
          600: "#a97d08",
          700: "#856306",
          800: "#6b5005",
          900: "#513d04",
        },
      },
      fontFamily: {
        nunito: ["Nunito", "sans-serif"],
      },
      animation: {
        "star-fall": "starFall 3s ease-in forwards",
        "star-spin": "starSpin 1s ease-in-out",
        "bounce-in": "bounceIn 0.5s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
      },
      keyframes: {
        starFall: {
          "0%": { transform: "translateY(-100vh) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(100vh) rotate(720deg)", opacity: "0" },
        },
        starSpin: {
          "0%": { transform: "scale(0) rotate(0deg)" },
          "50%": { transform: "scale(1.2) rotate(180deg)" },
          "100%": { transform: "scale(1) rotate(360deg)" },
        },
        bounceIn: {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 5px rgba(201, 146, 10, 0.3)" },
          "50%": { boxShadow: "0 0 20px rgba(201, 146, 10, 0.6)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

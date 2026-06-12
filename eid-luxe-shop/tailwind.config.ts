import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Soft, warm, family-oriented palette
        // cream, sand, beige, olive green, warm brown, subtle gold
        cream: {
          50: "#fbf8f1",
          100: "#f6f0e2",
          200: "#ede4ce",
          300: "#e3d6b6",
          400: "#d4c192",
        },
        sand: {
          100: "#f0e6d2",
          200: "#e2d2ad",
          300: "#cdb888",
          400: "#b89968",
        },
        // Subtle gold — used sparingly, never flashy
        gold: {
          50: "#faf3e0",
          100: "#f1e3b8",
          200: "#e3cd87",
          300: "#c9a85a",
          400: "#a8893f",
          500: "#86692b",
        },
        // Olive instead of forest — softer, warmer, more grounded
        forest: {
          50: "#eef0e6",
          100: "#d4d9c0",
          400: "#7a8458",
          500: "#5e6b3f",
          600: "#4a5631",
          700: "#3a4527",
          800: "#2b341c",
        },
        olive: {
          50: "#f3f1e8",
          100: "#e0dcc5",
          200: "#c7c19d",
          300: "#a3a072",
          400: "#7d7d4f",
          500: "#5e6038",
          600: "#464a2a",
          700: "#33381f",
        },
        warmbrown: {
          300: "#a08661",
          400: "#856a48",
          500: "#6b5333",
          600: "#523e25",
          700: "#3d2d1a",
        },
        // Subtle terracotta accent for warmth
        clay: {
          100: "#f0d9c4",
          200: "#dfb796",
          300: "#c79670",
          400: "#a87651",
        },
      },
      fontFamily: {
        serif: ["var(--font-cormorant)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-playfair)", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 2px 14px -6px rgba(70, 74, 42, 0.06)",
        warm: "0 6px 24px -10px rgba(107, 83, 51, 0.12)",
        card: "0 1px 8px -2px rgba(107, 83, 51, 0.06)",
        // kept "luxe" alias for backwards compatibility, now muted
        luxe: "0 6px 24px -10px rgba(107, 83, 51, 0.12)",
      },
      backgroundImage: {
        "geometric-pattern": "url('/pattern.svg')",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        shimmer: "shimmer 2s infinite linear",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

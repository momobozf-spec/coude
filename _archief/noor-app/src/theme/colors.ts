export const Colors = {
  emerald: {
    50: "#edfaf3", 100: "#d3f4e3", 200: "#aae8cb", 300: "#74d5aa",
    400: "#3dc18a", 500: "#1fa168", 600: "#158353", 700: "#1a6b4a",
    800: "#145538", 900: "#0e3a27", 950: "#072015",
  },
  gold: {
    100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d",
    500: "#f59e0b", 600: "#c9920a", 700: "#a87708",
  },
  text: { primary: "#162920", secondary: "#3a5c48", muted: "#6b8f7a", subtle: "#9ab8a8" },
  bg: { primary: "#f7fbf8", surface: "#ffffff", surface2: "#f0f9f4" },
  border: "#d1e9da",
  borderSoft: "#e8f5ee",
  white: "#ffffff",
  black: "#000000",
  error: "#dc2626",
  success: "#16a34a",
} as const;

export const Shadows = {
  sm: { shadowColor: "#1a6b4a", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  md: { shadowColor: "#1a6b4a", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6 },
  lg: { shadowColor: "#1a6b4a", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 28, elevation: 12 },
  xl: { shadowColor: "#1a6b4a", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.18, shadowRadius: 40, elevation: 16 },
  gold: { shadowColor: "#c9920a", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 16, elevation: 8 },
} as const;

// Lowercase aliases
export const colors = Colors;
export const shadows = Shadows;

// Flat color aliases for simpler access in StyleSheet
export const c = {
  bg: Colors.bg.primary,
  surface: Colors.bg.surface,
  text: Colors.text.primary,
  textMuted: Colors.text.muted,
  textSubtle: Colors.text.subtle,
  border: Colors.border,
  borderSoft: Colors.borderSoft,
  em700: Colors.emerald[700],
  em100: Colors.emerald[100],
  em50: Colors.emerald[50],
  go600: Colors.gold[600],
  white: Colors.white,
  error: Colors.error,
} as const;

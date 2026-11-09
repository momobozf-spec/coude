import { accent, amber, green, neutral, red, teal, violet } from './palette';

/**
 * Semantische tokens: wat componenten daadwerkelijk gebruiken.
 *
 * Een component vraagt om `text.secondary`, niet om `neutral.500`. Daardoor
 * blijven licht en donker automatisch in de pas en kan de identiteit later
 * veranderen zonder één component aan te raken.
 */
export interface Theme {
  name: 'light' | 'dark';
  color: {
    bg: {
      canvas: string;
      surface: string;
      elevated: string;
      subtle: string;
      hover: string;
      active: string;
      inverse: string;
      overlay: string;
    };
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
      disabled: string;
      inverse: string;
      onAccent: string;
    };
    border: {
      subtle: string;
      default: string;
      strong: string;
      focus: string;
    };
    accent: {
      subtle: string;
      muted: string;
      default: string;
      hover: string;
      active: string;
      text: string;
    };
    status: {
      successBg: string;
      success: string;
      warningBg: string;
      warning: string;
      dangerBg: string;
      danger: string;
      infoBg: string;
      info: string;
    };
    /** Eén kleur per itemtype, zodat de drie werelden herkenbaar blijven. */
    itemType: {
      task: string;
      note: string;
      idea: string;
    };
    priority: {
      urgent: string;
      high: string;
      medium: string;
      low: string;
      none: string;
    };
  };
  shadow: {
    sm: string;
    md: string;
    lg: string;
  };
}

export const lightTheme: Theme = {
  name: 'light',
  color: {
    bg: {
      canvas: neutral[50],
      surface: neutral[0],
      elevated: neutral[0],
      subtle: neutral[100],
      hover: neutral[100],
      active: neutral[150],
      inverse: neutral[900],
      overlay: 'rgba(13, 17, 26, 0.45)',
    },
    text: {
      primary: neutral[900],
      secondary: neutral[600],
      tertiary: neutral[500],
      disabled: neutral[400],
      inverse: neutral[0],
      onAccent: neutral[0],
    },
    border: {
      subtle: neutral[150],
      default: neutral[200],
      strong: neutral[300],
      focus: accent[500],
    },
    accent: {
      subtle: accent[50],
      muted: accent[100],
      default: accent[600],
      hover: accent[700],
      active: accent[800],
      text: accent[700],
    },
    status: {
      successBg: green[100],
      success: green[600],
      warningBg: amber[100],
      warning: amber[600],
      dangerBg: red[100],
      danger: red[600],
      infoBg: accent[50],
      info: accent[600],
    },
    itemType: {
      task: accent[600],
      note: teal[600],
      idea: amber[600],
    },
    priority: {
      urgent: red[600],
      high: amber[600],
      medium: accent[600],
      low: neutral[500],
      none: neutral[400],
    },
  },
  shadow: {
    sm: '0 1px 2px rgba(13, 17, 26, 0.06)',
    md: '0 4px 12px rgba(13, 17, 26, 0.08)',
    lg: '0 12px 32px rgba(13, 17, 26, 0.12)',
  },
};

export const darkTheme: Theme = {
  name: 'dark',
  color: {
    bg: {
      // Niet zwart: een diepe blauwgrijze tint is prettiger bij lang lezen en
      // laat schaduwen en scheidingslijnen nog werken.
      canvas: neutral[950],
      surface: neutral[900],
      elevated: neutral[850],
      subtle: neutral[850],
      hover: neutral[800],
      active: neutral[700],
      inverse: neutral[50],
      overlay: 'rgba(0, 0, 0, 0.6)',
    },
    text: {
      primary: neutral[50],
      secondary: neutral[300],
      tertiary: neutral[400],
      disabled: neutral[600],
      inverse: neutral[900],
      onAccent: neutral[0],
    },
    border: {
      subtle: neutral[850],
      default: neutral[800],
      strong: neutral[700],
      focus: accent[400],
    },
    accent: {
      subtle: 'rgba(99, 102, 241, 0.12)',
      muted: 'rgba(99, 102, 241, 0.24)',
      default: accent[500],
      hover: accent[400],
      active: accent[300],
      text: accent[300],
    },
    status: {
      successBg: 'rgba(34, 197, 94, 0.15)',
      success: green[300],
      warningBg: 'rgba(245, 158, 11, 0.15)',
      warning: amber[300],
      dangerBg: 'rgba(239, 68, 68, 0.15)',
      danger: red[300],
      infoBg: 'rgba(99, 102, 241, 0.15)',
      info: accent[300],
    },
    itemType: {
      task: accent[400],
      note: teal[300],
      idea: amber[300],
    },
    priority: {
      urgent: red[300],
      high: amber[300],
      medium: accent[400],
      low: neutral[400],
      none: neutral[500],
    },
  },
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
    md: '0 4px 12px rgba(0, 0, 0, 0.5)',
    lg: '0 12px 32px rgba(0, 0, 0, 0.6)',
  },
};

export const themes = { light: lightTheme, dark: darkTheme } as const;

/** Accentkleur per ideestatus; gebruikt in de ideeënlijst en op het bord. */
export const IDEA_STATUS_COLOR = {
  NEW: accent[500],
  EXPLORING: violet[500],
  INTERESTING: teal[500],
  LATER: neutral[400],
  DEVELOPING: amber[500],
  CONVERTED: green[500],
  REJECTED: red[500],
  ARCHIVED: neutral[500],
} as const;

export const PROJECT_STATUS_COLOR = {
  PLANNING: neutral[500],
  ACTIVE: accent[600],
  ON_HOLD: amber[500],
  COMPLETED: green[600],
  ARCHIVED: neutral[400],
} as const;

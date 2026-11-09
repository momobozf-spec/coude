import type { Config } from 'tailwindcss';

/**
 * Tailwind leest uitsluitend de CSS-variabelen die uit @orbit/ui komen. De
 * tokens bestaan dus maar één keer: hier op web, en als gewone objecten in de
 * React Native-app. Een kleur wijzigen gebeurt in packages/ui/src/tokens.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-bg-canvas)',
        surface: 'var(--color-bg-surface)',
        elevated: 'var(--color-bg-elevated)',
        subtle: 'var(--color-bg-subtle)',
        hovered: 'var(--color-bg-hover)',
        pressed: 'var(--color-bg-active)',
        overlay: 'var(--color-bg-overlay)',

        ink: {
          DEFAULT: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          disabled: 'var(--color-text-disabled)',
          inverse: 'var(--color-text-inverse)',
          'on-accent': 'var(--color-text-on-accent)',
        },

        line: {
          subtle: 'var(--color-border-subtle)',
          DEFAULT: 'var(--color-border-default)',
          strong: 'var(--color-border-strong)',
          focus: 'var(--color-border-focus)',
        },

        accent: {
          subtle: 'var(--color-accent-subtle)',
          muted: 'var(--color-accent-muted)',
          DEFAULT: 'var(--color-accent-default)',
          hover: 'var(--color-accent-hover)',
          active: 'var(--color-accent-active)',
          text: 'var(--color-accent-text)',
        },

        success: 'var(--color-status-success)',
        'success-bg': 'var(--color-status-success-bg)',
        warning: 'var(--color-status-warning)',
        'warning-bg': 'var(--color-status-warning-bg)',
        danger: 'var(--color-status-danger)',
        'danger-bg': 'var(--color-status-danger-bg)',
        info: 'var(--color-status-info)',
        'info-bg': 'var(--color-status-info-bg)',

        task: 'var(--color-item-type-task)',
        note: 'var(--color-item-type-note)',
        idea: 'var(--color-item-type-idea)',

        'priority-urgent': 'var(--color-priority-urgent)',
        'priority-high': 'var(--color-priority-high)',
        'priority-medium': 'var(--color-priority-medium)',
        'priority-low': 'var(--color-priority-low)',
        'priority-none': 'var(--color-priority-none)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Inter',
          'Roboto',
          '"Helvetica Neue"',
          'sans-serif',
        ],
        mono: ['"SF Mono"', 'Menlo', 'Consolas', '"Roboto Mono"', 'monospace'],
      },
      fontSize: {
        xs: ['11px', '16px'],
        sm: ['13px', '18px'],
        base: ['15px', '22px'],
        md: ['16px', '24px'],
        lg: ['18px', '26px'],
        xl: ['22px', '30px'],
        '2xl': ['28px', '36px'],
        '3xl': ['34px', '42px'],
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 140ms cubic-bezier(0.2, 0, 0, 1)',
        'slide-up': 'slide-up 200ms cubic-bezier(0.2, 0, 0, 1)',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};

export default config;

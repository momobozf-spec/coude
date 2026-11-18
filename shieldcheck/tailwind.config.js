/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // Diepblauw: basis van de interface
        navy: {
          50: '#EEF3FB',
          100: '#D7E3F6',
          200: '#AFC6EC',
          300: '#7FA2DD',
          500: '#2F63B8',
          600: '#1E4E9C',
          700: '#173E7D',
          800: '#12305F',
          900: '#0B1F3F',
          950: '#071429',
        },
        // Smaragdgroen: goed / in orde
        emerald: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        // Zacht oranje: aandacht (geen alarmrood)
        sun: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
      },
    },
  },
  plugins: [],
};

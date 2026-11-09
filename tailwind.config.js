/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        coal: { 950: '#07080a', 900: '#0d0f12', 850: '#121519', 800: '#171a1f', 700: '#22262d', 600: '#2f343c', 500: '#454b55' },
        ash: { 400: '#8a9099', 300: '#a8adb4', 200: '#c9ccd1', 100: '#e6e7e9' },
        blood: { 900: '#3b0a0c', 800: '#5c0f12', 700: '#7d1418', 600: '#a3191f', 500: '#c9232a', 400: '#e5484d' },
        warn: { 600: '#b45309', 500: '#e07a1f', 400: '#f59e42' },
        safe: { 600: '#2f7a4a', 500: '#3fa365', 400: '#5cc386' },
      },
      fontFamily: {
        display: ['"Oswald"', 'Impact', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'ui-monospace', 'monospace'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        flicker: { '0%,19%,21%,23%,25%,54%,56%,100%': { opacity: '1' }, '20%,24%,55%': { opacity: '0.35' } },
        pulseRed: { '0%,100%': { opacity: '0.15' }, '50%': { opacity: '0.55' } },
        drift: { '0%': { transform: 'translateX(-10%)' }, '100%': { transform: 'translateX(10%)' } },
      },
      animation: {
        flicker: 'flicker 4s infinite',
        pulseRed: 'pulseRed 2.4s ease-in-out infinite',
        drift: 'drift 28s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};

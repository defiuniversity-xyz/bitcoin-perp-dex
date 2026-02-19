/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        btc: {
          orange: '#F7931A',
          'orange-dark': '#d4760e',
        },
        navy: {
          950: '#050810',
          900: '#0A0E1A',
          800: '#0f1629',
          700: '#162035',
          600: '#1e2d4a',
          500: '#263855',
        },
        long: '#22C55E',
        'long-dim': '#166534',
        short: '#EF4444',
        'short-dim': '#991B1B',
        border: '#1e2d4a',
      },
      fontFamily: {
        sans: ['Inter', 'DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Outfit"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        terrain: {
          50: '#f0f9f4',
          100: '#dcf2e4',
          200: '#bce5cc',
          300: '#8cd2ad',
          400: '#5ab887',
          500: '#379d6a',
          600: '#277e54',
          700: '#1f6544',
          800: '#1b5037',
          900: '#17422f',
        },
      },
    },
  },
  plugins: [],
}

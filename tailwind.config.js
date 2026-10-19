/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fdf9ed',
          100: '#f9efcd',
          200: '#f2dd97',
          300: '#e9c461',
          400: '#e0ab3b',
          500: '#c9a227',
          600: '#ad8320',
          700: '#8a631d',
          800: '#724f1e',
          900: '#61421e',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.05)',
      },
      maxWidth: { shell: '480px' },
    },
  },
  plugins: [],
}

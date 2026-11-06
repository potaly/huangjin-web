/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 香槟金，取自门店：香槟灰面板、古铜收边（与小程序 app.wxss 色板一致）
        gold: {
          50: '#f8f4ee',
          100: '#efe6d8',
          200: '#e3d4bd',
          300: '#d2bb98',
          400: '#bf9f71',
          500: '#a8864f',
          600: '#8c6b3b',
          700: '#735632',
          800: '#5c452b',
          900: '#483726',
        },
        // 头部浅香槟底与文字
        champagne: {
          bg: '#ede5d9',
          ink: '#3b3128',
          sub: '#8a7a66',
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

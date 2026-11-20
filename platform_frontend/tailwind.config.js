export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17352f',
        muted: '#647a73',
        canvas: '#f3f8f5',
        forest: '#16745b',
        mint: '#e1f3ea',
        navy: '#123c34',
        coral: '#c6535d',
        amber: '#aa741f',
      },
      fontFamily: {
        sans: ['DM Sans', 'Aptos', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 8px 24px rgba(18, 60, 52, 0.055), 0 1px 2px rgba(18, 60, 52, 0.04)',
        'panel-hover': '0 12px 30px rgba(18, 60, 52, 0.09), 0 2px 6px rgba(18, 60, 52, 0.05)',
      },
    },
  },
  plugins: [],
}
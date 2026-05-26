/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif']
      },
      colors: {
        transparent: 'transparent',
        current: 'currentColor',
        cream: '#FFF9F3',
        'pastel-lavender': {
          50: '#fbf7ff',
          100: '#f1eaff',
          500: '#8b5cf6'
        },
        'pastel-blue': {
          50: '#f3f8ff',
          100: '#e6f0ff',
          500: '#60a5fa'
        },
        'pastel-peach': {
          50: '#fff7f4',
          100: '#fff0ec',
          500: '#fb7185'
        },
        'pastel-mint': {
          50: '#f6fffb',
          100: '#ecfff7',
          500: '#34d399'
        },
        coral: {
          50: '#fff6f6',
          100: '#ffecec',
          500: '#fb7185'
        },
        ink: '#0b1220'
      },
      boxShadow: {
        soft: '0 12px 40px rgba(11,18,32,0.06)',
        glow: '0 6px 24px rgba(99,102,241,0.12)'
      },
      backgroundImage: {
        'deskora-soft': 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(96,165,250,0.04) 45%, rgba(255,247,235,0.04) 100%)'
      }
    }
  },
  plugins: []
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Brand
        primary: '#F26A1B',
        'primary-dark': '#D9540A',
        'primary-light': '#FFE5D1',

        // Surfaces
        bg: '#FAF7F2',
        card: '#FFFFFF',
        border: '#EBE7E0',

        // Text
        textDark: '#2C2C2C',
        textMedium: '#4A4A4A',
        textLight: '#8A8A85',
        textFaint: '#B5B2AA',

        // Status — matches AppColors in the Flutter app
        green: '#2E7D5B',
        greenLight: '#E4F0EA',
        yellow: '#E5A134',
        yellowLight: '#FBF1DE',
        red: '#C23B3B',
        redLight: '#F5E3E3',
        blue: '#3B82F6',
        blueLight: '#E0EDFF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 8px rgba(0,0,0,0.05), 0 12px 24px rgba(0,0,0,0.06)',
        brand: '0 8px 24px -8px rgba(242,106,27,0.35)',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'fade-out': 'fadeOut 200ms ease-out',
        'slide-up': 'slideUp 220ms ease-out',
        'scale-in': 'scaleIn 200ms ease-out',
        'page-enter': 'pageEnter 320ms ease-out',
        'card-rise': 'cardRise 400ms ease-out',
        'card-pop': 'cardPop 260ms ease-out',
        'nav-glow': 'navGlow 2s ease-in-out infinite',
        'live-pulse': 'livePulse 2s ease-out infinite',
        'toast-in': 'toastIn 220ms ease-out',
        'toast-out': 'toastOut 220ms ease-out',
      },
      transitionDuration: {
        400: '400ms',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
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
        // Warm-neutral, layered shadows. Softer than a hard drop shadow so
        // white cards feel lifted without looking heavy.
        card: '0 1px 2px rgba(44,44,44,0.04), 0 8px 20px -14px rgba(44,44,44,0.12)',
        'card-hover': '0 2px 4px rgba(44,44,44,0.05), 0 18px 36px -18px rgba(44,44,44,0.20)',
        brand: '0 8px 24px -8px rgba(242,106,27,0.35)',
        float: '0 20px 48px -20px rgba(44,44,44,0.28)',
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
      // The `@keyframes` above are referenced by name (fadeIn, slideUp, …).
      // They were declared in `animation` but never defined — so every modal
      // that used animate-[fadeIn_…] / animate-[slideUp_…] had no animation.
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pageEnter: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        navItemIn: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        cardRise: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        cardPop: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '60%': { transform: 'scale(1.02)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        navGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(242,106,27,0)' },
          '50%': { boxShadow: '0 0 18px 2px rgba(242,106,27,0.35)' },
        },
        livePulse: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(1.08)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        toastOut: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(16px)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        floatY: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-18px)' },
        },
        floatYAlt: {
          '0%, 100%': { transform: 'translateY(0) translateX(0)' },
          '50%': { transform: 'translateY(14px) translateX(-10px)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        sheen: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
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
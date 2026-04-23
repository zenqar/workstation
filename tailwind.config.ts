import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-noto-kufi)', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        // Zenqar brand palette
        zenqar: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d6fe',
          300: '#a5b8fc',
          400: '#8293f8',
          500: '#6470f3',
          600: '#4f52e8',
          700: '#4341cf',
          800: '#3737a7',
          900: '#313484',
          950: '#1e1e52',
        },
        surface: {
          DEFAULT: 'rgba(255,255,255,0.05)',
          hover:   'rgba(255,255,255,0.08)',
          active:  'rgba(255,255,255,0.12)',
          card:    'rgba(255,255,255,0.06)',
          border:  'rgba(255,255,255,0.10)',
        },
        dark: {
          bg:       '#0a0b14',
          surface:  '#0f1020',
          elevated: '#141628',
          border:   'rgba(255,255,255,0.08)',
        },
        status: {
          draft:          '#64748b',
          issued:         '#3b82f6',
          sent:           '#8b5cf6',
          partially_paid: '#f59e0b',
          paid:           '#10b981',
          overdue:        '#ef4444',
          cancelled:      '#6b7280',
        },
      },
      backgroundImage: {
        'zenqar-gradient': 'linear-gradient(135deg, #0a0b14 0%, #0f1020 50%, #141628 100%)',
        'zenqar-glow':     'radial-gradient(ellipse at 50% 0%, rgba(100, 112, 243, 0.15) 0%, transparent 60%)',
        'card-shimmer':    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
        'primary-gradient':'linear-gradient(135deg, #6470f3 0%, #4f52e8 100%)',
      },
      boxShadow: {
        'glass':   '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glass-lg':'0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.10)',
        'zenqar':  '0 0 30px rgba(100, 112, 243, 0.25)',
        'card':    '0 2px 12px rgba(0,0,0,0.3)',
        'glow':    '0 0 20px rgba(100, 112, 243, 0.4)',
      },
      borderRadius: {
        'xl':  '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      backdropBlur: {
        'xs': '2px',
        'glass': '12px',
        'heavy': '24px',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'slide-in':   'slideIn 0.25s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer':    'shimmer 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

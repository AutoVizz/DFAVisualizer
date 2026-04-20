export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0f0f0f',
        surface: '#1a1a1a',
        'surface-light': '#242424',
        'surface-lighter': '#2a2a2a',
        accent: '#7c3aed',
        'accent-light': '#8b5cf6',
        'accent-dark': '#6d28d9',
        'accent-glow': 'rgba(124, 58, 237, 0.3)',
        'sim-active': '#facc15',
        'sim-active-glow': 'rgba(250, 204, 21, 0.3)',
        'accept-green': '#22c55e',
        'reject-red': '#ef4444',
        'text-primary': '#f5f5f5',
        'text-secondary': '#a3a3a3',
        'text-muted': '#737373',
        border: '#333333',
        'border-light': '#444444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'scale-in': 'scaleIn 0.15s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(124, 58, 237, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(124, 58, 237, 0.6)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        'glow': '0 0 15px rgba(124, 58, 237, 0.4)',
        'glow-lg': '0 0 30px rgba(124, 58, 237, 0.5)',
        'inner-glow': 'inset 0 0 10px rgba(124, 58, 237, 0.2)',
      }
    },
  },
  plugins: [],
}

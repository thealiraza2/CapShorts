/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#090d16'
        },
        brand: {
          500: '#6366f1',
          600: '#4f46e5',
          cyan: '#06b6d4',
          yellow: '#facc15'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        komika: ['Komika Axis', 'Impact', 'sans-serif'],
        boldfont: ['The Bold Font', 'Impact', 'sans-serif'],
        montserrat: ['Montserrat', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
        impact: ['Impact', 'sans-serif']
      },
      spacing: {
        '13': '3.25rem',
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.85)', opacity: '0.8' },
          '50%': { transform: 'scale(1.18)', opacity: '1' },
          '100%': { transform: 'scale(1.0)', opacity: '1' }
        },
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' }
        },
        glow: {
          '0%, 100%': { filter: 'drop-shadow(0 0 10px currentColor)' },
          '50%': { filter: 'drop-shadow(0 0 25px currentColor)' }
        },
        fade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        }
      },
      animation: {
        pop: 'pop 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        bounce: 'bounce 0.22s ease-in-out forwards',
        glow: 'glow 1.5s ease-in-out infinite',
        fade: 'fade 0.2s ease-in-out forwards'
      }
    },
  },
  plugins: [],
}

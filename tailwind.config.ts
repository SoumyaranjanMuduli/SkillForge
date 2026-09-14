import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        panel: '#ffffff',
        line: '#e2e8f0',
        brand: '#4f46e5',
        brandDark: '#4338ca',
        accent: '#7c3aed',
        surface: '#f8fafc'
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.06)',
        pop: '0 12px 32px rgba(79,70,229,.18)'
      },
      keyframes: {
        fadeInUp: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(.94)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        floatY: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgba(79,70,229,.35)' }, '100%': { boxShadow: '0 0 0 10px rgba(79,70,229,0)' } },
        popIn: { '0%': { opacity: '0', transform: 'scale(.7)' }, '60%': { opacity: '1', transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)' } }
      },
      animation: {
        'fade-in-up': 'fadeInUp .5s ease-out both',
        'fade-in': 'fadeIn .4s ease-out both',
        'scale-in': 'scaleIn .3s ease-out both',
        float: 'floatY 3.4s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite linear',
        'pulse-ring': 'pulseRing 1.6s cubic-bezier(0.4,0,0.6,1) infinite',
        'pop-in': 'popIn .4s cubic-bezier(.34,1.56,.64,1) both'
      }
    }
  },
  plugins: []
}

export default config

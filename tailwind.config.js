/** @type {import('tailwindcss').Config} */

// Toutes les couleurs pointent vers les variables de src/styles/theme.css
// (générées par scripts/build-theme.mjs). Les classes existantes de l'app
// (bg-gray-50, text-blue-600...) adoptent ainsi la direction « Foulard » et le
// mode sombre sans être réécrites.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const scale = (name) => Object.fromEntries(STEPS.map((step) => [step, v(`${name}-${step}`)]));

const spring = 'cubic-bezier(.34, 1.56, .64, 1)';
const out = 'cubic-bezier(.22, 1, .36, 1)';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        gray: scale('gray'),
        slate: scale('gray'),
        blue: scale('blue'),
        sky: scale('blue'),
        green: scale('green'),
        emerald: scale('green'),
        lime: scale('green'),
        purple: scale('purple'),
        violet: scale('purple'),
        fuchsia: scale('purple'),
        orange: scale('orange'),
        amber: scale('yellow'),
        yellow: scale('yellow'),
        pink: scale('pink'),
        rose: scale('pink'),
        red: scale('red'),
        indigo: scale('indigo'),
        teal: scale('teal'),
        cyan: scale('cyan'),

        // Couleurs de section : un foulard par section.
        bar: scale('orange'),
        boulots: scale('green'),
        finance: scale('blue'),
        voyage: scale('pink'),
        reglages: scale('purple'),

        surface: v('surface')
      },
      // `bg-white` sert de fond de carte : il suit le thème. `text-white` reste
      // blanc, pour rester lisible sur les boutons colorés.
      backgroundColor: { white: v('surface') },
      borderColor: { DEFAULT: v('gray-200') },
      ringOffsetColor: { white: v('surface') },
      fontFamily: {
        sans: ['Figtree', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Figtree', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace']
      },
      borderRadius: {
        lg: '0.875rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.75rem'
      },
      boxShadow: {
        sm: '0 1px 2px rgb(22 24 43 / 0.06)',
        DEFAULT: '0 1px 2px rgb(22 24 43 / 0.05), 0 2px 8px rgb(22 24 43 / 0.06)',
        md: '0 1px 2px rgb(22 24 43 / 0.05), 0 6px 18px rgb(22 24 43 / 0.08)',
        lg: '0 2px 4px rgb(22 24 43 / 0.05), 0 12px 32px rgb(22 24 43 / 0.10)',
        xl: '0 4px 8px rgb(22 24 43 / 0.06), 0 20px 48px rgb(22 24 43 / 0.16)'
      },
      // Toutes les transitions de l'app rebondissent légèrement : c'est ce qui
      // donne au « active:scale-95 » existant partout sa sensation de ressort.
      transitionTimingFunction: { DEFAULT: spring, spring, out },
      transitionDuration: { DEFAULT: '220ms' },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(.985)' },
          '100%': { opacity: '1', transform: 'none' }
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.35)' },
          '100%': { transform: 'scale(1)' }
        },
        sheet: {
          '0%': { opacity: '0', transform: 'translateY(56px)' },
          '100%': { opacity: '1', transform: 'none' }
        },
        fade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        }
      },
      animation: {
        rise: `rise .5s ${out} both`,
        pop: `pop .38s ${spring}`,
        sheet: `sheet .42s ${out} both`,
        fade: 'fade .25s ease-out both'
      }
    }
  },
  plugins: []
};

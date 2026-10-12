/** @type {import('tailwindcss').Config} */
// RehabQuest design tokens.
// Primary "rehab teal" (buttons use 600 with white text: 4.7:1), coral for streaks,
// sun for XP, grape for achievements, sky for information, rose for symptom stops.
// Neutrals ("ink") are biased slightly toward the teal so they never read as flat grey.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#E9FBF7',
          100: '#C9F4EA',
          200: '#96E8D6',
          300: '#5DD6BE',
          400: '#2BBFA4',
          500: '#12A58B',
          600: '#0A8274',
          700: '#076B5F',
          800: '#075449',
          900: '#063F37',
        },
        coral: { 50: '#FFF3EE', 100: '#FFE1D5', 300: '#FFAD8C', 400: '#FF8A5B', 500: '#F26B3A', 600: '#C8501F', 700: '#9C3B14' },
        sun: { 50: '#FFF9E0', 100: '#FFF0B3', 300: '#FFD84D', 400: '#FFC81A', 500: '#F2B200', 600: '#B88700', 700: '#7A5A00' },
        grape: { 50: '#F4EEFF', 100: '#E7DCFF', 300: '#C2A6FF', 400: '#A67CFF', 500: '#8B5CF6', 600: '#7040DB', 700: '#5B34C2' },
        sky: { 50: '#EAF5FF', 100: '#D2E9FF', 300: '#8CC6F7', 500: '#2E8FE0', 600: '#1C6FB8', 700: '#155A96' },
        rose: { 50: '#FFF1F2', 100: '#FFE0E2', 200: '#FFC5CA', 500: '#E5484D', 600: '#C9353B', 700: '#A42A30' },
        ink: { 50: '#F5F8F8', 100: '#E9EFEF', 200: '#D3DDDD', 300: '#A7B6B6', 400: '#7F9192', 500: '#5A6C6D', 700: '#33484A', 900: '#152A2C' },
        canvas: '#F6FAF9',
      },
      fontFamily: {
        display: ['"Baloo 2"', '"Nunito"', 'ui-rounded', 'system-ui', 'sans-serif'],
        sans: ['Nunito', 'ui-rounded', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.6)', opacity: '0' }, '60%': { transform: 'scale(1.08)', opacity: '1' }, '100%': { transform: 'scale(1)' } },
        rise: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        ring: { '0%': { transform: 'scale(1)', opacity: '.55' }, '100%': { transform: 'scale(1.45)', opacity: '0' } },
        xp: { '0%': { transform: 'translateY(6px) scale(.9)', opacity: '0' }, '20%': { transform: 'translateY(0) scale(1)', opacity: '1' }, '80%': { opacity: '1' }, '100%': { transform: 'translateY(-14px)', opacity: '0' } },
        confetti: { '0%': { transform: 'translate(0,0) rotate(0)', opacity: '1' }, '100%': { transform: 'translate(var(--dx), var(--dy)) rotate(var(--rot))', opacity: '0' } },
      },
      animation: {
        pop: 'pop .45s cubic-bezier(.2,.9,.3,1.3) both',
        rise: 'rise .35s ease-out both',
        float: 'float 3.2s ease-in-out infinite',
        ring: 'ring 1.6s ease-out infinite',
        xp: 'xp 1.6s ease-out both',
        confetti: 'confetti 1.1s ease-out forwards',
      },
    },
  },
  plugins: [],
};

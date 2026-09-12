/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12141c',
        panel: '#1a1d28',
        'panel-2': '#20232f',
        line: '#2c3040',
        'line-soft': '#232634',
        parchment: '#ede9de',
        muted: '#8b8e9e',
        dim: '#4a4d5c',
        today: '#262a3a',
        brass: '#c08a3e',
        'brass-dim': '#7a5a2c',
        // routine cell states
        done: '#7a9b76',
        'done-dim': '#3f5240',
        busy: '#5b7fa6',
        'busy-dim': '#2f4257',
        missed: '#b5645f',
        'missed-dim': '#4d2f2e',
        // timetable lesson kinds (own tokens: the timetable is independent of
        // the routine grid even where a hue happens to match)
        lecture: '#7a9b76',
        'lecture-dim': '#3f5240',
        seminar: '#b5a44f',
        'seminar-dim': '#4c4529',
        lab: '#5b7fa6',
        'lab-dim': '#2f4257',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}

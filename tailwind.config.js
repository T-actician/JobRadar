const c = (n) => `rgb(var(--${n}) / <alpha-value>)`;
const MONO = ['"JetBrains Mono"', '"Cascadia Mono"', 'Consolas', '"Courier New"', 'monospace'];

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { bg: c('bg'), panel: c('panel'), line: c('line'), cyan: c('cyan'), orange: c('orange'), ink: c('ink'), dim: c('dim'), ok: c('ok'), term: c('term'), warn: c('warn') },
      fontFamily: { sans: MONO, mono: MONO },
    },
  },
  plugins: [],
};

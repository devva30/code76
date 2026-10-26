import type { Config } from 'tailwindcss';

/**
 * “Ink & Paper” theme — printed-matter editorial.
 * Colours are CSS variables (see src/config/palettes.ts), so palettes can be
 * swapped without touching components.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Hover styles apply only on devices that truly hover, so phone taps never “stick”.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--c-paper) / <alpha-value>)',
        newsprint: 'rgb(var(--c-newsprint) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        graphite: 'rgb(var(--c-graphite) / <alpha-value>)',
        stamp: 'rgb(var(--c-stamp) / <alpha-value>)',
        rule: 'rgb(var(--c-rule) / <alpha-value>)',
        card: 'rgb(var(--c-card) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        solid: 'rgb(var(--c-solid) / <alpha-value>)',
        onsolid: 'rgb(var(--c-onsolid) / <alpha-value>)',
        band: 'rgb(var(--c-band) / <alpha-value>)',
        onband: 'rgb(var(--c-onband) / <alpha-value>)',
        night: 'rgb(var(--c-night) / <alpha-value>)',
        gold: 'rgb(var(--c-gold) / <alpha-value>)',
        'gold-deep': 'rgb(var(--c-gold-deep) / <alpha-value>)',
        cream: 'rgb(var(--c-cream) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Headings: Plus Jakarta Sans (bold), body: Inter, labels: Space Mono.
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Small uppercase labels, prices and specs.
        mono: ['"Space Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.1em' }],
      },
      maxWidth: {
        site: '1600px',
      },
      transitionTimingFunction: {
        editorial: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        marquee: { from: { transform: 'translate3d(0,0,0)' }, to: { transform: 'translate3d(-50%,0,0)' } },
        slidefill: { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        scrollcue: {
          '0%': { transform: 'scaleY(0)', transformOrigin: 'top' },
          '45%': { transform: 'scaleY(1)', transformOrigin: 'top' },
          '55%': { transform: 'scaleY(1)', transformOrigin: 'bottom' },
          '100%': { transform: 'scaleY(0)', transformOrigin: 'bottom' },
        },
      },
      animation: {
        marquee: 'marquee 48s linear infinite',
        ticker: 'marquee 32s linear infinite',
        slidefill: 'slidefill 5s linear forwards',
        scrollcue: 'scrollcue 2.4s cubic-bezier(0.65, 0, 0.35, 1) infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;

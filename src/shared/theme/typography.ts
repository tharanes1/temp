import { ms } from '../utils/responsive';

export const TYPOGRAPHY = {
  hero: {
    fontSize: ms(32),
    fontWeight: '900',
    letterSpacing: -1,
  },
  h1: {
    fontSize: ms(24),
    fontWeight: '900',
  },
  h2: {
    fontSize: ms(20),
    fontWeight: '800',
  },
  h3: {
    fontSize: ms(18),
    fontWeight: '700',
  },
  bodyLarge: {
    fontSize: ms(16),
    fontWeight: '600',
  },
  body: {
    fontSize: ms(14),
    fontWeight: '500',
  },
  tag: {
    fontSize: ms(12),
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  // Legacy support for specific screens
  rounded: {
    fontSize: ms(16),
    fontWeight: '700',
  },
  mono: {
    fontSize: ms(14),
    fontFamily: 'monospace',
  },
} as const;

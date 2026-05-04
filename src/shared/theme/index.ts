import { COLORS } from './colors';
import { TYPOGRAPHY } from './typography';
import { SPACING, RADIUS, SHADOWS } from './layout';

// Only keys that exist in BOTH light and dark themes
export type ColorName = keyof typeof COLORS.light;

export {
  COLORS,
  COLORS as Colors, // Legacy alias
  TYPOGRAPHY,
  TYPOGRAPHY as Fonts, // Legacy alias
  SPACING,
  RADIUS,
  SHADOWS,
};

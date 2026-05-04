import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Guideline sizes are based on standard ~5" screen mobile device (e.g. iPhone 11 / Android)
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

/**
 * Scales based on width of the screen.
 */
export const scale = (size: number) => (SCREEN_WIDTH / guidelineBaseWidth) * size;

/**
 * Scales based on height of the screen.
 */
export const verticalScale = (size: number) => (SCREEN_HEIGHT / guidelineBaseHeight) * size;

/**
 * Scales based on width with a factor to limit the scaling on larger screens.
 * Good for font sizes and margins.
 */
export const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

/**
 * Scales based on width but ensures it doesn't get too small on tiny devices.
 */
export const s = scale;
export const vs = verticalScale;
export const ms = moderateScale;

export const isSmallDevice = SCREEN_WIDTH < 375;
export const isTablet = SCREEN_WIDTH > 600;

export { SCREEN_WIDTH, SCREEN_HEIGHT };

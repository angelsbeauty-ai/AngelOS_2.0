import { Platform as _P } from 'react-native';
// AngelOS final-D2 design tokens (Neutral Calm). See `D` for the full set.
const charcoal = '#151515';

export const tokens = {
  color: {
    charcoal,
    charcoal2: '#6B645B',
    charcoal3: 'rgba(42,39,37,0.45)',
    ivory: '#FFFFFF',
    ivorySolid: '#FFFFFF',
    raised: '#FFFFFF',
    pearl: '#FFFFFF',
    tide: '#151515',
    accentPressed: '#4F4A44',
    coral: '#B3261E',
    success: '#4F4A44',
    warning: '#4F4A44',
    error: '#B3261E',
    glassTint: '#FFFFFF',
    seaGlass: '#6B645B',
    hairline: '#EDEDED',
    onCharcoal: '#FFFFFF'
  },
  type: {
    largeTitle: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 40, lineHeight: 44 },
    heroTime: { fontFamily: 'CormorantGaramond_500Medium', fontSize: 60, lineHeight: 64, fontVariant: ['lining-nums', 'tabular-nums'] },
    title2: { fontFamily: 'Manrope_600SemiBold', fontSize: 22, lineHeight: 28 },
    headline: { fontFamily: 'Manrope_600SemiBold', fontSize: 17, lineHeight: 22 },
    body: { fontFamily: 'Manrope_400Regular', fontSize: 17, lineHeight: 22 },
    subhead: { fontFamily: 'Manrope_400Regular', fontSize: 15, lineHeight: 20 },
    footnote: { fontFamily: 'Manrope_500Medium', fontSize: 13, lineHeight: 18 },
    overline: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
    maxFontScale: 1.3
  },
  font: {
    display: 'Manrope_700Bold',
    displayMedium: 'Manrope_600SemiBold',
    displayItalic: 'Manrope_500Medium',
    ui: 'Manrope_400Regular',
    uiMedium: 'Manrope_500Medium',
    uiSemibold: 'Manrope_600SemiBold',
    uiBold: 'Manrope_700Bold'
  },
  numerals: ['lining-nums', 'tabular-nums'] as const,
  icon: { weight: 'duotone' as const, duotoneColor: '#766E64', duotoneOpacity: 0.45, activeDuotoneOpacity: 0.6, size: 24 },
  space: { screen: 16, tap: 44 },
  radius: { pill: 999, block: 20, card: 28 }
} as const;

export const glass = {
  maxLayersOnScreen: 3,
  roundButton: { style: 'clear' as const, interactive: true, fallbackBlur: 60 },
  toast: { style: 'regular' as const, fallbackBlur: 70 },
  menu: { style: 'regular' as const, fallbackBlur: 80 },
  sheet: { style: 'regular' as const, fallbackBlur: 80 },
  blurTint: 'systemThinMaterialLight' as const,
  highlightTop: 'rgba(255,255,255,0.85)',
  highlightAll: 'rgba(255,255,255,0.45)'
};

export const motion = {
  instant: 100, quick: 200, standard: 320, emphasis: 450,
  snap: { damping: 20, stiffness: 300, mass: 1 },
  smooth: { damping: 24, stiffness: 220, mass: 1 },
  lift: { damping: 18, stiffness: 260, mass: 0.9 },
  pressScale: 0.97, liftScale: 1.035, longPressMs: 350, toastMs: 4000, reducedFadeMs: 150
};

const lightCompat = {
  background: tokens.color.pearl,
  elevated: tokens.color.ivory,
  warmSurface: tokens.color.pearl,
  primaryText: charcoal,
  secondaryText: tokens.color.charcoal2,
  border: tokens.color.hairline,
  gold: tokens.color.tide,
  softGold: '#F2F2F2',
  success: tokens.color.success,
  warning: tokens.color.warning,
  critical: tokens.color.error
};

export const colors = { light: lightCompat, dark: lightCompat };
export const spacing = { xs: 8, sm: 16, md: 24 };
export const radius = { card: tokens.radius.card, control: tokens.radius.block, pill: 999 };
export const typography = { display: 40, screenTitle: 40, section: 17, body: 17, support: 15, metadata: 13 };
export const shadow = { soft: { shadowColor: charcoal, shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 } };

/**
 * Web-only A1 glass (mockup .glass): translucent ivory + backdrop blur + inner highlight.
 * React Native ignores these keys on native, where GlassSurface/BlurView handle it.
 */
/** Flat Instagram-style surfaces: solid white, no blur/shadow (name kept for compatibility). */
export const webGlass: Record<string, unknown> = { backgroundColor: '#FFFFFF' };
void _P;

/** final-D2 tokens (TOKENS.md). */
export const D = {
  bg: '#FFFFFF', surface: '#FFFFFF', bgTab: '#FFFFFF', fill: '#F2F2F2', fill2: '#EDEDED',
  text: '#151515', text2: '#4F4A44', muted: '#6B645B', faint: '#766E64', disabled: '#BDB6AC',
  hairline: '#EDEDED', accent: '#B8A48A', accentDeep: '#8C7A64', accentTint: '#F5F5F5',
  pendingRule: '#8A8379', danger: '#B3261E', listening: '#75654F',
} as const;

import { Platform as _P } from 'react-native';
// AngelOS final-D2 design tokens (Neutral Calm). See `D` for the full set.
const charcoal = '#151515';

export const tokens = {
  color: {
    charcoal,
    charcoal2: '#6C6C70',
    charcoal3: 'rgba(42,39,37,0.45)',
    ivory: '#FFFFFF',
    ivorySolid: '#FFFFFF',
    raised: '#FFFFFF',
    pearl: '#FFFFFF',
    tide: '#151515',
    accentPressed: '#3A3A3C',
    coral: '#B3261E',
    success: '#3A3A3C',
    warning: '#3A3A3C',
    error: '#B3261E',
    glassTint: '#FFFFFF',
    seaGlass: '#6C6C70',
    hairline: '#EDEDED',
    onCharcoal: '#FFFFFF',
    /** Rose-gold accent (PALETTES.md Greige & Rose Gold): selected states and primary actions on content screens. */
    roseGold: '#8C5547',
    roseGoldNight: '#C99484'
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
  icon: { weight: 'duotone' as const, duotoneColor: '#76767A', duotoneOpacity: 0.45, activeDuotoneOpacity: 0.6, size: 24 },
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
  text: '#151515', text2: '#3A3A3C', muted: '#6C6C70', faint: '#76767A', disabled: '#C7C7CC',
  hairline: '#EDEDED', accent: '#B8A48A', accentDeep: '#8C7A64', accentTint: '#F5F5F5',
  pendingRule: '#8A8379', danger: '#B3261E', listening: '#75654F',
} as const;

/** Night tokens (docs/design-review-oct20/NIGHT_TOKENS_AUDIT.md rules 1-7). Same values the Night screens already use. */
export const N = {
  bg: '#050505', card: '#161618', text: '#F4F4F5', text2: '#C7C7CC', muted: '#9A9A9F', chipText: '#E5E5E7',
  field: 'rgba(255,255,255,0.05)', fieldBorder: 'rgba(255,255,255,0.14)', hairline: 'rgba(255,255,255,0.11)',
  onLight: '#0A0A0A', secondaryBorder: 'rgba(255,255,255,0.24)',
} as const;

/**
 * Chat thread tokens (angelos-designer/chat-rebuild/BUILD_PACKET_CHAT_CALENDAR.md `chat.day` / `chat.night` / sizes).
 * Colours are the values the approved thread already ships with; the packet's dark Day out-bubble was later changed to grey.
 */
export const chat = {
  day: { bg: '#F3F3F3', inc: '#FFFFFF', incText: '#151515', out: '#E4E4E6', outText: '#151515', quoteOnOut: '#3A3A3C', muted: '#6C6C70', pill: '#E4E4E6', banner: '#EBEBED', card: '#FFFFFF', avatar: '#D1D1D6', hair: 'rgba(0,0,0,0.08)' },
  night: { bg: '#050505', inc: '#26262A', incText: '#F4F4F5', out: '#E9E9EB', outText: '#151515', quoteOnOut: '#3A3A3C', muted: '#9A9A9F', pill: '#2C2C2E', banner: '#0B0B0C', card: '#161618', avatar: '#3A3A3D', hair: 'rgba(255,255,255,0.10)' },
  /** Packet type: header name 17/22 600 · bubble 16/22 · meaning 12/16 · time 11/14 500 · day separator 12/16 500. */
  type: {
    name: { fontFamily: 'Manrope_600SemiBold', fontSize: 17, lineHeight: 22 },
    bubble: { fontFamily: 'Manrope_400Regular', fontSize: 16, lineHeight: 22 },
    meaning: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 16 },
    time: { fontFamily: 'Manrope_500Medium', fontSize: 11, lineHeight: 14 },
    day: { fontFamily: 'Manrope_500Medium', fontSize: 12, lineHeight: 16 },
  },
} as const;

/** Rose-gold accent for the current mode (Day #8C5547 = 5.4:1 on Day bg; Night #C99484 = 7.8:1 on black). */
export const accent = (night: boolean) => (night ? tokens.color.roseGoldNight : tokens.color.roseGold);
/** Text/glyph on a filled rose-gold shape: white in Day (6.0:1), black in Night (7.8:1). */
export const onAccent = (night: boolean) => (night ? N.bg : tokens.color.onCharcoal);

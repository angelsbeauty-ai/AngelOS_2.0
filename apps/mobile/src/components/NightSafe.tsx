import { useAppearance } from '../design/appearance';
import { tokens } from '../design/theme';

/** Night-safe search, menu, error text and chip styles. Drop-in for hardcoded white. */
export function useNightSafe() {
  const { mode, palette } = useAppearance();
  const night = mode === 'night';
  return {
    night,
    search: {
      height: 44,
      borderRadius: 14,
      paddingHorizontal: 14,
      backgroundColor: night ? palette.fill : '#F2F2F2',
      borderWidth: night ? 1 : 0,
      borderColor: night ? palette.border : 'transparent',
      fontFamily: tokens.font.ui,
      fontSize: 15,
      color: palette.text
    },
    menu: {
      width: 240,
      borderRadius: 20,
      backgroundColor: night ? '#161618' : '#FFFFFF',
      borderWidth: night ? 1 : 0,
      borderColor: night ? palette.border : 'transparent',
      overflow: 'hidden' as const
    },
    menuText: { color: palette.text, fontFamily: tokens.font.uiMedium, fontSize: 16 },
    menuHead: { color: palette.muted, fontFamily: tokens.font.uiSemibold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' as const, padding: 14, paddingBottom: 6 },
    errText: { color: palette.text, fontFamily: tokens.font.uiSemibold, fontSize: 16, lineHeight: 22 },
    errBody: { color: palette.muted, fontFamily: tokens.font.ui, fontSize: 15, lineHeight: 21 },
    chip: night ? { backgroundColor: palette.glass, borderColor: palette.border } : null,
    chipText: night ? { color: palette.text } : null
  };
}

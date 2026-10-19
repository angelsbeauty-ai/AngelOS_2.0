import { StyleSheet } from 'react-native';
import { useAppearance } from '../design/appearance';
import { tokens } from '../design/theme';

/** Night-safe search field, menu and empty surface. Use instead of hardcoded white. */
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
      borderRadius: 20,
      backgroundColor: night ? '#161618' : '#FFFFFF',
      borderWidth: night ? 1 : 0,
      borderColor: night ? palette.border : 'transparent',
      overflow: 'hidden' as const
    },
    menuText: { color: palette.text, fontFamily: tokens.font.uiMedium, fontSize: 16 },
    menuHead: { color: palette.muted, fontFamily: tokens.font.uiSemibold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' as const },
    empty: night ? { backgroundColor: 'transparent' } : null
  };
}

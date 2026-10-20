import { Platform } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

/** Proof shots on web set localStorage 'angelos.emulateInsets' = '1' to mimic an iPhone (44pt status bar, 34pt home indicator). */
function emulate(): boolean {
  if (Platform.OS !== 'web') return false;
  try { return (globalThis as any).localStorage?.getItem('angelos.emulateInsets') === '1'; } catch { return false; }
}

/** Safe-area insets for every screen. Native: the real device values. Web: real values, or iPhone values when emulated. */
export function useInsets(): EdgeInsets {
  const i = useSafeAreaInsets();
  if (!emulate()) return i;
  return { top: Math.max(i.top, 44), bottom: Math.max(i.bottom, 34), left: i.left, right: i.right };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

/** Keep the app open on a JavaScript error and show what went wrong (iPhone release builds otherwise close instantly). */
const g: any = globalThis as any;
export function installCrashGuard() {
if (Platform.OS !== 'web' && g.ErrorUtils?.setGlobalHandler) {
  let showing = false;
  g.ErrorUtils.setGlobalHandler((error: any) => {
    const message = String(error?.message ?? error ?? 'Unknown error').slice(0, 300);
    console.warn('[crash-guard]', message);
    void crumb(`ERROR: ${message}`);
    if (showing) return;
    showing = true;
    Alert.alert('Something went wrong', message, [{ text: 'OK', onPress: () => { showing = false; } }]);
  });
}
}
installCrashGuard();

const KEY = 'angelos.voice.crumbs';
/** Saves the last voice steps so we can see where it stopped after a crash. */
export async function crumb(step: string) {
  try { const prev = (await AsyncStorage.getItem(KEY)) ?? ''; await AsyncStorage.setItem(KEY, `${prev}\n${new Date().toISOString().slice(11, 19)} ${step}`.slice(-1500)); } catch { /* ignore */ }
}
export async function readCrumbs(clear = false) {
  try { const v = await AsyncStorage.getItem(KEY); if (clear) await AsyncStorage.removeItem(KEY); return v ?? ''; } catch { return ''; }
}

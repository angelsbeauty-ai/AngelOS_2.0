import { Alert, Platform } from 'react-native';

/** Keep the app open on a JavaScript error and show what went wrong (iPhone release builds otherwise close instantly). */
const g: any = globalThis as any;
export function installCrashGuard() {
if (Platform.OS !== 'web' && g.ErrorUtils?.setGlobalHandler) {
  let showing = false;
  g.ErrorUtils.setGlobalHandler((error: any) => {
    const message = String(error?.message ?? error ?? 'Unknown error').slice(0, 300);
    console.warn('[crash-guard]', message);
    if (showing) return;
    showing = true;
    Alert.alert('Something went wrong', message, [{ text: 'OK', onPress: () => { showing = false; } }]);
  });
}
}
installCrashGuard();

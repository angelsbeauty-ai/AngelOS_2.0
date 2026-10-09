import { Alert, Platform } from 'react-native';
import * as DialogHost from '../components/DialogHost';

/**
 * Cross-platform dialogs: uses DialogHost on all platforms for a consistent A1 look.
 * Fallback: native Alert on iOS/Android if host isn't mounted, window.alert on web.
 */

export async function notify(title: string, message = ''): Promise<void> {
  try {
    return await DialogHost.notify(title, message);
  } catch {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      return new Promise<void>((resolve) => {
        Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }]);
      });
    }
  }
}

export async function confirm(options: {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  try {
    return await DialogHost.confirm(options);
  } catch {
    if (Platform.OS === 'web') {
      return window.confirm(`${options.title}\n\n${options.message || ''}`);
    }
    return new Promise((resolve) => {
      Alert.alert(options.title, options.message || '', [
        { text: options.cancelText || 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: options.confirmText || 'OK',
          style: options.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ]);
    });
  }
}

/** Preferred entry point: `dialog.notify(title, message)` / `dialog.confirm({ ... })`. */
export const dialog = { notify, confirm };

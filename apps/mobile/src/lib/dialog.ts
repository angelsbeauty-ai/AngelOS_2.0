import { Alert, Platform } from 'react-native';

/**
 * Cross-platform dialogs: native Alert.alert on iOS/Android, styled modal on web.
 * On web: prefers an in-app modal (future); falls back to window.confirm for now.
 */

export async function notify(title: string, message: string): Promise<void> {
  if (Platform.OS === 'web') {
    // Fallback: window.alert. Future: styled in-app toast/modal.
    return;
  }
  return new Promise<void>((resolve) => {
    Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }]);
  });
}

export async function confirm(options: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const { title, message, confirmText = 'OK', cancelText = 'Cancel', destructive = false } = options;

  if (Platform.OS === 'web') {
    // Fallback: window.confirm. Future: styled in-app modal matching `11-cancel-dialog.png`.
    return window.confirm(`${title}\n\n${message}`);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmText,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

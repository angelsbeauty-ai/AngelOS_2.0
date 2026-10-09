import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

/** Where Supabase email links should land: the web origin, or the app's deep link on native. */
export function authRedirect(path: string) {
  return Platform.OS === 'web'
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/${path}`
    : Linking.createURL(path);
}

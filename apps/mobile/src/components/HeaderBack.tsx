import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { colors } from '../design/theme';

/** Sensible parent tab for a pushed screen, used when there is no history (deep link, OAuth return, refresh). */
export function parentFor(name: string): string {
  if (/^(social|content)\/accounts$|^settings\/connections$/.test(name)) return '/profile';
  if (/^(content|media)\//.test(name)) return '/calendar';
  if (/^(bookings|business-hours|time-off)/.test(name) || name === 'bookings/week') return '/calendar';
  if (/^messages\//.test(name)) return '/messages';
  if (/^academy\//.test(name)) return '/academy';
  if (name === 'clients/index') return '/profile';
  if (/^clients\/\[id\]\/(edit|health)$/.test(name)) return '/clients';
  if (/^clients\//.test(name)) return '/clients';
  if (name === 'notifications') return '/';
  if (name === 'suggestions' || name === 'ai') return '/';
  if (/^(forgot-password|reset-password)$/.test(name)) return '/login';
  return '/profile';
}

export function HeaderBack({ fallback }: { fallback: string }) {
  const { t } = useTranslation();
  return <Pressable accessibilityRole="button" accessibilityLabel={t('common.back', { defaultValue: 'Back' })} testID="header-back" hitSlop={12} style={{ paddingHorizontal: 8, paddingVertical: 4 }}
    onPress={() => { if (router.canGoBack()) router.back(); else router.replace(fallback as any); }}>
    <CaretLeft size={24} color={colors.light.primaryText as string} weight="bold" />
  </Pressable>;
}

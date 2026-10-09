import type { TFunction } from 'i18next';

/** Translate a database enum value (e.g. 'no_show') with a readable fallback. */
export function label(t: TFunction, group: string, value: string | null | undefined): string {
  if (!value) return '';
  return t(`${group}.${value}`, { defaultValue: value.replaceAll('_', ' ') });
}

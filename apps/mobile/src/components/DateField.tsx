import { createElement } from 'react';
import i18n from '../i18n';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Chip } from './MessagingBits';
import { ui } from './ui';
import { tokens } from '../design/theme';

/** Local YYYY-MM-DD for a Date. */
export function dayString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDayString(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number);
  return dayString(new Date(y, m - 1, d + n));
}
/** Local day + HH:MM → ISO string with the device's offset. */
export function toIso(day: string, time: string) {
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0).toISOString();
}
export function prettyDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(i18n.language === 'ja' ? 'ja-JP' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(y, m - 1, d));
}

const TIMES = Array.from({ length: 27 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

/** Date picker: a real date input on web; quick chips on native. Never a typed YYYY-MM-DD. */
export function DateField({ label, value, onChange, min }: { label: string; value: string; onChange: (day: string) => void; min?: string }) {
  if (Platform.OS === 'web') {
    return <View style={styles.wrap}><Text style={styles.label}>{label}</Text>{createElement('input', { type: 'date', value, min, 'aria-label': label, onChange: (e: any) => e.target.value && onChange(e.target.value), style: webInput })}</View>;
  }
  const today = dayString(new Date());
  return <View style={styles.wrap}>
    <Text style={styles.label}>{label}: {prettyDay(value)}</Text>
    <View style={styles.row}>
      <Chip label={i18n.t('calendar.prevDay')} onPress={() => onChange(addDayString(value, -1))} />
      <Chip label={i18n.t('calendar.today')} selected={value === today} onPress={() => onChange(today)} />
      <Chip label={i18n.t('calendar.tomorrow')} selected={value === addDayString(today, 1)} onPress={() => onChange(addDayString(today, 1))} />
      <Chip label={i18n.t('calendar.plusWeek')} onPress={() => onChange(addDayString(value, 7))} />
      <Chip label={i18n.t('calendar.nextDay')} onPress={() => onChange(addDayString(value, 1))} />
    </View>
  </View>;
}

export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (time: string) => void }) {
  if (Platform.OS === 'web') {
    return <View style={styles.wrap}><Text style={styles.label}>{label}</Text>{createElement('input', { type: 'time', value, step: 900, 'aria-label': label, onChange: (e: any) => e.target.value && onChange(e.target.value), style: webInput })}</View>;
  }
  return <View style={styles.wrap}>
    <Text style={styles.label}>{label}: {value}</Text>
    <View style={styles.row}>{TIMES.map((t) => <Chip key={t} label={t} selected={t === value} onPress={() => onChange(t)} />)}</View>
  </View>;
}

const webInput = { minHeight: 48, borderRadius: 16, border: `1px solid ${ui.colors.border}`, padding: '0 14px', fontSize: 16, fontFamily: 'inherit', color: ui.colors.primaryText, background: ui.colors.elevated } as const;
const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: tokens.font.uiSemibold, fontSize: 13, color: ui.colors.secondaryText },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }
});

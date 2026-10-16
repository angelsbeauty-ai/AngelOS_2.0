import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getAiUsage, type AiUsage } from '../lib/home';
import { tokens } from '../design/theme';

const GREEN = '#8C7A64';

/** AI credit meter: today's uses / daily limit and this month's / monthly limit (counted and enforced by the API). */
export function AiMeter({ workspaceId }: { workspaceId: string | null }) {
  const { t } = useTranslation();
  const [u, setU] = useState<AiUsage | null>(null);
  const [err, setErr] = useState(false);
  useFocusEffect(useCallback(() => { if (!workspaceId) return; void getAiUsage(workspaceId).then((x) => { setU(x); setErr(false); }).catch(() => setErr(true)); }, [workspaceId]));
  if (!workspaceId) return null;
  return <View style={styles.box} accessibilityLabel={u ? `${u.today} of ${u.dailyLimit} AI uses today, ${u.month} of ${u.monthlyLimit} this month` : undefined}>
    <Text style={styles.title}>{t('meter.title', 'AI uses')}</Text>
    {err ? <Text style={styles.muted}>{t('meter.error', 'Usage could not load right now.')}</Text> : !u ? <Text style={styles.muted}>…</Text> : <>
      <Bar label={t('meter.today', 'Today')} n={u.today} max={u.dailyLimit} />
      <Bar label={t('meter.month', 'This month')} n={u.month} max={u.monthlyLimit} />
      {u.limited ? <Text style={styles.limit}>{u.message}</Text> : null}
      {u.unavailable ? <Text style={styles.muted}>{t('meter.unavailable', 'Usage tracking is not available yet.')}</Text> : null}
    </>}
  </View>;
}

function Bar({ label, n, max }: { label: string; n: number; max: number }) {
  const pct = max ? Math.min(1, n / max) : 0;
  const color = pct >= 1 ? '#B3261E' : pct >= 0.8 ? '#4F4A44' : GREEN;
  return <View style={{ gap: 6 }}>
    <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.count}>{n} / {max}</Text></View>
    <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color }]} /></View>
  </View>;
}

const styles = StyleSheet.create({
  box: { gap: 12, padding: 16, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(60,48,32,0.17)' },
  title: { fontFamily: tokens.font.uiBold, fontSize: 16, color: '#151515' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontFamily: tokens.font.uiMedium, fontSize: 14, color: '#151515' },
  count: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: '#151515', fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 4, backgroundColor: '#EFECE6', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  limit: { fontFamily: tokens.font.uiSemibold, fontSize: 14, lineHeight: 20, color: '#B3261E' },
  muted: { fontFamily: tokens.font.ui, fontSize: 14, color: '#6B645B' }
});

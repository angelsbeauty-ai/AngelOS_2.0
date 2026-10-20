import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getAiUsage, type AiUsage } from '../lib/home';
import { getFounderAiUsage } from '../lib/founder';
import { tokens } from '../design/theme';

const GREEN = '#8C7A64';
const usd = (n: number) => `$${n.toFixed(2)}`;

/** Founder: the real OpenAI dollars. Everyone else: today's uses and this month's uses. */
export function AiMeter({ workspaceId, founder = false }: { workspaceId: string | null; founder?: boolean }) {
  const { t } = useTranslation();
  const [u, setU] = useState<AiUsage | null>(null);
  const [bill, setBill] = useState<any>(null);
  const [err, setErr] = useState(false);
  useFocusEffect(useCallback(() => {
    if (!workspaceId) return;
    if (!founder) { void getAiUsage(workspaceId).then((x) => { setU(x); setErr(false); }).catch(() => setErr(true)); return; }
    void getFounderAiUsage().then((x) => { setBill(x); setErr(false); }).catch(() => setErr(true));
  }, [workspaceId, founder]));
  if (!workspaceId) return null;
  if (founder) return <FounderMoney bill={bill} err={err} />;
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

function FounderMoney({ bill, err }: { bill: any; err: boolean }) {
  const { t } = useTranslation();
  const spent = bill?.bill?.usd;
  const credit = bill?.credit;
  const reason = err ? t('founderBill.loadFail') : bill?.available === false ? (bill?.reason ?? t('founderBill.loadFail')) : spent == null ? (bill?.bill?.reason ?? null) : null;
  return <View style={styles.box}>
    <Text style={styles.title}>{t('founderBill.profileTitle', 'AI usage')}</Text>
    {!bill && !err ? <Text style={styles.muted}>…</Text> : <>
      {spent != null ? <>
        <Text style={styles.money}>{usd(spent)}</Text>
        <Text style={styles.label}>{t('founderBill.spent', 'Spent this month')}</Text>
      </> : <Text style={styles.muted}>{reason ?? t('founderBill.loadFail')}</Text>}
      {credit ? <>
        <Text style={styles.moneySm}>{usd(credit.availableUsd)}</Text>
        <Text style={styles.label}>{t('founderBill.left', 'Credit left')}</Text>
        <Text style={styles.muted}>{t('founderBill.of', { used: usd(credit.usedUsd), granted: usd(credit.grantedUsd), defaultValue: '{{used}} used of {{granted}} added' })}</Text>
      </> : bill ? <Text style={styles.muted}>{bill.creditReason ?? t('founderBill.noCredit', 'The AI service did not share how much credit is left.')}</Text> : null}
      <Text style={styles.muted}>{t('founderBill.usdNote', 'The AI service charges in US dollars. AngelOS does not convert this into yen.')}</Text>
    </>}
  </View>;
}

function Bar({ label, n, max }: { label: string; n: number; max: number }) {
  const pct = max ? Math.min(1, n / max) : 0;
  const color = pct >= 1 ? '#B3261E' : pct >= 0.8 ? '#3A3A3C' : GREEN;
  return <View style={{ gap: 6 }}>
    <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.count}>{n} / {max}</Text></View>
    <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color }]} /></View>
  </View>;
}

const styles = StyleSheet.create({
  box: { gap: 12, padding: 16, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#EDEDED' },
  title: { fontFamily: tokens.font.uiBold, fontSize: 16, color: '#151515' },
  money: { fontFamily: tokens.font.uiBold, fontSize: 32, color: '#151515', fontVariant: ['tabular-nums'] },
  moneySm: { fontFamily: tokens.font.uiBold, fontSize: 22, color: '#151515', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontFamily: tokens.font.uiMedium, fontSize: 14, color: '#151515' },
  count: { fontFamily: tokens.font.uiSemibold, fontSize: 14, color: '#151515', fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 4, backgroundColor: '#F2F2F2', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  limit: { fontFamily: tokens.font.uiSemibold, fontSize: 14, lineHeight: 20, color: '#B3261E' },
  muted: { fontFamily: tokens.font.ui, fontSize: 14, lineHeight: 20, color: '#6C6C70' }
});

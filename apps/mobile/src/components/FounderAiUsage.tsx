import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getFounderAiUsage } from '../lib/founder';
import { tokens } from '../design/theme';

const usd = (n: number) => `$${n.toFixed(2)}`;

/** Founder only: the real OpenAI bill this month, split by how many times AngelOS used the assistant. Not a credit percentage. */
export function FounderAiUsage() {
  const { t } = useTranslation();
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { void getFounderAiUsage().then(setD).catch(() => setErr(true)); }, []);
  const bill = d?.bill;
  const reason = err ? t('founderBill.loadFail') : d?.available === false ? (d?.reason ?? t('founderBill.loadFail')) : bill?.reason ?? null;
  const showMoney = !reason && bill?.usd != null;
  return <View style={styles.box}>
    <Text style={styles.title}>{t('founderBill.title')}</Text>
    {!d && !err ? <Text style={styles.muted}>…</Text> : reason ? <Text style={styles.muted}>{reason}</Text> : showMoney ? <>
      <Text style={styles.n}>{usd(bill.usd)}</Text>
      <Text style={styles.l}>{t('founderBill.total')}</Text>
      {d.youUsd != null && d.othersUsd != null ? <>
        <View style={styles.totals}>
          <View style={styles.t}><Text style={styles.nSm}>{usd(d.youUsd)}</Text><Text style={styles.l}>{t('founderBill.you')}</Text></View>
          <View style={styles.t}><Text style={styles.nSm}>{usd(d.othersUsd)}</Text><Text style={styles.l}>{t('founderBill.others')}</Text></View>
        </View>
        <Text style={styles.note}>{t('founderBill.shareNote')}</Text>
        {d.users?.length ? d.users.map((u: any) => <View key={u.userId} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.email} numberOfLines={1}>{u.email ?? '—'}</Text>
            <Text style={styles.meta}>{u.yours ? `${t('founderBill.you')} · ` : ''}{t('founderBill.uses', { n: u.month })}</Text>
          </View>
          <Text style={styles.cell}>{u.usd == null ? '—' : usd(u.usd)}</Text>
        </View>) : null}
      </> : <Text style={styles.note}>{t('founderBill.noSplit')}</Text>}
    </> : <Text style={styles.muted}>{t('founderBill.loadFail')}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  box: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB' },
  title: { fontFamily: tokens.font.uiBold, fontSize: 18, color: '#000' },
  totals: { flexDirection: 'row', marginTop: 4 },
  t: { flex: 1, gap: 2 },
  n: { fontFamily: tokens.font.uiBold, fontSize: 32, color: '#000', fontVariant: ['tabular-nums'] },
  nSm: { fontFamily: tokens.font.uiBold, fontSize: 22, color: '#000', fontVariant: ['tabular-nums'] },
  l: { fontFamily: tokens.font.ui, fontSize: 13, color: '#737373' },
  note: { fontFamily: tokens.font.ui, fontSize: 13, lineHeight: 18, color: '#737373' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EFEFEF' },
  email: { fontFamily: tokens.font.uiMedium, fontSize: 14, color: '#262626' },
  meta: { fontFamily: tokens.font.ui, fontSize: 12, color: '#737373' },
  cell: { fontFamily: tokens.font.uiSemibold, fontSize: 15, color: '#000', fontVariant: ['tabular-nums'] },
  muted: { fontFamily: tokens.font.ui, fontSize: 14, lineHeight: 20, color: '#737373' }
});

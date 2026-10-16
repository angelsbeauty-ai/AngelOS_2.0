import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getFounderAiUsage } from '../lib/founder';
import { tokens } from '../design/theme';

const GREEN = '#1F7A4D';
const usd = (n: number) => `$${n.toFixed(2)}`;

/** Founder: AI uses this month per user and overall, estimated cost vs the monthly cap. */
export function FounderAiUsage() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(false);
  useEffect(() => { void getFounderAiUsage().then(setD).catch(() => setErr(true)); }, []);
  const pct = d?.total ? Math.min(1, d.total.estCostUsd / Math.max(0.01, d.total.capUsd)) : 0;
  return <View style={styles.box}>
    <Text style={styles.title}>AI use this month</Text>
    {err || d?.available === false ? <Text style={styles.muted}>{d?.reason ?? 'AI usage could not load right now.'}</Text> : !d ? <Text style={styles.muted}>…</Text> : <>
      <View style={styles.totals}>
        <View style={styles.t}><Text style={styles.n}>{d.total.uses}</Text><Text style={styles.l}>AI uses</Text></View>
        <View style={styles.t}><Text style={styles.n}>{usd(d.total.estCostUsd)}</Text><Text style={styles.l}>estimated cost</Text></View>
        <View style={styles.t}><Text style={styles.n}>{usd(d.total.capUsd)}</Text><Text style={styles.l}>{d.total.budgetSet ? 'monthly budget' : 'cap (users × limit)'}</Text></View>
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: pct >= 1 ? '#B3261E' : pct >= 0.8 ? '#8A5A00' : GREEN }]} /></View>
      <Text style={styles.note}>Estimate: {usd(d.costPerUseUsd)} per AI use. Limits: {d.users[0]?.dailyLimit ?? 50}/day and {d.users[0]?.monthlyLimit ?? 600}/month per user.</Text>
      {d.users.length ? d.users.map((u: any) => <View key={u.userId} style={styles.row}>
        <Text style={styles.email} numberOfLines={1}>{u.email ?? 'Unknown user'}</Text>
        <Text style={styles.cell}>{u.today} today</Text>
        <Text style={styles.cell}>{u.month}/{u.monthlyLimit}</Text>
        <Text style={styles.cell}>{usd(u.estCostUsd)}</Text>
      </View>) : <Text style={styles.muted}>No AI use yet this month.</Text>}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  box: { gap: 12, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB' },
  title: { fontFamily: tokens.font.uiBold, fontSize: 18, color: '#000' },
  totals: { flexDirection: 'row' }, t: { flex: 1, gap: 2 },
  n: { fontFamily: tokens.font.uiBold, fontSize: 22, color: '#000', fontVariant: ['tabular-nums'] },
  l: { fontFamily: tokens.font.ui, fontSize: 12, color: '#737373' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#EFEFEF', overflow: 'hidden' }, fill: { height: 8 },
  note: { fontFamily: tokens.font.ui, fontSize: 12, color: '#8E8E8E' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EFEFEF' },
  email: { flex: 1, fontFamily: tokens.font.uiMedium, fontSize: 14, color: '#262626' },
  cell: { fontFamily: tokens.font.ui, fontSize: 13, color: '#262626', fontVariant: ['tabular-nums'] },
  muted: { fontFamily: tokens.font.ui, fontSize: 14, color: '#737373' }
});

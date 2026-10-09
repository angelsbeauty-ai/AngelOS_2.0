import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Tabs, fieldStyles } from './Field';
import { Card, SectionTitle, SupportText } from './ui';
import { getBusinessInsights, type BusinessInsights } from '../lib/analytics';
import { formatYen } from '../lib/finance';

/** B6: bookings, no-shows, new vs returning, rebook rate and income — computed from real records only. */
export function BusinessInsightsCard({ workspaceId }: { workspaceId: string }) {
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const [data, setData] = useState<BusinessInsights | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); void getBusinessInsights(workspaceId, Number(days)).then(setData).catch(() => setFailed(true)); }, [workspaceId, days]);
  const money = (n: number) => formatYen(n, data?.currency ?? 'JPY');
  const pct = (n: number | null) => (n == null ? '—' : `${n}%`);
  const rows: Array<[string, string]> = data ? [
    ['Bookings', String(data.bookings)], ['Done', String(data.completed)], ['Cancelled', String(data.cancelled)], ['No-shows', `${data.noShows} (${pct(data.noShowRate)})`],
    ['New clients', String(data.newClients)], ['Returning clients', String(data.returningClients)], ['Rebooked within 90 days', pct(data.rebookRate)],
    ['Money received', `${money(data.income)}${data.incomeChange == null ? '' : ` (${data.incomeChange >= 0 ? '+' : ''}${data.incomeChange}% vs before)`}`]
  ] : [];
  return <Card premium>
    <SectionTitle>Your business</SectionTitle>
    <Tabs value={days} onChange={setDays} options={[{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }, { id: '90', label: '90 days' }]} />
    {failed ? <SupportText>Business numbers are not available right now.</SupportText> : null}
    {!data && !failed ? <SupportText>Loading…</SupportText> : null}
    {rows.map(([k, v]) => <View key={k} style={fieldStyles.line}><SupportText>{k}</SupportText><Text style={fieldStyles.strong}>{v}</Text></View>)}
    {data?.incomeByService.length ? <><SupportText>Money by service</SupportText>{data.incomeByService.slice(0, 6).map((s) => <View key={s.service} style={fieldStyles.line}><Text style={fieldStyles.strong}>{s.service}</Text><Text style={fieldStyles.strong}>{money(s.amount)}</Text></View>)}</> : null}
  </Card>;
}

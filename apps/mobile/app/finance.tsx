import { useEffect, useState } from 'react';
import { Platform, Share, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { ActionButton, Banner, Chip } from '../src/components/MessagingBits';
import { Field, fieldStyles } from '../src/components/Field';
import { Card, ScreenTitle, SectionTitle, StatCard, SupportText, ui } from '../src/components/ui';
import { exportMoneyCsv, formatYen, getMoneySummary, recordExpense, type MoneySummary } from '../src/lib/finance';
import { getActiveWorkspace } from '../src/lib/workspace';
import { dialog } from '../src/lib/dialog';

const METHODS = [['cash', 'Cash'], ['card', 'Card'], ['paypay', 'PayPay'], ['bank_transfer', 'Bank transfer']] as const;
const CATEGORIES = [['supplies', 'Supplies'], ['rent', 'Rent'], ['marketing', 'Marketing'], ['education', 'Education'], ['equipment', 'Equipment'], ['fees', 'Fees'], ['other', 'Other']] as const;
const label = (v: string) => v.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function FinanceScreen() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [data, setData] = useState<MoneySummary | null>(null);
  const [expense, setExpense] = useState<{ open: boolean; amount: string; category: string; method: string; note: string }>({ open: false, amount: '', category: 'supplies', method: 'cash', note: '' });
  useEffect(() => { void load(); }, []);
  async function load() {
    try { const id = workspaceId ?? (await getActiveWorkspace()).id; setWorkspaceId(id); setData(await getMoneySummary(id)); }
    catch (e) { void dialog.notify('Could not load money', e instanceof Error ? e.message : ''); }
  }
  async function saveExpense() {
    if (!workspaceId) return;
    try { await recordExpense(workspaceId, { amount: Number(expense.amount), category: expense.category, method: expense.method, note: expense.note.trim() || undefined, idempotencyKey: `expense:${Date.now()}` }); setExpense({ ...expense, open: false, amount: '', note: '' }); await load(); }
    catch (e) { void dialog.notify('Could not save expense', e instanceof Error ? e.message : ''); }
  }
  async function exportCsv() {
    if (!workspaceId) return;
    try {
      const csv = await exportMoneyCsv(workspaceId);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a'); a.href = url; a.download = `angelos-money-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else await Share.share({ message: csv, title: 'AngelOS money export' });
    } catch (e) { void dialog.notify('Could not export', e instanceof Error ? e.message : ''); }
  }
  const cur = data?.currency ?? 'JPY';
  const money = (n: number) => formatYen(n, cur);
  return <Screen onRefresh={() => load()}>
    <View style={fieldStyles.line}><View style={fieldStyles.grow}><ScreenTitle>Money</ScreenTitle><SupportText>Only money you actually received. Booked prices don't count until paid.</SupportText></View></View>
    <View style={fieldStyles.row}>
      <View style={{ flex: 1, minWidth: 140 }}><StatCard label="Today" value={data ? money(data.income.today) : '—'} detail="received" /></View>
      <View style={{ flex: 1, minWidth: 140 }}><StatCard label="This week" value={data ? money(data.income.week) : '—'} detail="last 7 days" /></View>
      <View style={{ flex: 1, minWidth: 140 }}><StatCard label="This month" value={data ? money(data.income.month) : '—'} detail={data ? `spent ${money(data.expenses.month)}` : 'last 30 days'} /></View>
    </View>
    <View style={fieldStyles.row}>
      <ActionButton kind="primary" label="Record expense" onPress={() => setExpense({ ...expense, open: !expense.open })} />
      <ActionButton label="Export CSV" onPress={() => void exportCsv()} />
    </View>
    <SupportText>To record a payment or deposit, open the booking (Calendar) or the client.</SupportText>
    {data?.expenses.needsMigration ? <Banner tone="warning">Expenses need the database update {data.expenses.needsMigration} (waiting for Angel's yes).</Banner> : null}
    {expense.open ? <Card>
      <SectionTitle>New expense</SectionTitle>
      <Field label="Amount" value={expense.amount} onChangeText={(amount) => setExpense({ ...expense, amount })} keyboardType="number-pad" />
      <View style={fieldStyles.row}>{CATEGORIES.map(([v, l]) => <Chip key={v} label={l} selected={expense.category === v} onPress={() => setExpense({ ...expense, category: v })} />)}</View>
      <View style={fieldStyles.row}>{METHODS.map(([v, l]) => <Chip key={v} label={l} selected={expense.method === v} onPress={() => setExpense({ ...expense, method: v })} />)}</View>
      <Field label="Note" value={expense.note} onChangeText={(note) => setExpense({ ...expense, note })} />
      <ActionButton kind="primary" label="Save expense" disabled={!(Number(expense.amount) > 0)} onPress={() => void saveExpense()} />
    </Card> : null}
    <Card>
      <SectionTitle>Who still owes</SectionTitle>
      {!data?.owes.length ? <SupportText>Nobody. All finished bookings are paid.</SupportText> : data.owes.map((o) => <View key={o.appointmentId} style={fieldStyles.line}>
        <View style={fieldStyles.grow}><Text style={fieldStyles.strong} onPress={() => router.push(`/bookings/${o.appointmentId}` as any)}>{o.clientName ?? 'Client'}</Text><SupportText>{o.service} · {new Date(o.startAt).toLocaleDateString()}</SupportText></View>
        <Text style={[fieldStyles.strong, { color: ui.colors.critical }]}>{money(o.due)}</Text>
      </View>)}
      <SupportText>AngelOS never reminds a client about money on its own.</SupportText>
    </Card>
    <Card>
      <SectionTitle>By payment method (30 days)</SectionTitle>
      {data && Object.keys(data.byMethod).length ? Object.entries(data.byMethod).map(([m, v]) => <View key={m} style={fieldStyles.line}><Text style={fieldStyles.strong}>{label(m)}</Text><Text style={fieldStyles.strong}>{money(v)}</Text></View>) : <SupportText>No payments yet.</SupportText>}
    </Card>
    <Card>
      <SectionTitle>Recent</SectionTitle>
      {data?.recent.length ? data.recent.slice(0, 30).map((r) => <View key={`${r.kind}-${r.id}`} style={fieldStyles.line}>
        <View style={fieldStyles.grow}><Text style={fieldStyles.strong}>{r.kind === 'expense' ? `Expense · ${label(r.type)}` : `${label(r.type)}${r.who ? ` · ${r.who}` : ''}`}</Text><SupportText>{r.method ? label(r.method) : '—'} · {new Date(r.at).toLocaleDateString()}{r.note ? ` · ${r.note}` : ''}</SupportText></View>
        <Text style={[fieldStyles.strong, (r.kind === 'expense' || r.type === 'refund') && { color: ui.colors.critical }]}>{r.kind === 'expense' || r.type === 'refund' ? '−' : ''}{money(Math.abs(r.amount))}</Text>
      </View>) : <SupportText>Nothing recorded yet.</SupportText>}
    </Card>
  </Screen>;
}

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppearance } from '../design/appearance';
import { tokens } from '../design/theme';

export type ToolCard = { tool: string; data: Record<string, any> };

/** Neutral answer card drawn ONLY from the tool JSON (X02 analytics, X03 unread). A null value shows as Unavailable. */
export function AnswerCard({ card }: { card: ToolCard }) {
  const { t, i18n } = useTranslation();
  const { palette, mode } = useAppearance();
  const night = mode === 'night';
  const locale = i18n.language === 'ja' ? 'ja-JP' : 'en-US';
  const na = t('home.unavailable', 'Unavailable');
  const num = (v: unknown) => (typeof v === 'number' ? v.toLocaleString(locale) : na);
  const money = (v: unknown, cur?: string | null) => (typeof v === 'number' ? new Intl.NumberFormat(locale, { style: 'currency', currency: cur || 'JPY', maximumFractionDigits: 0 }).format(v) : na);
  const d = card.data ?? {};
  const bg = night ? '#161618' : '#FFFFFF';
  const tile = night ? '#232326' : '#F3F3F3';
  const dateFmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '');

  if (card.tool === 'get_analytics') {
    const weeks: Array<number | null> = Array.isArray(d.weekly_reach) ? d.weekly_reach : [];
    const max = Math.max(1, ...weeks.map((w) => w ?? 0));
    const change = typeof d.followers_change === 'number' ? `${d.followers_change > 0 ? '+' : ''}${d.followers_change.toLocaleString(locale)}` : na;
    const tiles: Array<[string, string, string]> = [
      [t('ai.card.reach', 'Reach'), num(d.reach), typeof d.reach_before === 'number' ? t('ai.card.vsBefore', { defaultValue: 'vs {{n}} before', n: d.reach_before.toLocaleString(locale) }) : ''],
      [t('ai.card.followers', 'Followers'), change, typeof d.followers === 'number' ? t('ai.card.now', { defaultValue: 'now {{n}}', n: d.followers.toLocaleString(locale) }) : ''],
      [t('ai.card.bookings', 'Bookings'), num(d.bookings), money(d.booking_value, d.currency)],
      [t('ai.card.fromIg', 'From Instagram'), num(d.bookings_from_instagram), typeof d.bookings === 'number' ? t('ai.card.of', { defaultValue: 'of {{n}}', n: d.bookings }) : '']
    ];
    return <View style={[styles.card, { backgroundColor: bg, borderColor: palette.border }]}>
      <Text style={[styles.over, { color: palette.muted }]}>{t('ai.card.analytics', 'Analytics')} · {dateFmt(d.from)} – {dateFmt(d.to)}</Text>
      <View style={styles.grid}>{tiles.map(([label, value, sub]) => <View key={label} style={[styles.tile, { backgroundColor: tile }]}>
        <Text style={[styles.label, { color: palette.muted }]}>{label}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.value, { color: palette.text }]}>{value}</Text>
        {sub ? <Text numberOfLines={1} style={[styles.sub, { color: palette.muted }]}>{sub}</Text> : null}
      </View>)}</View>
      {weeks.length ? <View accessibilityLabel={t('ai.card.weekly', 'Reach per week · last 8 weeks')} style={styles.bars}>{weeks.map((w, i) => <View key={i} style={[styles.bar, { height: w == null ? 4 : Math.max(6, (w / max) * 48), backgroundColor: w == null ? tile : i >= weeks.length - 4 ? (night ? '#E4E4E6' : '#151515') : (night ? '#4A4A4E' : '#BDBDC2') }]} />)}</View> : null}
      <Text style={[styles.sub, { color: palette.muted }]}>{t('ai.card.weekly', 'Reach per week · last 8 weeks')}</Text>
    </View>;
  }
  if (card.tool === 'list_threads') {
    const list: any[] = Array.isArray(d.threads) ? d.threads : [];
    return <View style={[styles.card, { backgroundColor: bg, borderColor: palette.border }]}>
      <Text style={[styles.over, { color: palette.muted }]}>{t('ai.card.unread', { defaultValue: '{{n}} conversations', n: d.count ?? list.length })}</Text>
      {list.slice(0, 5).map((th) => <View key={th.id} style={[styles.row, { borderTopColor: palette.border }]}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: palette.text }]}>{th.name ?? '—'}</Text>
        <Text style={[styles.sub, { color: palette.muted }]}>{th.platform ? String(th.platform).toUpperCase() : ''}{th.needs_reply ? ` · ${t('messages.needsReplyTag')}` : ''}</Text>
      </View>)}
      <Text style={[styles.sub, { color: palette.muted }]}>{t('ai.card.draftOnly', 'Replies are drafted only. Nothing is sent until you tap Approve.')}</Text>
    </View>;
  }
  if (card.tool === 'get_money') {
    return <View style={[styles.card, { backgroundColor: bg, borderColor: palette.border }]}>
      <Text style={[styles.over, { color: palette.muted }]}>{t('ai.card.money', 'Money')} · {String(d.period ?? '')}</Text>
      <View style={styles.grid}>{([[t('ai.card.received', 'Received'), money(d.received, d.currency)], [t('ai.card.spent', 'Spent'), money(d.spent, d.currency)]] as const).map(([l, v]) => <View key={l} style={[styles.tile, { backgroundColor: tile }]}><Text style={[styles.label, { color: palette.muted }]}>{l}</Text><Text style={[styles.value, { color: palette.text }]}>{v}</Text></View>)}</View>
    </View>;
  }
  return null;
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  over: { fontFamily: tokens.font.uiSemibold, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  tile: { width: '48.5%', borderRadius: 14, padding: 12, gap: 2 },
  label: { fontFamily: tokens.font.uiMedium, fontSize: 13 },
  value: { fontFamily: tokens.font.uiBold, fontSize: 24, lineHeight: 30 },
  sub: { fontFamily: tokens.font.ui, fontSize: 13 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 52 },
  bar: { flex: 1, borderRadius: 6 },
  row: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 2 },
  rowTitle: { fontFamily: tokens.font.uiSemibold, fontSize: 15 }
});

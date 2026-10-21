import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppearance } from '../design/appearance';
import { tokens } from '../design/theme';
import { dialog } from '../lib/dialog';
import { markVariantPosted, publishContentVariant, type ContentVariant } from '../lib/content';

const NAME: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', line: 'LINE', tiktok: 'TikTok', threads: 'Threads' };
const nameOf = (p: string) => NAME[p.split('_')[0]] ?? p;

/**
 * Why a post didn't go out, in plain words, from the latest publish attempt.
 * An unconfirmed Meta post is "check first": the only actions are Mark as posted, or an explicit
 * "it's not there" confirm, so Try again can never post twice.
 */
export function PublishFailureNote({ ws, variants, onChanged, hideRetry }: { ws: string; variants: ContentVariant[]; onChanged: () => void; hideRetry?: boolean }) {
  const { t } = useTranslation();
  const { palette, mode } = useAppearance();
  const [busy, setBusy] = useState(false);
  const red = mode === 'night' ? '#FF453A' : '#D70015';
  const failed = variants.filter((v) => v.status === 'failed');
  if (!failed.length) return null;
  return <View style={{ gap: 10 }}>{failed.map((v) => {
    const p = nameOf(v.platform);
    const check = Boolean(v.needs_check);
    async function markPosted() { setBusy(true); try { await markVariantPosted(ws, v.id); onChanged(); } catch (e) { void dialog.notify(t('pub.why'), e instanceof Error ? e.message : ''); } finally { setBusy(false); } }
    async function postAnyway() {
      const yes = await dialog.confirm({ title: t('pub.postAnywayTitle'), message: t('pub.postAnywayBody', { p }), confirmText: t('pub.postAnyway'), cancelText: t('sched.keepScheduled', 'Keep') });
      if (!yes) return;
      setBusy(true); try { await publishContentVariant(ws, v.id, { confirmNotPosted: true }); onChanged(); } catch (e) { void dialog.notify(t('pub.why'), e instanceof Error ? e.message : ''); } finally { setBusy(false); }
    }
    return <View key={v.id} accessibilityLiveRegion="polite" style={[styles.box, { backgroundColor: palette.fill }]}>
      <Text maxFontSizeMultiplier={1.6} style={[styles.title, { color: check ? palette.text : red }]}>{check ? t('pub.needsCheckTitle') : `${t('pub.why')} · ${p}`}</Text>
      <Text maxFontSizeMultiplier={1.6} style={[styles.body, { color: palette.muted }]}>{check ? t('pub.needsCheckBody', { p }) : (v.publish_error || t('pub.unknownReason'))}</Text>
      {check && !hideRetry ? <View style={styles.row}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void markPosted()} style={[styles.btn, { borderColor: palette.border }]}><Text style={[styles.btnText, { color: palette.text }]}>{t('pub.markPosted')}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void postAnyway()} style={[styles.btn, { borderColor: palette.border }]}><Text style={[styles.btnText, { color: palette.text }]}>{t('pub.postAnyway')}</Text></Pressable>
      </View> : null}
    </View>;
  })}</View>;
}

const styles = StyleSheet.create({
  box: { borderRadius: 14, padding: 14, gap: 6 },
  title: { fontFamily: tokens.font.uiSemibold, fontSize: 15 },
  body: { fontFamily: tokens.font.ui, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  btn: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  btnText: { fontFamily: tokens.font.uiSemibold, fontSize: 14 }
});

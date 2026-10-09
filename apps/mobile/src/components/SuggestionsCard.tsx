import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, SectionTitle, SupportText, ui } from './ui';
import { ActionButton } from './MessagingBits';
import { dialog } from '../lib/dialog';
import { toFriendly } from '../lib/friendly-error';
import { approveSuggestion, dismissSuggestion, listSuggestions, type Suggestion } from '../lib/suggestions';
import { tokens } from '../design/theme';

/**
 * "AngelOS suggests": each card has Approve / Edit / Dismiss.
 * Approve only creates a DRAFT (reply or post). Sending/publishing always needs another Approve.
 */
export function SuggestionsCard({ workspaceId, limit, showAllLink = true }: { workspaceId: string | null; limit?: number; showAllLink?: boolean }) {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try { setItems((await listSuggestions(workspaceId)).suggestions); setFailed(false); }
    catch { setFailed(true); }
  }, [workspaceId]);
  useEffect(() => { void load(); }, [load]);

  if (!workspaceId) return null;
  const visible = (items ?? []).filter((item) => !hidden.has(item.key));
  const shown = limit ? visible.slice(0, limit) : visible;

  async function approve(item: Suggestion) {
    setBusy(item.key);
    try {
      const result = await approveSuggestion(workspaceId!, item.key);
      setHidden((prev) => new Set(prev).add(item.key));
      if (result.threadId) router.push(`/messages/${result.threadId}` as any);
      else if (result.contentPostId) router.push(`/content/${result.contentPostId}` as any);
    } catch (error) {
      const f = toFriendly(error, { action: 'save' });
      void dialog.notify(f.title, error instanceof Error && error.message ? error.message : f.message);
    } finally { setBusy(null); }
  }

  function edit(item: Suggestion) {
    if (item.kind === 'draft_reply') router.push(`/messages/${item.input.threadId}` as any);
    else router.push({ pathname: '/content/new', params: { date: item.input.date } } as any);
  }

  async function dismiss(item: Suggestion) {
    setHidden((prev) => new Set(prev).add(item.key));
    await dismissSuggestion(workspaceId!, item.key).catch(() => undefined);
  }

  return <Card premium>
    <View style={styles.head}><SectionTitle>AngelOS suggests</SectionTitle>{showAllLink && visible.length > shown.length ? <Pressable accessibilityRole="link" onPress={() => router.push('/suggestions' as any)}><Text style={styles.link}>All {visible.length}</Text></Pressable> : null}</View>
    {items === null && !failed ? <SupportText>Looking at your day…</SupportText> : null}
    {failed ? <SupportText>Suggestions are not available right now.</SupportText> : null}
    {items !== null && visible.length === 0 ? <SupportText>Nothing to suggest right now. Your social calendar and inbox look good.</SupportText> : null}
    {shown.map((item) => <View key={item.key} style={styles.item}>
      <Text style={styles.kind}>{item.kind === 'create_post_draft' ? 'SOCIAL' : 'MESSAGES'}</Text>
      <Text style={styles.title} maxFontSizeMultiplier={1.3}>{item.title}</Text>
      {item.preview ? <Text numberOfLines={2} style={styles.preview}>"{item.preview}"</Text> : null}
      <SupportText>{item.detail}</SupportText>
      <View style={styles.actions}>
        <ActionButton kind="primary" label={busy === item.key ? 'Working…' : 'Approve'} disabled={Boolean(busy)} onPress={() => void approve(item)} />
        <ActionButton label="Edit" onPress={() => edit(item)} />
        <ActionButton kind="quiet" label="Dismiss" onPress={() => void dismiss(item)} />
      </View>
    </View>)}
  </Card>;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontFamily: tokens.font.uiBold, fontSize: 14, color: tokens.color.tide, padding: 6 },
  item: { gap: 6, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.colors.border },
  kind: { fontFamily: tokens.font.uiSemibold, fontSize: 11, letterSpacing: 1.2, color: ui.colors.secondaryText },
  title: { fontFamily: tokens.font.uiSemibold, fontSize: 16, color: ui.colors.primaryText },
  preview: { fontFamily: tokens.font.ui, fontSize: 15, fontStyle: 'italic', color: ui.colors.secondaryText },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }
});

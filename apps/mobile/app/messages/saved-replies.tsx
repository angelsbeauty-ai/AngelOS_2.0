import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ErrorState } from '../../src/components/ErrorState';
import { Card, EmptyState, ScreenTitle, SectionTitle, SupportText, ui } from '../../src/components/ui';
import { ActionButton, Banner, BilingualBlock, Chip } from '../../src/components/MessagingBits';
import { dialog } from '../../src/lib/dialog';
import { toFriendly } from '../../src/lib/friendly-error';
import { addStarterSavedReplies, createSavedReply, deleteSavedReply, listSavedReplies, translateText, updateSavedReply, type SavedReply } from '../../src/lib/messaging';
import { getActiveWorkspace } from '../../src/lib/workspace';
import { tokens } from '../../src/design/theme';

const CATEGORIES = [
  ['prices', 'Prices'], ['directions', 'Directions'], ['deposit', 'Deposit'], ['aftercare', 'Aftercare'], ['cancellation', 'Cancellation'], ['booking', 'Booking'], ['follow_up', 'Follow-up'], ['other', 'Other']
] as const;
type Form = { id?: string; title: string; category: string; bodyEn: string; bodyJa: string };
const EMPTY: Form = { title: '', category: 'other', bodyEn: '', bodyJa: '' };

export default function SavedRepliesScreen() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [replies, setReplies] = useState<SavedReply[]>([]);
  const [needsMigration, setNeedsMigration] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [form, setForm] = useState<Form | null>(null);
  const [jaMeaning, setJaMeaning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const ws = (await getActiveWorkspace()).id; setWorkspaceId(ws);
      const result = await listSavedReplies(ws);
      setReplies(result.replies.filter((item) => (item.status ?? 'approved') === 'approved'));
      setNeedsMigration(result.needsMigration); setState('ready');
    } catch { setState('error'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function act(task: () => Promise<unknown>) {
    setBusy(true);
    try { await task(); await load(); }
    catch (error) { const f = toFriendly(error, { action: 'save' }); void dialog.notify(f.title, error instanceof Error && error.message ? error.message : f.message); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!workspaceId || !form) return;
    const input = { title: form.title.trim(), category: form.category, bodyEn: form.bodyEn.trim(), bodyJa: form.bodyJa.trim() };
    await act(async () => {
      if (form.id) await updateSavedReply(workspaceId, form.id, input); else await createSavedReply(workspaceId, input);
      setForm(null); setJaMeaning(null);
    });
  }

  if (state === 'error') return <Screen><ErrorState title="We couldn't load saved replies" message="Check your connection and try again." onRetry={() => { setState('loading'); void load(); }} /></Screen>;

  return <Screen>
    <ScreenTitle>Saved replies</ScreenTitle>
    <SupportText>Answers you send again and again. AngelOS uses them when it drafts replies. Words in [brackets] must be filled in before a reply can be approved.</SupportText>
    {needsMigration ? <Banner tone="warning"><SupportText tone="warning">Saved replies need the database update {needsMigration}. It is waiting for your yes.</SupportText></Banner> : null}

    {form ? <Card premium>
      <SectionTitle>{form.id ? 'Edit reply' : 'New reply'}</SectionTitle>
      <TextInput accessibilityLabel="Title" value={form.title} onChangeText={(title) => setForm({ ...form, title })} placeholder="Title, e.g. Aftercare" placeholderTextColor={ui.colors.secondaryText} style={styles.input} />
      <View style={styles.chips}>{CATEGORIES.map(([key, label]) => <Chip key={key} label={label} selected={form.category === key} onPress={() => setForm({ ...form, category: key })} />)}</View>
      <Text style={styles.label}>English</Text>
      <TextInput accessibilityLabel="English text" value={form.bodyEn} onChangeText={(bodyEn) => setForm({ ...form, bodyEn })} multiline placeholder="Use {name} for the client's name" placeholderTextColor={ui.colors.secondaryText} style={[styles.input, styles.multi]} />
      <Text style={styles.label}>日本語 (Japanese)</Text>
      <TextInput accessibilityLabel="Japanese text" value={form.bodyJa} onChangeText={(bodyJa) => { setForm({ ...form, bodyJa }); setJaMeaning(null); }} multiline placeholder="Tap 'Translate English to Japanese'" placeholderTextColor={ui.colors.secondaryText} style={[styles.input, styles.multi]} />
      <View style={styles.chips}>
        <ActionButton label="Translate English to Japanese" disabled={busy || !form.bodyEn.trim() || !workspaceId} onPress={() => void act(async () => { const ja = (await translateText(workspaceId!, form.bodyEn.trim(), 'ja')).translation; setForm({ ...form, bodyJa: ja }); setJaMeaning(form.bodyEn.trim()); })} />
        {form.bodyJa.trim() && !jaMeaning ? <ActionButton label="Show English meaning" disabled={busy} onPress={() => void act(async () => setJaMeaning((await translateText(workspaceId!, form.bodyJa.trim(), 'en')).translation))} /> : null}
      </View>
      {form.bodyJa.trim() ? <BilingualBlock ja={form.bodyJa} en={jaMeaning} labelJa="日本語" /> : null}
      <View style={styles.chips}>
        <ActionButton kind="primary" label={busy ? 'Saving…' : 'Save'} disabled={busy || !form.title.trim() || (!form.bodyEn.trim() && !form.bodyJa.trim())} onPress={() => void save()} />
        <ActionButton kind="quiet" label="Cancel" onPress={() => { setForm(null); setJaMeaning(null); }} />
      </View>
    </Card> : <View style={styles.chips}>
      <ActionButton kind="primary" label="+ New saved reply" onPress={() => setForm({ ...EMPTY })} />
      <ActionButton label="Add 5 starter replies" disabled={busy || Boolean(needsMigration) || !workspaceId} onPress={() => void act(() => addStarterSavedReplies(workspaceId!))} />
    </View>}

    {state === 'loading' ? <Card><SupportText>Loading…</SupportText></Card> : null}
    {state === 'ready' && replies.length === 0 && !needsMigration ? <Card><EmptyState title="No saved replies yet" message="Add the 5 starters (prices, directions, deposit, aftercare, cancellation) and fill in your details." /></Card> : null}

    {replies.map((item) => <Card key={item.id}>
      <View style={styles.rowHead}><Text style={styles.title}>{item.title}</Text><SupportText>{CATEGORIES.find(([key]) => key === item.category)?.[1] ?? 'Other'}</SupportText></View>
      {item.body_ja ? <BilingualBlock ja={item.body_ja} en={item.body_en} labelJa="日本語" labelEn="English version" /> : <Text style={styles.body}>{item.body_en}</Text>}
      {/\[[^\]\n]{1,40}\]/.test(`${item.body_en ?? ''}${item.body_ja ?? ''}`) ? <SupportText tone="warning">Has [brackets] to fill in.</SupportText> : null}
      <View style={styles.chips}>
        <ActionButton label="Edit" onPress={() => { setForm({ id: item.id, title: item.title, category: item.category, bodyEn: item.body_en ?? '', bodyJa: item.body_ja ?? '' }); setJaMeaning(item.body_en); }} />
        <ActionButton kind="quiet" label="Delete" onPress={() => void dialog.confirm({ title: `Delete "${item.title}"?`, confirmText: 'Delete', destructive: true }).then((ok) => { if (ok && workspaceId) void act(() => deleteSavedReply(workspaceId, item.id)); })} />
      </View>
    </Card>)}
  </Screen>;
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: ui.colors.border, borderRadius: 20, backgroundColor: tokens.color.raised, color: ui.colors.primaryText, padding: 14, fontSize: 16, fontFamily: tokens.font.ui },
  multi: { minHeight: 100, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { fontFamily: tokens.font.uiSemibold, fontSize: 13, color: ui.colors.secondaryText },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontFamily: tokens.font.uiBold, fontSize: 16, color: ui.colors.primaryText },
  body: { fontFamily: tokens.font.ui, fontSize: 15, lineHeight: 21, color: ui.colors.primaryText }
});

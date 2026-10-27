import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ScreenTitle, SupportText, Button } from '../../src/components/ui';
import { apiFetch } from '../../src/lib/api';
import { setActiveWorkspace } from '../../src/lib/workspace';
import { useAppearance } from '../../src/design/appearance';
import { tokens } from '../../src/design/theme';
import { dialog } from '../../src/lib/dialog';
import { friendlyText } from '../../src/lib/friendly-error';

export default function NewWorkspaceScreen() {
  const { palette } = useAppearance();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const ws = await apiFetch<{ id: string }>('/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), timezone: 'Asia/Tokyo', currency: 'JPY', locale: 'ja' })
      });
      await setActiveWorkspace(ws.id);
      void dialog.notify('Business created', name.trim());
      router.replace('/');
    } catch (e) {
      void dialog.notify('Could not create', friendlyText(e, { action: 'save' }).message);
    } finally { setBusy(false); }
  }

  return <Screen>
    <ScreenTitle>New business</ScreenTitle>
    <SupportText>Create another business. You can switch between them on Home.</SupportText>
    <TextInput value={name} onChangeText={setName} placeholder="Business name" placeholderTextColor={palette.muted} style={[styles.input, { color: palette.text, borderColor: palette.border }]} />
    <Button label={busy ? 'Creating…' : 'Create'} onPress={() => void create()} disabled={!name.trim() || busy} />
  </Screen>;
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontFamily: tokens.font.ui, fontSize: 16 }
});

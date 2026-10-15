import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { dialog } from '../../src/lib/dialog';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { BodyText, Button, Card, SupportText, ui } from '../../src/components/ui';
import { importMedia } from '../../src/lib/media';
import { getActiveWorkspace } from '../../src/lib/workspace';

export default function ImportMediaScreen() {
  const { t } = useTranslation();
  const router = useRouter(); const params = useLocalSearchParams<{ clientId?: string; role?: string }>(); const [busy, setBusy] = useState(false);
  async function pickFromPhotos() { const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) { void dialog.notify(t('imp.photosPerm'), t('imp.photosPermMsg')); return; } const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: 20, quality: 1 }); if (result.canceled) return; setBusy(true); try { const workspace = await getActiveWorkspace(); for (const selected of result.assets) { const filename = selected.fileName || `angelos_${Date.now()}.${selected.type === 'video' ? 'mp4' : 'jpg'}`; const mimeType = selected.mimeType || (selected.type === 'video' ? 'video/mp4' : 'image/jpeg'); await importMedia(workspace.id, { uri: selected.uri, filename, mimeType, sizeBytes: selected.fileSize, width: selected.width, height: selected.height, durationMs: selected.duration ?? undefined, source: 'phone_photos' }, { clientId: params.clientId, role: params.role ?? 'other', marketingPermission: 'unknown' }); } void dialog.notify(t('imp.saved'), t('imp.savedN', { count: result.assets.length })); router.back(); } catch (error) { void dialog.notify(t('imp.fail'), error instanceof Error ? error.message : t('imp.unknown')); } finally { setBusy(false); } }
  async function takePhoto() { const permission = await ImagePicker.requestCameraPermissionsAsync(); if (!permission.granted) { void dialog.notify(t('imp.camPerm'), t('imp.camPermMsg')); return; } const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }); if (result.canceled) return; setBusy(true); try { const workspace = await getActiveWorkspace(); const selected = result.assets[0]; await importMedia(workspace.id, { uri: selected.uri, filename: selected.fileName || `camera_${Date.now()}.jpg`, mimeType: selected.mimeType || 'image/jpeg', sizeBytes: selected.fileSize, width: selected.width, height: selected.height, source: 'camera' }, { clientId: params.clientId, role: params.role ?? 'other', marketingPermission: 'unknown' }); void dialog.notify(t('imp.saved'), t('imp.savedOne')); router.back(); } catch (error) { void dialog.notify(t('imp.fail'), error instanceof Error ? error.message : t('imp.unknown')); } finally { setBusy(false); } }

  return <Screen hideAsk>
    <Stack.Screen options={{ headerRight: () => <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.back()} hitSlop={8}><Text style={styles.cancel}>{t('imp.cancel')}</Text></Pressable> }} />
    <SupportText>{t('imp.lead')}</SupportText>
    {params.clientId ? <Card><BodyText>{t('imp.linked')}</BodyText></Card> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void pickFromPhotos()} style={({ pressed }) => [styles.primary, (busy || pressed) && { opacity: 0.7 }]}>
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{t('imp.choose')}</Text>}
    </Pressable>
    <Button variant="secondary" label={t('imp.take')} disabled={busy} onPress={() => void takePhoto()} />
  </Screen>;
}

const styles = StyleSheet.create({
  primary: { minHeight: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#B07A6A' },
  primaryText: { color: '#FFFFFF', fontFamily: 'Manrope_700Bold', fontSize: 16 },
  cancel: { color: ui.colors.primaryText, fontFamily: 'Manrope_600SemiBold', fontSize: 16, paddingHorizontal: 8 }
});

import { useCallback, useEffect, useRef, useState, createElement } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Card, ScreenTitle, SectionTitle, SupportText, ui } from '../../src/components/ui';
import { ActionButton, Banner, Chip } from '../../src/components/MessagingBits';
import { tokens } from '../../src/design/theme';
import { dialog } from '../../src/lib/dialog';
import { getClient, listClients } from '../../src/lib/clients';
import { getMediaViewUrl, importMedia, listMedia, type MediaAsset } from '../../src/lib/media';
import { getActiveWorkspace } from '../../src/lib/workspace';

type Layout = 'side' | 'stack' | 'three';
type Ratio = '1:1' | '4:5' | '9:16';
const RATIO: Record<Ratio, number> = { '1:1': 1, '4:5': 4 / 5, '9:16': 9 / 16 };
const LABELS = { en: ['Before', 'After', 'Healed'], ja: ['ビフォー', 'アフター', '定着後'] };
const ROLE_ORDER = ['before', 'after', 'healed', 'touch_up'];
const marketingOk = (a: MediaAsset) => a.media_type === 'image' && a.upload_status === 'uploaded' && ['marketing_approved', 'limited'].includes(a.marketing_permission);

function loadImage(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const img = new (globalThis as any).Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load a photo'));
    img.src = url;
  });
}

/** Draws the before/after image on a web canvas. Returns a JPEG blob. */
async function render(canvas: any, opts: { urls: string[]; layout: Layout; ratio: Ratio; labels: 'en' | 'ja' | 'none'; watermark: string | null }) {
  const W = 1080; const H = Math.round(W / RATIO[opts.ratio]);
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#F4EFEA'; ctx.fillRect(0, 0, W, H);
  const images = await Promise.all(opts.urls.map(loadImage));
  const n = images.length;
  const cells = opts.layout === 'stack'
    ? images.map((_, i) => ({ x: 0, y: (H / n) * i, w: W, h: H / n }))
    : images.map((_, i) => ({ x: (W / n) * i, y: 0, w: W / n, h: H }));
  images.forEach((img, i) => {
    const c = cells[i];
    const scale = Math.max(c.w / img.width, c.h / img.height);
    const sw = c.w / scale, sh = c.h / scale;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, c.x, c.y, c.w, c.h);
    if (i > 0) { ctx.fillStyle = '#FFFFFF'; if (opts.layout === 'stack') ctx.fillRect(0, c.y - 3, W, 6); else ctx.fillRect(c.x - 3, 0, 6, H); }
    if (opts.labels !== 'none') {
      const text = LABELS[opts.labels][i] ?? '';
      ctx.font = '600 40px sans-serif';
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(42,39,37,0.72)';
      ctx.fillRect(c.x + 24, c.y + 24, tw + 40, 64);
      ctx.fillStyle = '#FFFFFF'; ctx.fillText(text, c.x + 44, c.y + 70);
    }
  });
  if (opts.watermark) {
    ctx.globalAlpha = 0.4; ctx.font = 'italic 600 44px serif'; ctx.fillStyle = '#FFFFFF';
    const tw = ctx.measureText(opts.watermark).width;
    ctx.fillText(opts.watermark, W - tw - 36, H - 40); ctx.globalAlpha = 1;
  }
  return new Promise<any>((resolve, reject) => canvas.toBlob((b: any) => (b ? resolve(b) : reject(new Error('Could not create the image (photo host blocked it).'))), 'image/jpeg', 0.9));
}

export default function BeforeAfterScreen() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [studio, setStudio] = useState('');
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<Array<{ id: string; display_name: string }>>([]);
  const [client, setClient] = useState<{ id: string; name: string; consentOk: boolean } | null>(null);
  const [photos, setPhotos] = useState<Array<MediaAsset & { role: string; url?: string }>>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [layout, setLayout] = useState<Layout>('side');
  const [ratio, setRatio] = useState<Ratio>('4:5');
  const [labels, setLabels] = useState<'en' | 'ja' | 'none'>('ja');
  const [watermark, setWatermark] = useState(true);
  const [result, setResult] = useState<{ url: string; blob: any } | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<any>(null);

  useFocusEffect(useCallback(() => { void (async () => { const ws = await getActiveWorkspace(); setWorkspaceId(ws.id); setStudio((ws as any).name ?? ''); })(); }, []));
  useEffect(() => { if (!workspaceId) return; const t = setTimeout(() => { listClients(workspaceId, search).then((r: any) => setClients(r.slice(0, 8))).catch(() => setClients([])); }, 250); return () => clearTimeout(t); }, [workspaceId, search]);

  async function pickClient(id: string, name: string) {
    if (!workspaceId) return;
    setClient(null); setPhotos([]); setPicked([]); setResult(null);
    const [detail, media] = await Promise.all([getClient(workspaceId, id), listMedia(workspaceId, { clientId: id })]);
    const consents: any[] = (detail as any).consents ?? [];
    const latest = (type: string) => consents.find((c) => c.consent_type === type);
    const consentOk = [latest('photo_video'), latest('marketing')].some((c) => c?.status === 'granted');
    setClient({ id, name, consentOk });
    const rows = media.filter(marketingOk).map((a) => ({ ...a, role: a.links?.find((l) => l.client_id === id)?.role ?? 'other' }))
      .sort((a, b) => (ROLE_ORDER.indexOf(a.role) + 1 || 9) - (ROLE_ORDER.indexOf(b.role) + 1 || 9));
    const withUrls = await Promise.all(rows.slice(0, 18).map(async (r) => ({ ...r, url: await getMediaViewUrl(workspaceId, r.id).then((u) => u.url).catch(() => undefined) })));
    setPhotos(withUrls);
  }

  const need = layout === 'three' ? 3 : 2;
  async function make() {
    if (!canvasRef.current) return;
    setBusy(true);
    try {
      const urls = picked.map((id) => photos.find((p) => p.id === id)?.url).filter(Boolean) as string[];
      const blob = await render(canvasRef.current, { urls, layout: layout === 'three' ? 'side' : layout, ratio, labels, watermark: watermark ? (studio || 'Angels Beauty') : null });
      setResult({ url: (globalThis as any).URL.createObjectURL(blob), blob });
    } catch (e) { void dialog.notify('Could not make the image', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  async function useInPost() {
    if (!workspaceId || !result || !client) return;
    setBusy(true);
    try {
      const asset = await importMedia(workspaceId, { uri: result.url, filename: `before-after-${Date.now()}.jpg`, mimeType: 'image/jpeg', sizeBytes: result.blob.size, source: 'phone_files' },
        { clientId: client.id, role: 'content_source', marketingPermission: 'marketing_approved' });
      router.push({ pathname: '/content/new', params: { mediaId: asset.id, title: `Before & after: ${client.name.split(' ')[0]}`, goal: 'bookings' } } as any);
    } catch (e) { void dialog.notify('Could not save the image', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  return <Screen>
    <ScreenTitle>Before & after</ScreenTitle>
    <SupportText>Only photos marked "OK for marketing" from clients with photo consent can be used.</SupportText>
    {Platform.OS !== 'web' ? <Banner tone="warning"><SupportText>The before/after maker works in the web version for now (the phone version needs a new app build, which Angel decides on).</SupportText></Banner> : null}

    <Card>
      <SectionTitle>1. Client</SectionTitle>
      <TextInput accessibilityLabel="Search clients" value={search} onChangeText={setSearch} placeholder="Search a client" placeholderTextColor={ui.colors.secondaryText} style={styles.input} />
      <View style={styles.chips}>{clients.map((c) => <Chip key={c.id} label={c.display_name} selected={client?.id === c.id} onPress={() => void pickClient(c.id, c.display_name)} />)}</View>
    </Card>

    {client ? <Card>
      <SectionTitle>2. Photos ({picked.length}/{need})</SectionTitle>
      {!client.consentOk ? <Banner tone="warning"><SupportText>Needs photo consent. Open {client.name}'s page and add the photo/marketing consent first.</SupportText><ActionButton label="Open client" onPress={() => router.push(`/clients/${client.id}`)} /></Banner> : null}
      {client.consentOk && !photos.length ? <SupportText>No photos with marketing permission for this client yet. Tag photos before/after and turn on "OK for marketing".</SupportText> : null}
      {client.consentOk ? <View style={styles.grid}>{photos.map((p) => {
        const index = picked.indexOf(p.id);
        return <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${p.role} photo`} onPress={() => setPicked((cur) => index >= 0 ? cur.filter((x) => x !== p.id) : cur.length >= need ? cur : [...cur, p.id])} style={[styles.thumb, index >= 0 && styles.thumbOn]}>
          {p.url ? <Image source={{ uri: p.url }} style={styles.thumbImg} /> : null}
          <Text style={styles.thumbTag}>{index >= 0 ? `${index + 1} · ` : ''}{p.role.replace('_', ' ')}</Text>
        </Pressable>;
      })}</View> : null}
    </Card> : null}

    {client?.consentOk ? <Card>
      <SectionTitle>3. Look</SectionTitle>
      <View style={styles.chips}><Chip label="Side by side" selected={layout === 'side'} onPress={() => setLayout('side')} /><Chip label="Top / bottom" selected={layout === 'stack'} onPress={() => setLayout('stack')} /><Chip label="3 steps (before · after · healed)" selected={layout === 'three'} onPress={() => setLayout('three')} /></View>
      <View style={styles.chips}>{(['1:1', '4:5', '9:16'] as Ratio[]).map((r) => <Chip key={r} label={r} selected={ratio === r} onPress={() => setRatio(r)} />)}</View>
      <View style={styles.chips}><Chip label="Labels 日本語" selected={labels === 'ja'} onPress={() => setLabels('ja')} /><Chip label="Labels English" selected={labels === 'en'} onPress={() => setLabels('en')} /><Chip label="No labels" selected={labels === 'none'} onPress={() => setLabels('none')} /><Chip label={watermark ? 'Logo on' : 'Logo off'} selected={watermark} onPress={() => setWatermark(!watermark)} /></View>
      {Platform.OS === 'web' ? createElement('canvas', { ref: canvasRef, style: { display: 'none' } }) : null}
      <ActionButton kind="primary" label={busy ? 'Making…' : 'Make image'} disabled={busy || picked.length !== need || Platform.OS !== 'web'} onPress={() => void make()} />
      {result ? <>
        <Image source={{ uri: result.url }} style={[styles.result, { aspectRatio: RATIO[ratio] }]} accessibilityLabel="Before and after preview" />
        <ActionButton kind="primary" label="Use in a new post" disabled={busy} onPress={() => void useInPost()} />
      </> : null}
    </Card> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: ui.colors.border, borderRadius: 16, backgroundColor: ui.colors.elevated, color: ui.colors.primaryText, padding: 12, fontSize: 15, fontFamily: tokens.font.ui },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 104, height: 130, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: tokens.color.glassTint },
  thumbOn: { borderColor: tokens.color.charcoal },
  thumbImg: { width: '100%', height: '100%' },
  thumbTag: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(42,39,37,0.72)', color: '#fff', fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  result: { width: '100%', maxWidth: 420, borderRadius: 16 }
});

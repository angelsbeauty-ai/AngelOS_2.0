import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { Skeleton, SupportText } from '../../src/components/ui';
import { PostThumb } from '../../src/components/PostThumb';
import { NoStudio } from '../../src/components/NoStudio';
import { contentPostDate, listContent, type ContentPost } from '../../src/lib/content';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';

/** Instagram grid planner: 3-column preview, newest first, scheduled posts (marked) above what is already posted. */
export default function GridPlanner() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [ws, setWs] = useState<string | null>(null);
  const [posts, setPosts] = useState<ContentPost[] | null>(null);
  const [state, setState] = useState<'ok' | 'error' | 'nostudio'>('ok');
  useFocusEffect(useCallback(() => { void (async () => {
    try {
      const w = await getActiveWorkspace(); setWs(w.id);
      const all = await listContent(w.id);
      const ig = all.filter((p) => ['scheduled', 'publishing', 'published', 'analyzed'].includes(p.status) && (p.variants ?? []).some((v) => v.platform === 'instagram'));
      setPosts(ig.sort((a, b) => (contentPostDate(b)?.getTime() ?? 0) - (contentPostDate(a)?.getTime() ?? 0))); setState('ok');
    } catch (e) { setState(isNoWorkspace(e) ? 'nostudio' : 'error'); }
  })(); }, []));
  const cell = Math.floor((Math.min(width, 600) - 32 - 4) / 3);
  return <Screen hideAsk>
    <SupportText>{t('grid.intro')}</SupportText>
    {state === 'nostudio' ? <NoStudio /> : null}
    {state === 'error' ? <SupportText>{t('s3.errTitle')}</SupportText> : null}
    {state === 'ok' && !posts ? <Skeleton rows={3} height={cell} /> : null}
    {posts && !posts.length ? <SupportText>{t('grid.empty')}</SupportText> : null}
    {posts?.length ? <View style={styles.grid}>{posts.map((p) => { const sched = p.status === 'scheduled' || p.status === 'publishing';
      return <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.title} onPress={() => router.push(`/content/${p.id}`)} style={{ width: cell, height: cell }}>
        <PostThumb workspaceId={ws} post={p} size={cell} radius={0} />
        {sched ? <View style={styles.tag}><Text style={styles.tagText}>{t('s3.st.scheduled')}</Text></View> : null}
      </Pressable>; })}</View> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, borderRadius: 16, overflow: 'hidden' },
  tag: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(140,85,71,0.92)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { color: '#FFF', fontSize: 10, fontFamily: 'Manrope_700Bold' }
});

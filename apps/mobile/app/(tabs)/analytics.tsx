import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dialog } from '../../src/lib/dialog';
import { Screen } from '../../src/components/Screen';
import { BodyText, Card, Pill, PrimaryActionLabel, ScreenTitle, SecondaryActionLabel, SectionTitle, StatCard, SupportText, ui } from '../../src/components/ui';
import { getAnalyticsOverview, runMarketingCoach, type AnalyticsOverview } from '../../src/lib/analytics';
import { getActiveWorkspace, isNoWorkspace } from '../../src/lib/workspace';
import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { Plug } from 'phosphor-react-native/src/icons/Plug';
import { NoStudio } from '../../src/components/NoStudio';
import { Skeleton } from '../../src/components/ui';
import { MetaTiles, PLATS, type Plat } from '../../src/components/MetaTiles';
import { webGlass } from '../../src/design/theme';
import { SocialInsightsCard } from '../../src/components/SocialInsightsCard';
import { BusinessInsightsCard } from '../../src/components/BusinessInsightsCard';

export default function AnalyticsScreen() {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null); const [wsId, setWsId] = useState<string | null>(null); const [coach, setCoach] = useState<string | null>(null); const [busy, setBusy] = useState(true); const [plat, setPlat] = useState<Plat>('all'); const [noStudio, setNoStudio] = useState(false); const [coachBusy, setCoachBusy] = useState(false);
  useEffect(() => { void load(); }, []);
  async function load() { setBusy(true); try { const workspace = await getActiveWorkspace(); setWsId(workspace.id); setOverview(await getAnalyticsOverview(workspace.id, 30)); } catch (error) { if (isNoWorkspace(error)) { setNoStudio(true); return; } /* overview is optional here; the tiles and cards above load on their own */ } finally { setBusy(false); } }
  async function askCoach() { setCoachBusy(true); try { const workspace = await getActiveWorkspace(); const result = await runMarketingCoach(workspace.id, 30); setCoach(result.recommendation); setOverview(result.evidence); } catch (error) { void dialog.notify('Marketing Coach unavailable', error instanceof Error ? error.message : 'Unknown error'); } finally { setCoachBusy(false); } }
  const totals = overview?.totals;

  return <Screen onRefresh={() => load()}>
    <View style={styles.header}><View style={styles.headerCopy}><ScreenTitle>{t('tabs.analytics')}</ScreenTitle></View><Pressable accessibilityRole="button" accessibilityLabel={t('nav3.accounts')} onPress={() => router.push('/content/accounts')} style={styles.round}><Plug size={20} color="#2A2725" /></Pressable></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {PLATS.map(([k, name]) => <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: plat === k }} onPress={() => setPlat(k)} style={[styles.chip, plat === k && styles.chipOn]}><Text numberOfLines={1} style={[styles.chipText, plat === k && { color: '#FFF' }]}>{k === 'all' ? t('messages.all') : name}</Text></Pressable>)}
    </ScrollView>
    {busy ? <Skeleton rows={2} height={86} /> : null}
    {noStudio ? <NoStudio /> : null}
    {wsId ? <MetaTiles workspaceId={wsId} platform={plat} /> : null}
    {wsId && plat === 'all' ? <BusinessInsightsCard workspaceId={wsId} /> : null}
    {wsId && plat === 'all' ? <SocialInsightsCard workspaceId={wsId} /> : null}
    {overview && plat === 'all' ? <>
      <View style={styles.grid}><StatCard label={t('anl.s17')} value={metric(totals?.views)} detail={t('anl.s18')}/><StatCard label={t('anl.s19')} value={metric(totals?.saves)} detail={t('anl.s20')}/></View>
      <View style={styles.grid}><StatCard label={t('anl.s21')} value={metric(totals?.inquiries)} detail={t('anl.s22')}/><StatCard label={t('anl.s23')} value={metric(totals?.bookings)} detail={t('anl.s24')}/></View>
      <Card premium><View style={styles.cardHeader}><SectionTitle>{t('anl.s5')}</SectionTitle><Pill tone={overview.evidence.ownedDataConfidence === 'high' ? 'success' : overview.evidence.ownedDataConfidence === 'low' ? 'warning' : 'gold'}>{overview.evidence.ownedDataConfidence} confidence</Pill></View><SupportText>{overview.evidence.measuredVariants} measured post{overview.evidence.measuredVariants === 1 ? '' : 's'} | {overview.evidence.audienceActivitySamples} audience activity sample{overview.evidence.audienceActivitySamples === 1 ? '' : 's'}</SupportText></Card>
      <Card><SectionTitle>{t('anl.s6')}</SectionTitle>{overview.postingWindow.label ? <><Text style={styles.featureValue}>{overview.postingWindow.label}</Text><SupportText>{overview.postingWindow.confidence} confidence from available evidence.</SupportText></> : <SupportText>{overview.postingWindow.message ?? 'Not enough data yet.'}</SupportText>}</Card>
      <Card><SectionTitle>{t('anl.s7')}</SectionTitle>{overview.topPost ? <><Text style={styles.featureValue}>{overview.topPost.title}</Text><SupportText>{overview.topPost.platform} | {overview.topPost.format}</SupportText><BodyText>{t('anl.s8')}</BodyText></> : <SupportText>{t('anl.s9')}</SupportText>}</Card>
      <Card premium><Pill tone="gold">{t('anl.s10')}</Pill><SectionTitle>What should I do next?</SectionTitle><SupportText>{t('anl.s11')}</SupportText>{coach ? <BodyText>{coach}</BodyText> : null}<Pressable disabled={coachBusy} onPress={() => void askCoach()}><PrimaryActionLabel>{coachBusy ? 'Reviewing...' : 'Give Me One Next Move'}</PrimaryActionLabel></Pressable></Card>
      <Card><SectionTitle>{t('anl.s12')}</SectionTitle><SupportText>{t('anl.s13')}</SupportText><Link href="/marketing-profile" style={styles.link}>{t('anl.s14')}</Link></Card>
      <Card><SectionTitle>{t('anl.s15')}</SectionTitle><SupportText>{t('anl.s16')}</SupportText></Card>
    </> : null}
  </Screen>;
}
function metric(value: number | null | undefined) { return value == null ? '—' : new Intl.NumberFormat().format(value); }
const styles = StyleSheet.create({header:{flexDirection:'row',alignItems:'flex-end',gap:ui.spacing.sm},round:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(250,248,245,0.86)',...(webGlass as object)},chips:{flexDirection:'row',gap:8},chip:{flexShrink:0,height:36,paddingHorizontal:14,borderRadius:18,justifyContent:'center',backgroundColor:'rgba(250,248,245,0.86)',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(42,39,37,0.10)'},chipOn:{backgroundColor:'#2A2725',borderColor:'#2A2725'},chipText:{fontFamily:'Manrope_500Medium',fontSize:15,color:'#2A2725'},headerCopy:{flex:1,gap:ui.spacing.xs},refresh:{width:104},grid:{flexDirection:'row',gap:ui.spacing.sm},cardHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:ui.spacing.sm},featureValue:{color:ui.colors.primaryText,fontSize:20,fontWeight:'700'},link:{color:ui.colors.gold,fontSize:15,fontWeight:'700',paddingVertical:ui.spacing.xs}});

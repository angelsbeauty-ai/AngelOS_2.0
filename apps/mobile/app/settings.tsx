import { clearMe, useRole } from '../src/lib/me';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../src/components/Screen';
import { BodyText, Card, Pill, Row, ScreenTitle, SectionTitle, SupportText, ui } from '../src/components/ui';
import { confirm } from '../src/lib/dialog';
import { getFounderMe } from '../src/lib/founder';
import { supabase } from '../src/lib/supabase';

const settings = [
  { href: '/assistant', title: 'AI Assistant workspace', detail: 'Personality, rules, skills and automations' },
  { href: '/settings/connections', title: 'Connections', detail: 'LINE, Instagram, Facebook: what is really connected' },
  { href: '/marketing-profile', title: 'Marketing Profile', detail: 'Goals, ideal client, experience and service area' },
  { href: '/subscription', title: 'Subscription', detail: 'Plan, student discount and account access' },
  { href: '/system-health', title: 'System Health', detail: 'Connections, Needs Attention and emergency controls' }
] as const;

const tools = [
  { href: '/messages', title: 'Messages', detail: 'Client conversations and AI reply drafts' },
  { href: '/social', title: 'Content', detail: 'AI recommendation, approval and publishing' },
  { href: '/media', title: 'Media', detail: 'Before/after, healed photos and library' },
  { href: '/analytics', title: 'Analytics', detail: 'Views, saves, inquiries and growth trends' },
  { href: '/finance', title: 'Finance', detail: 'Income tracking and business reports' },
  { href: '/automations', title: 'Automations', detail: 'Messages, reminders and follow-ups' },
] as const;

export default function SettingsScreen() {
  const [email, setEmail] = useState<string | null>(null);
  const [isFounder, setIsFounder] = useState(false);
  const { t } = useTranslation();
  const role = useRole();

  useEffect(() => {
    void loadAccount();
  }, []);

  async function loadAccount() {
    const { data } = await supabase.auth.getSession();
    setEmail(data.session?.user.email ?? null);
    try {
      const me = await getFounderMe();
      setIsFounder(me.founder);
    } catch {
      setIsFounder(false);
    }
  }

  async function signOut() {
    const doSignOut = await confirm({
      title: t('settings.signOutTitle'),
      message: t('settings.signOutMsg'),
      confirmText: t('settings.signOut'),
    });
    if (doSignOut) {
      clearMe();
      await supabase.auth.signOut();
      router.replace('/login');
    }
  }

  return <Screen>
    <ScreenTitle>{t('tabs.profile')}</ScreenTitle>
    <Card><SectionTitle>{t('settings.account')}</SectionTitle>{[{ href: '/settings/account', title: t('settings.account'), detail: t('settings.accountDetail') }, ...(role === 'student' ? [] : [{ href: '/settings/business', title: t('settings.business'), detail: t('settings.businessDetail') }])].map((item) => <Link key={item.href} href={item.href as never} asChild><Pressable accessibilityRole="link"><Row accessory={<Text style={styles.chevron}>{'>'}</Text>}><BodyText>{item.title}</BodyText><SupportText>{item.detail}</SupportText></Row></Pressable></Link>)}</Card>
    {role === 'student' ? null : <><Card><SectionTitle>{t('settings.workspace')}</SectionTitle><View>{settings.map((area) => <Link key={area.href} href={area.href} asChild><Pressable><Row accessory={<Text style={styles.chevron}>{'>'}</Text>}><BodyText>{t(`setx.${area.href.replace(/\W/g, '_')}.t`, area.title)}</BodyText><SupportText>{t(`setx.${area.href.replace(/\W/g, '_')}.d`, area.detail)}</SupportText></Row></Pressable></Link>)}</View></Card>
    <Card><SectionTitle>{t('calendar.setup')}</SectionTitle><View>{[{ href: '/services', title: t('calendar.services') }, { href: '/business-hours', title: t('calendar.hours') }, { href: '/time-off', title: t('calendar.daysOff') }].map((item) => <Link key={item.href} href={item.href as any} asChild><Pressable><Row accessory={<Text style={styles.chevron}>{'>'}</Text>}><BodyText>{item.title}</BodyText></Row></Pressable></Link>)}</View></Card>
    <Card><SectionTitle>{t('settings.tools')}</SectionTitle><View>{tools.map((tool) => <Link key={tool.href} href={tool.href} asChild><Pressable><Row accessory={<Text style={styles.chevron}>{'>'}</Text>}><BodyText>{t(`setx.${tool.href.replace(/\W/g, '_')}.t`, tool.title)}</BodyText><SupportText>{t(`setx.${tool.href.replace(/\W/g, '_')}.d`, tool.detail)}</SupportText></Row></Pressable></Link>)}</View></Card>
    </>}
    {isFounder ? <Card><SectionTitle>{t('settings.founder')}</SectionTitle><Link href="/founder-admin" asChild><Pressable><Row accessory={<Text style={styles.chevron}>{'>'}</Text>}><BodyText>Founder Control Center</BodyText><SupportText>Platform rollout, beta access and launch safety controls</SupportText></Row></Pressable></Link></Card> : null}
    <Card><SectionTitle>{t('settings.legal')}</SectionTitle>{[{ href: '/help', title: t('settings.help') }, { href: '/privacy', title: t('settings.privacy') }, { href: '/terms', title: t('settings.terms') }].map((item) => <Link key={item.href} href={item.href as never} asChild><Pressable accessibilityRole="link"><Row accessory={<Text style={styles.chevron}>{'>'}</Text>}><BodyText>{item.title}</BodyText></Row></Pressable></Link>)}<SupportText>{t('settings.version', { v: Constants.expoConfig?.version ?? '—' })}</SupportText></Card>
    <Card><BodyText>{email ?? ''}</BodyText><Pressable onPress={() => void signOut()} style={styles.signOut}><Text style={styles.signOutText}>{t('settings.signOut')}</Text></Pressable></Card>
  </Screen>;
}

const styles = StyleSheet.create({
  chevron:{color:ui.colors.gold,fontSize:26,lineHeight:28},
  signOut:{marginTop:ui.spacing.sm,borderWidth:1,borderColor:ui.colors.border,borderRadius:ui.radius.control,paddingVertical:12,paddingHorizontal:ui.spacing.sm,alignItems:'center',backgroundColor:ui.colors.elevated},
  signOutText:{color:ui.colors.primaryText,fontSize:15,fontWeight:'700'}
});

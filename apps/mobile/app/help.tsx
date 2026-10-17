import { useTranslation } from 'react-i18next';
import { Link } from 'expo-router';
import { Pressable } from 'react-native';
import { Screen } from '../src/components/Screen';
import { BodyText, Card, ScreenTitle, SectionTitle, SupportText } from '../src/components/ui';
import { LEGAL } from '../src/legal/texts';

const FAQ = [
  ['Is anything sent to my clients automatically?', 'No. Every client message, post and LINE broadcast waits for your Approve tap.'],
  ['Why does LINE / Instagram say "not connected"?', 'Those need your own LINE and Meta accounts. Until they are connected, AngelOS only makes drafts you can copy.'],
  ['Does the voice assistant record me?', 'No. Live voice is never recorded or stored, and no transcripts are kept.'],
  ['How do I delete my data?', 'Profile › Account › Delete account. It removes your account and business data.'],
] as const;

export default function HelpScreen() {
  const { t } = useTranslation();
  return <Screen>
    <ScreenTitle>{t('hlp.s0')}</ScreenTitle>
    {FAQ.map(([q, a]) => <Card key={q}><SectionTitle>{q}</SectionTitle><BodyText>{a}</BodyText></Card>)}
    <Card><SectionTitle>{t('hlp.s1')}</SectionTitle><SupportText>{LEGAL.summary}</SupportText></Card>
    <Link href="/beta-feedback" asChild><Pressable accessibilityRole="link"><Card><SectionTitle>{t('hlp.s2')}</SectionTitle></Card></Pressable></Link>
  </Screen>;
}

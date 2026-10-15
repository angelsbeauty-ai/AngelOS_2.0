import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Screen } from '../src/components/Screen';
import { ScreenTitle, SupportText } from '../src/components/ui';
import { SuggestionsCard } from '../src/components/SuggestionsCard';
import { getActiveWorkspace } from '../src/lib/workspace';

export default function SuggestionsScreen() {
  const { t } = useTranslation();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  useEffect(() => { void getActiveWorkspace().then((ws) => setWorkspaceId(ws.id)).catch(() => undefined); }, []);
  return <Screen>
    <ScreenTitle>{t('sgp.s0')}</ScreenTitle>
    <SupportText>{t('sgp.s1')}</SupportText>
    <SuggestionsCard workspaceId={workspaceId} showAllLink={false} />
  </Screen>;
}

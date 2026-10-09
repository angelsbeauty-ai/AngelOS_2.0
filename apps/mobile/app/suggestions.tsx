import { useEffect, useState } from 'react';
import { Screen } from '../src/components/Screen';
import { ScreenTitle, SupportText } from '../src/components/ui';
import { SuggestionsCard } from '../src/components/SuggestionsCard';
import { getActiveWorkspace } from '../src/lib/workspace';

export default function SuggestionsScreen() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  useEffect(() => { void getActiveWorkspace().then((ws) => setWorkspaceId(ws.id)).catch(() => undefined); }, []);
  return <Screen>
    <ScreenTitle>Suggestions</ScreenTitle>
    <SupportText>Approve creates a draft for you to check. Nothing is sent to a client or posted until you approve it again.</SupportText>
    <SuggestionsCard workspaceId={workspaceId} showAllLink={false} />
  </Screen>;
}

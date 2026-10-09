import { Screen } from '../../src/components/Screen';
import { Card, ScreenTitle, SectionTitle, SupportText } from '../../src/components/ui';

export default function ConnectionsScreen() {
  return (
    <Screen>
      <ScreenTitle>Connections</ScreenTitle>
      <SupportText>Connect your Instagram, Facebook and LINE to publish posts and track analytics.</SupportText>
      
      <Card>
        <SectionTitle>Instagram</SectionTitle>
        <SupportText>Status: Not connected yet</SupportText>
        <SupportText tone="secondary">Instagram publishing works with Business/Creator accounts linked to a Facebook Page.</SupportText>
      </Card>

      <Card>
        <SectionTitle>Facebook</SectionTitle>
        <SupportText>Status: Not connected yet</SupportText>
        <SupportText tone="secondary">Connect a Facebook Page to post content and view insights.</SupportText>
      </Card>

      <Card>
        <SectionTitle>LINE Official Account</SectionTitle>
        <SupportText>Status: Not connected yet</SupportText>
        <SupportText tone="secondary">Connect a LINE OA to send broadcast messages and receive customer inquiries.</SupportText>
      </Card>

      <Card>
        <SectionTitle>TikTok</SectionTitle>
        <SupportText>Status: Not connected yet</SupportText>
        <SupportText tone="secondary">Download videos and copy captions manually. Direct posting coming soon.</SupportText>
      </Card>
    </Screen>
  );
}

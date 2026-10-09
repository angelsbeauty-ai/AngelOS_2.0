import { StyleSheet } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { EmptyState, ScreenTitle, SupportText, Card } from '../../src/components/ui';

export default function CampaignsScreen() {
  return (
    <Screen>
      <ScreenTitle>Social Campaigns</ScreenTitle>
      <SupportText>Plan multi-week content campaigns for your studio.</SupportText>
      
      <Card>
        <EmptyState
          icon="Target"
          title="Coming soon"
          message="Create a campaign with a goal and date range. AngelOS will fill your calendar with balanced, coordinated posts."
          action={{ label: 'Create campaign', onPress: () => {} }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({});

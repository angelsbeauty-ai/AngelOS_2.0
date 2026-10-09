import { StyleSheet, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { BodyText, Card, EmptyState, ScreenTitle, SupportText } from '../../src/components/ui';

export default function BeforeAfterScreen() {
  return (
    <Screen>
      <ScreenTitle>Before & After Composer</ScreenTitle>
      <SupportText>Create stunning side-by-side before/after posts with your logo watermark.</SupportText>
      
      <Card>
        <EmptyState
          icon="Image"
          title="Coming soon"
          message="Select 2 photos tagged before/after from your client to create a watermarked composite."
          action={{ label: 'Learn more', onPress: () => {} }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({});

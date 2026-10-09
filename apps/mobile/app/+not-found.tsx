import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../src/components/Screen';
import { BodyText, ScreenTitle, SecondaryActionLabel, SupportText, ui } from '../src/components/ui';

export default function NotFoundScreen() {
  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.notFound}>404</Text>
        <ScreenTitle>Page not found</ScreenTitle>
        <SupportText>The page you're looking for doesn't exist.</SupportText>
        <Link href="/" asChild>
          <Pressable style={styles.button}>
            <SecondaryActionLabel>Go home</SecondaryActionLabel>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: ui.spacing.md,
    paddingVertical: ui.spacing.md,
  },
  notFound: {
    color: ui.colors.gold,
    fontSize: 48,
    fontWeight: '700',
  },
  button: {
    marginTop: ui.spacing.md,
  },
});

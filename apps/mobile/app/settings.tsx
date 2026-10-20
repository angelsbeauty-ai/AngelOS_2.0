import { Redirect } from 'expo-router';

/** O16: Profile is the settings hub; the old Settings screen just forwards there. */
export default function SettingsRedirect() { return <Redirect href="/(tabs)/profile" />; }
